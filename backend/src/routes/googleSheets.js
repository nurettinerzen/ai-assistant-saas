import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';
import googleSheetsService from '../services/googleSheets.js';

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

// Küçük helper: bu business'ın aktif aboneliği var mı?
async function ensureActiveSubscription(businessId) {
  const sub = await prisma.subscription.findUnique({
    where: { businessId }
  });

  if (!sub || sub.status !== 'ACTIVE') {
    return false;
  }
  return true;
}

// Connect Google Sheet to business
router.post('/connect', async (req, res) => {
  try {
    const { spreadsheetId, sheetName } = req.body;
    const { businessId } = req;

    if (!businessId) {
      return res.status(401).json({ error: 'Business context missing' });
    }

    const hasActive = await ensureActiveSubscription(businessId);
    if (!hasActive) {
      return res.status(403).json({
        error: 'An active subscription is required to use Google Sheets integration.'
      });
    }

    if (!spreadsheetId) {
      return res.status(400).json({ error: 'Spreadsheet ID required' });
    }

    // Validate spreadsheet access
    const validation = await googleSheetsService.validateSpreadsheet(spreadsheetId);
    
    if (!validation.valid) {
      return res.status(400).json({ 
        error: 'Cannot access spreadsheet. Make sure you shared it with: ai-assistant-saas@ai-assistant-saas-478506.iam.gserviceaccount.com'
      });
    }

    // Update business with sheet info
    await prisma.business.update({
      where: { id: businessId },
      data: {
        googleSheetId: spreadsheetId,
        googleSheetName: sheetName || 'Sheet1'
      }
    });

    res.json({
      success: true,
      message: 'Google Sheet connected successfully',
      spreadsheet: validation
    });

  } catch (error) {
    console.error('Connect sheet error:', error);
    res.status(500).json({ error: 'Failed to connect Google Sheet' });
  }
});

// Sync inventory from Google Sheet
router.post('/sync', async (req, res) => {
  try {
    const { businessId } = req;

    if (!businessId) {
      return res.status(401).json({ error: 'Business context missing' });
    }

    const hasActive = await ensureActiveSubscription(businessId);
    if (!hasActive) {
      return res.status(403).json({
        error: 'An active subscription is required to sync inventory from Google Sheets.'
      });
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId }
    });

    if (!business.googleSheetId) {
      return res.status(400).json({ error: 'No Google Sheet connected' });
    }

    // Read inventory from sheet
    const range = `${business.googleSheetName || 'Sheet1'}!A:G`;
    const products = await googleSheetsService.readInventory(business.googleSheetId, range);

    let imported = 0;
    let updated = 0;
    let errors = [];

    // Import/update products
    for (const productData of products) {
      try {
        const existing = await prisma.product.findUnique({
          where: {
            businessId_sku: {
              businessId,
              sku: productData.sku
            }
          }
        });

        if (existing) {
          // Update
          await prisma.product.update({
            where: { id: existing.id },
            data: productData
          });

          // Log stock change
          if (productData.stockQuantity !== existing.stockQuantity) {
            await prisma.inventoryLog.create({
              data: {
                productId: existing.id,
                changeType: productData.stockQuantity > existing.stockQuantity ? 'RESTOCK' : 'SALE',
                quantity: Math.abs(productData.stockQuantity - existing.stockQuantity),
                previousQuantity: existing.stockQuantity,
                newQuantity: productData.stockQuantity,
                notes: 'Google Sheets sync'
              }
            });
          }

          updated++;
        } else {
          // Create
          const newProduct = await prisma.product.create({
            data: {
              ...productData,
              businessId
            }
          });

          await prisma.inventoryLog.create({
            data: {
              productId: newProduct.id,
              changeType: 'RESTOCK',
              quantity: productData.stockQuantity,
              previousQuantity: 0,
              newQuantity: productData.stockQuantity,
              notes: 'Initial stock from Google Sheets'
            }
          });

          imported++;
        }
      } catch (error) {
        errors.push({ sku: productData.sku, error: error.message });
      }
    }

    // Update last sync time
    await prisma.business.update({
      where: { id: businessId },
      data: { googleSheetLastSync: new Date() }
    });

    res.json({
      success: true,
      imported,
      updated,
      total: products.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Failed to sync inventory' });
  }
});

// Disconnect Google Sheet
router.post('/disconnect', async (req, res) => {
  try {
    const { businessId } = req;

    if (!businessId) {
      return res.status(401).json({ error: 'Business context missing' });
    }

    const hasActive = await ensureActiveSubscription(businessId);
    if (!hasActive) {
      return res.status(403).json({
        error: 'An active subscription is required to manage Google Sheets integration.'
      });
    }

    await prisma.business.update({
      where: { id: businessId },
      data: {
        googleSheetId: null,
        googleSheetName: null,
        googleSheetLastSync: null
      }
    });

    res.json({ success: true, message: 'Google Sheet disconnected' });

  } catch (error) {
    console.error('Disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

export default router;
