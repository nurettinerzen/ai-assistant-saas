/**
 * Google Sheets Integration Routes
 * OAuth 2.0 based integration for inventory management
 */

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import googleSheetsService from '../services/google-sheets.js';

const router = express.Router();
const prisma = new PrismaClient();

// Helper: Get Google credentials from env
const getGoogleCredentials = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_SHEETS_REDIRECT_URI || `${process.env.BACKEND_URL}/api/google-sheets/callback`;

  if (!clientId || !clientSecret) {
    throw new Error('Google credentials not configured');
  }

  return { clientId, clientSecret, redirectUri };
};

// Helper: Check and refresh token if needed
const ensureValidToken = async (business) => {
  if (!business.googleSheetsRefreshToken) {
    throw new Error('No refresh token available');
  }

  const { clientId, clientSecret } = getGoogleCredentials();
  const now = new Date();

  // Check if token is expired or will expire in next 5 minutes
  if (business.googleSheetsTokenExpiry && new Date(business.googleSheetsTokenExpiry) > new Date(now.getTime() + 5 * 60 * 1000)) {
    return {
      accessToken: business.googleSheetsAccessToken,
      refreshToken: business.googleSheetsRefreshToken
    };
  }

  // Refresh the token
  console.log(`Refreshing Google Sheets token for business ${business.id}`);
  const credentials = await googleSheetsService.refreshAccessToken(
    business.googleSheetsRefreshToken,
    clientId,
    clientSecret
  );

  // Update tokens in database
  await prisma.business.update({
    where: { id: business.id },
    data: {
      googleSheetsAccessToken: credentials.access_token,
      googleSheetsTokenExpiry: credentials.expiry_date ? new Date(credentials.expiry_date) : null
    }
  });

  return {
    accessToken: credentials.access_token,
    refreshToken: business.googleSheetsRefreshToken
  };
};

// ==================== AUTH ENDPOINTS ====================

// GET /api/google-sheets/auth-url - Start OAuth flow
router.get('/auth-url', authenticateToken, async (req, res) => {
  try {
    const { clientId, clientSecret, redirectUri } = getGoogleCredentials();

    const oauth2Client = googleSheetsService.createOAuth2Client(clientId, clientSecret, redirectUri);
    const authUrl = googleSheetsService.getAuthUrl(oauth2Client, req.businessId.toString());

    res.json({
      authUrl,
      message: 'Redirect user to this URL to connect Google Sheets'
    });
  } catch (error) {
    console.error('Google Sheets auth URL error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate auth URL' });
  }
});

// GET /api/google-sheets/callback - Handle OAuth callback
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.redirect(`${process.env.FRONTEND_URL}/dashboard/integrations?error=google-sheets-no-code`);
    }

    const businessId = parseInt(state);
    if (!businessId) {
      return res.redirect(`${process.env.FRONTEND_URL}/dashboard/integrations?error=google-sheets-invalid-state`);
    }

    const { clientId, clientSecret, redirectUri } = getGoogleCredentials();
    const oauth2Client = googleSheetsService.createOAuth2Client(clientId, clientSecret, redirectUri);

    // Exchange code for tokens
    const tokens = await googleSheetsService.getTokens(oauth2Client, code);

    // Save tokens to business
    await prisma.business.update({
      where: { id: businessId },
      data: {
        googleSheetsAccessToken: tokens.access_token,
        googleSheetsRefreshToken: tokens.refresh_token,
        googleSheetsTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        googleSheetsConnected: true
      }
    });

    // Also update Integration table for consistency
    await prisma.integration.upsert({
      where: {
        businessId_type: {
          businessId,
          type: 'GOOGLE_SHEETS'
        }
      },
      update: {
        credentials: { hasTokens: true },
        isActive: true,
        connected: true
      },
      create: {
        businessId,
        type: 'GOOGLE_SHEETS',
        credentials: { hasTokens: true },
        isActive: true,
        connected: true
      }
    });

    console.log(`✅ Google Sheets connected for business ${businessId}`);
    res.redirect(`${process.env.FRONTEND_URL}/dashboard/integrations?success=google-sheets`);
  } catch (error) {
    console.error('Google Sheets callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/dashboard/integrations?error=google-sheets`);
  }
});

// ==================== STATUS & MANAGEMENT ====================

// GET /api/google-sheets/status - Check connection status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const business = await prisma.business.findUnique({
      where: { id: req.businessId },
      select: {
        googleSheetsConnected: true,
        googleSheetId: true,
        googleSheetName: true,
        googleSheetLastSync: true
      }
    });

    res.json({
      connected: business?.googleSheetsConnected || false,
      selectedSpreadsheet: business?.googleSheetId || null,
      selectedSheet: business?.googleSheetName || null,
      lastSync: business?.googleSheetLastSync || null
    });
  } catch (error) {
    console.error('Google Sheets status error:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// POST /api/google-sheets/disconnect - Disconnect integration
router.post('/disconnect', authenticateToken, requireRole(['OWNER', 'ADMIN']), async (req, res) => {
  try {
    await prisma.business.update({
      where: { id: req.businessId },
      data: {
        googleSheetsAccessToken: null,
        googleSheetsRefreshToken: null,
        googleSheetsTokenExpiry: null,
        googleSheetsConnected: false,
        googleSheetId: null,
        googleSheetName: null,
        googleSheetLastSync: null
      }
    });

    // Update Integration table
    await prisma.integration.updateMany({
      where: {
        businessId: req.businessId,
        type: 'GOOGLE_SHEETS'
      },
      data: {
        isActive: false,
        connected: false
      }
    });

    console.log(`✅ Google Sheets disconnected for business ${req.businessId}`);
    res.json({ success: true, message: 'Google Sheets disconnected' });
  } catch (error) {
    console.error('Google Sheets disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

// ==================== SPREADSHEET ENDPOINTS ====================

// GET /api/google-sheets/spreadsheets - List user's spreadsheets
router.get('/spreadsheets', authenticateToken, async (req, res) => {
  try {
    const business = await prisma.business.findUnique({
      where: { id: req.businessId }
    });

    if (!business?.googleSheetsConnected) {
      return res.status(400).json({ error: 'Google Sheets not connected' });
    }

    const { clientId, clientSecret } = getGoogleCredentials();
    const { accessToken, refreshToken } = await ensureValidToken(business);

    const spreadsheets = await googleSheetsService.listSpreadsheets(
      accessToken,
      refreshToken,
      clientId,
      clientSecret
    );

    res.json({
      spreadsheets,
      selected: business.googleSheetId || null
    });
  } catch (error) {
    console.error('List spreadsheets error:', error);
    res.status(500).json({ error: 'Failed to list spreadsheets' });
  }
});

// GET /api/google-sheets/spreadsheet/:id - Get spreadsheet info
router.get('/spreadsheet/:id', authenticateToken, async (req, res) => {
  try {
    const { id: spreadsheetId } = req.params;

    const business = await prisma.business.findUnique({
      where: { id: req.businessId }
    });

    if (!business?.googleSheetsConnected) {
      return res.status(400).json({ error: 'Google Sheets not connected' });
    }

    const { clientId, clientSecret } = getGoogleCredentials();
    const { accessToken, refreshToken } = await ensureValidToken(business);

    const info = await googleSheetsService.getSpreadsheetInfo(
      accessToken,
      refreshToken,
      clientId,
      clientSecret,
      spreadsheetId
    );

    res.json(info);
  } catch (error) {
    console.error('Get spreadsheet info error:', error);
    res.status(500).json({ error: 'Failed to get spreadsheet info' });
  }
});

// POST /api/google-sheets/select - Select spreadsheet and sheet
router.post('/select', authenticateToken, requireRole(['OWNER', 'ADMIN']), async (req, res) => {
  try {
    const { spreadsheetId, sheetName } = req.body;

    if (!spreadsheetId) {
      return res.status(400).json({ error: 'Spreadsheet ID is required' });
    }

    const business = await prisma.business.findUnique({
      where: { id: req.businessId }
    });

    if (!business?.googleSheetsConnected) {
      return res.status(400).json({ error: 'Google Sheets not connected' });
    }

    // Verify access to spreadsheet
    const { clientId, clientSecret } = getGoogleCredentials();
    const { accessToken, refreshToken } = await ensureValidToken(business);

    const info = await googleSheetsService.getSpreadsheetInfo(
      accessToken,
      refreshToken,
      clientId,
      clientSecret,
      spreadsheetId
    );

    // Default to first sheet if not specified
    const selectedSheet = sheetName || info.sheets[0]?.title || 'Sheet1';

    await prisma.business.update({
      where: { id: req.businessId },
      data: {
        googleSheetId: spreadsheetId,
        googleSheetName: selectedSheet
      }
    });

    res.json({
      success: true,
      spreadsheet: {
        id: spreadsheetId,
        title: info.title,
        sheet: selectedSheet
      }
    });
  } catch (error) {
    console.error('Select spreadsheet error:', error);
    res.status(500).json({ error: 'Failed to select spreadsheet' });
  }
});

// ==================== DETECT SHEETS ENDPOINT ====================

// GET /api/google-sheets/detect-sheets - Detect sheet types in selected spreadsheet
router.get('/detect-sheets', authenticateToken, async (req, res) => {
  try {
    const business = await prisma.business.findUnique({
      where: { id: req.businessId }
    });

    if (!business?.googleSheetsConnected) {
      return res.status(400).json({ error: 'Google Sheets not connected' });
    }

    if (!business.googleSheetId) {
      return res.status(400).json({ error: 'No spreadsheet selected' });
    }

    const { clientId, clientSecret } = getGoogleCredentials();
    const { accessToken, refreshToken } = await ensureValidToken(business);

    const detected = await googleSheetsService.detectSheets(
      accessToken,
      refreshToken,
      clientId,
      clientSecret,
      business.googleSheetId
    );

    res.json({
      success: true,
      spreadsheetTitle: detected.title,
      detected: {
        products: detected.products,
        orders: detected.orders,
        tickets: detected.tickets
      },
      allSheets: detected.allSheets
    });
  } catch (error) {
    console.error('Detect sheets error:', error);
    res.status(500).json({ error: 'Failed to detect sheets' });
  }
});

// ==================== SYNC ENDPOINTS ====================

// POST /api/google-sheets/sync - Sync all data (products, orders, tickets) from spreadsheet
router.post('/sync', authenticateToken, requireRole(['OWNER', 'ADMIN']), async (req, res) => {
  try {
    const business = await prisma.business.findUnique({
      where: { id: req.businessId }
    });

    if (!business?.googleSheetsConnected) {
      return res.status(400).json({ error: 'Google Sheets not connected' });
    }

    if (!business.googleSheetId) {
      return res.status(400).json({ error: 'No spreadsheet selected' });
    }

    const { clientId, clientSecret } = getGoogleCredentials();
    const { accessToken, refreshToken } = await ensureValidToken(business);

    // Detect available sheets
    const detected = await googleSheetsService.detectSheets(
      accessToken,
      refreshToken,
      clientId,
      clientSecret,
      business.googleSheetId
    );

    const results = {
      products: { imported: 0, updated: 0, total: 0, errors: [] },
      orders: { imported: 0, updated: 0, total: 0, errors: [] },
      tickets: { imported: 0, updated: 0, total: 0, errors: [] }
    };

    // ========== SYNC PRODUCTS ==========
    if (detected.products) {
      try {
        const products = await googleSheetsService.readProducts(
          accessToken, refreshToken, clientId, clientSecret,
          business.googleSheetId, detected.products
        );

        results.products.total = products.length;

        for (const productData of products) {
          try {
            const existing = await prisma.product.findUnique({
              where: {
                businessId_sku: {
                  businessId: req.businessId,
                  sku: productData.sku
                }
              }
            });

            if (existing) {
              await prisma.product.update({
                where: { id: existing.id },
                data: {
                  name: productData.name,
                  description: productData.description,
                  price: productData.price,
                  stockQuantity: productData.stockQuantity,
                  lowStockThreshold: productData.lowStockThreshold,
                  category: productData.category
                }
              });

              if (productData.stockQuantity !== existing.stockQuantity) {
                await prisma.inventoryLog.create({
                  data: {
                    productId: existing.id,
                    changeType: productData.stockQuantity > existing.stockQuantity ? 'RESTOCK' : 'ADJUSTMENT',
                    quantityChange: Math.abs(productData.stockQuantity - existing.stockQuantity),
                    newQuantity: productData.stockQuantity,
                    note: 'Google Sheets sync'
                  }
                });
              }

              results.products.updated++;
            } else {
              const newProduct = await prisma.product.create({
                data: {
                  businessId: req.businessId,
                  sku: productData.sku,
                  name: productData.name,
                  description: productData.description,
                  price: productData.price,
                  stockQuantity: productData.stockQuantity,
                  lowStockThreshold: productData.lowStockThreshold,
                  category: productData.category
                }
              });

              await prisma.inventoryLog.create({
                data: {
                  productId: newProduct.id,
                  changeType: 'RESTOCK',
                  quantityChange: productData.stockQuantity,
                  newQuantity: productData.stockQuantity,
                  note: 'Initial import from Google Sheets'
                }
              });

              results.products.imported++;
            }
          } catch (err) {
            results.products.errors.push({ sku: productData.sku, error: err.message });
          }
        }
      } catch (err) {
        console.error('Products sync error:', err);
      }
    }

    // ========== SYNC ORDERS ==========
    if (detected.orders) {
      try {
        const orders = await googleSheetsService.readOrders(
          accessToken, refreshToken, clientId, clientSecret,
          business.googleSheetId, detected.orders
        );

        results.orders.total = orders.length;

        for (const orderData of orders) {
          try {
            const existing = await prisma.crmOrder.findUnique({
              where: {
                businessId_orderNumber: {
                  businessId: req.businessId,
                  orderNumber: orderData.orderNumber
                }
              }
            });

            const now = new Date();

            if (existing) {
              await prisma.crmOrder.update({
                where: { id: existing.id },
                data: {
                  customerPhone: orderData.customerPhone,
                  customerName: orderData.customerName,
                  status: orderData.status,
                  trackingNumber: orderData.trackingNumber || null,
                  carrier: orderData.carrier || null,
                  totalAmount: orderData.totalAmount,
                  estimatedDelivery: orderData.estimatedDelivery,
                  externalUpdatedAt: now
                }
              });
              results.orders.updated++;
            } else {
              await prisma.crmOrder.create({
                data: {
                  businessId: req.businessId,
                  orderNumber: orderData.orderNumber,
                  customerPhone: orderData.customerPhone,
                  customerName: orderData.customerName,
                  status: orderData.status,
                  trackingNumber: orderData.trackingNumber || null,
                  carrier: orderData.carrier || null,
                  totalAmount: orderData.totalAmount,
                  estimatedDelivery: orderData.estimatedDelivery,
                  externalCreatedAt: now,
                  externalUpdatedAt: now
                }
              });
              results.orders.imported++;
            }
          } catch (err) {
            results.orders.errors.push({ orderNumber: orderData.orderNumber, error: err.message });
          }
        }
      } catch (err) {
        console.error('Orders sync error:', err);
      }
    }

    // ========== SYNC TICKETS ==========
    if (detected.tickets) {
      try {
        const tickets = await googleSheetsService.readTickets(
          accessToken, refreshToken, clientId, clientSecret,
          business.googleSheetId, detected.tickets
        );

        results.tickets.total = tickets.length;

        for (const ticketData of tickets) {
          try {
            const existing = await prisma.crmTicket.findUnique({
              where: {
                businessId_ticketNumber: {
                  businessId: req.businessId,
                  ticketNumber: ticketData.ticketNumber
                }
              }
            });

            const now = new Date();

            if (existing) {
              await prisma.crmTicket.update({
                where: { id: existing.id },
                data: {
                  customerPhone: ticketData.customerPhone,
                  customerName: ticketData.customerName,
                  product: ticketData.product || null,
                  issue: ticketData.issue,
                  status: ticketData.status,
                  notes: ticketData.notes || null,
                  estimatedCompletion: ticketData.estimatedCompletion,
                  cost: ticketData.cost,
                  externalUpdatedAt: now
                }
              });
              results.tickets.updated++;
            } else {
              await prisma.crmTicket.create({
                data: {
                  businessId: req.businessId,
                  ticketNumber: ticketData.ticketNumber,
                  customerPhone: ticketData.customerPhone,
                  customerName: ticketData.customerName,
                  product: ticketData.product || null,
                  issue: ticketData.issue,
                  status: ticketData.status,
                  notes: ticketData.notes || null,
                  estimatedCompletion: ticketData.estimatedCompletion,
                  cost: ticketData.cost,
                  externalCreatedAt: now,
                  externalUpdatedAt: now
                }
              });
              results.tickets.imported++;
            }
          } catch (err) {
            results.tickets.errors.push({ ticketNumber: ticketData.ticketNumber, error: err.message });
          }
        }
      } catch (err) {
        console.error('Tickets sync error:', err);
      }
    }

    // Update last sync time
    await prisma.business.update({
      where: { id: req.businessId },
      data: { googleSheetLastSync: new Date() }
    });

    // Clean up empty error arrays
    if (results.products.errors.length === 0) delete results.products.errors;
    if (results.orders.errors.length === 0) delete results.orders.errors;
    if (results.tickets.errors.length === 0) delete results.tickets.errors;

    res.json({
      success: true,
      detected: {
        products: detected.products || null,
        orders: detected.orders || null,
        tickets: detected.tickets || null
      },
      results
    });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Failed to sync data' });
  }
});

// ==================== TEMPLATE ENDPOINT ====================

// POST /api/google-sheets/create-template - Create template spreadsheet
router.post('/create-template', authenticateToken, async (req, res) => {
  try {
    const business = await prisma.business.findUnique({
      where: { id: req.businessId }
    });

    if (!business?.googleSheetsConnected) {
      return res.status(400).json({ error: 'Google Sheets not connected' });
    }

    const { clientId, clientSecret } = getGoogleCredentials();
    const { accessToken, refreshToken } = await ensureValidToken(business);

    const template = await googleSheetsService.createTemplateSpreadsheet(
      accessToken,
      refreshToken,
      clientId,
      clientSecret
    );

    res.json({
      success: true,
      spreadsheet: template,
      message: 'Template created successfully'
    });
  } catch (error) {
    console.error('Create template error:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// ==================== TEST ENDPOINT ====================

// POST /api/google-sheets/test - Test connection
router.post('/test', authenticateToken, async (req, res) => {
  try {
    const business = await prisma.business.findUnique({
      where: { id: req.businessId }
    });

    if (!business?.googleSheetsConnected) {
      return res.json({ success: false, message: 'Not connected' });
    }

    const { clientId, clientSecret } = getGoogleCredentials();

    try {
      const { accessToken, refreshToken } = await ensureValidToken(business);

      // Try to list spreadsheets as a test
      const spreadsheets = await googleSheetsService.listSpreadsheets(
        accessToken,
        refreshToken,
        clientId,
        clientSecret
      );

      res.json({
        success: true,
        message: 'Connection is active',
        spreadsheetCount: spreadsheets.length
      });
    } catch (tokenError) {
      // Token refresh failed
      res.json({
        success: false,
        message: 'Token expired or invalid. Please reconnect.'
      });
    }
  } catch (error) {
    console.error('Test connection error:', error);
    res.status(500).json({ error: 'Failed to test connection' });
  }
});

export default router;
