// ============================================================================
// SHOPIFY INTEGRATION ROUTES
// ============================================================================
// FILE: backend/src/routes/shopify.js
//
// Handles Shopify OAuth integration and API endpoints
// ============================================================================

import express from 'express';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';
import shopifyService from '../services/shopify.js';

const router = express.Router();
const prisma = new PrismaClient();

// OAuth state storage (in production, use Redis)
const oauthStates = new Map();

// ============================================================================
// OAUTH ROUTES (Public - No Auth Required)
// ============================================================================

/**
 * GET /api/shopify/auth
 * Initiate Shopify OAuth flow
 * Query params: shop (required), businessId (required)
 */
router.get('/auth', async (req, res) => {
  try {
    const { shop, businessId } = req.query;

    if (!shop) {
      return res.status(400).json({ error: 'Shop URL is required' });
    }

    if (!businessId) {
      return res.status(400).json({ error: 'Business ID is required' });
    }

    // Normalize shop URL
    let shopDomain = shop.trim().toLowerCase();
    if (!shopDomain.includes('.myshopify.com')) {
      shopDomain = shopDomain.replace(/^https?:\/\//, '').split('/')[0];
      if (!shopDomain.endsWith('.myshopify.com')) {
        shopDomain = `${shopDomain}.myshopify.com`;
      }
    } else {
      shopDomain = shopDomain.replace(/^https?:\/\//, '').split('/')[0];
    }

    // Generate state for CSRF protection
    const state = crypto.randomBytes(16).toString('hex');

    // Store state with businessId (expires in 10 minutes)
    oauthStates.set(state, {
      businessId,
      shop: shopDomain,
      createdAt: Date.now()
    });

    // Clean up old states (older than 10 minutes)
    for (const [key, value] of oauthStates.entries()) {
      if (Date.now() - value.createdAt > 10 * 60 * 1000) {
        oauthStates.delete(key);
      }
    }

    const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
    const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
    const scopes = 'read_orders,read_products,read_inventory,read_customers';
    const redirectUri = `${BACKEND_URL}/api/shopify/callback`;

    const authUrl = `https://${shopDomain}/admin/oauth/authorize?` +
      `client_id=${SHOPIFY_API_KEY}` +
      `&scope=${scopes}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${state}`;

    console.log(`🔗 Shopify OAuth initiated for shop: ${shopDomain}, businessId: ${businessId}`);

    res.redirect(authUrl);

  } catch (error) {
    console.error('❌ Shopify OAuth init error:', error);
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${FRONTEND_URL}/dashboard/integrations?shopify=error&message=${encodeURIComponent(error.message)}`);
  }
});

/**
 * GET /api/shopify/callback
 * Handle Shopify OAuth callback
 */
router.get('/callback', async (req, res) => {
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

  try {
    const { code, shop, state, hmac } = req.query;

    if (!code || !shop || !state) {
      console.error('❌ Missing OAuth parameters');
      return res.redirect(`${FRONTEND_URL}/dashboard/integrations?shopify=error&message=Missing+parameters`);
    }

    // Verify state
    const storedState = oauthStates.get(state);
    if (!storedState) {
      console.error('❌ Invalid or expired state');
      return res.redirect(`${FRONTEND_URL}/dashboard/integrations?shopify=error&message=Invalid+state`);
    }

    // Get businessId and clean up state
    const { businessId } = storedState;
    oauthStates.delete(state);

    // Exchange code for access token
    const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
    const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;

    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: SHOPIFY_API_KEY,
        client_secret: SHOPIFY_API_SECRET,
        code
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('❌ Failed to exchange code for token:', errorText);
      return res.redirect(`${FRONTEND_URL}/dashboard/integrations?shopify=error&message=Token+exchange+failed`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Get shop info
    const shopInfoResponse = await fetch(`https://${shop}/admin/api/2024-01/shop.json`, {
      headers: { 'X-Shopify-Access-Token': accessToken }
    });

    let shopInfo = { name: shop, domain: shop };
    if (shopInfoResponse.ok) {
      const shopData = await shopInfoResponse.json();
      shopInfo = shopData.shop;
    }

    // Save integration
    await prisma.integration.upsert({
      where: {
        businessId_type: {
          businessId,
          type: 'SHOPIFY'
        }
      },
      update: {
        credentials: {
          shopUrl: shop,
          accessToken,
          shopName: shopInfo.name,
          shopDomain: shopInfo.domain,
          shopId: shopInfo.id,
          email: shopInfo.email,
          oauthConnected: true
        },
        connected: true,
        isActive: true,
        lastSync: new Date()
      },
      create: {
        businessId,
        type: 'SHOPIFY',
        credentials: {
          shopUrl: shop,
          accessToken,
          shopName: shopInfo.name,
          shopDomain: shopInfo.domain,
          shopId: shopInfo.id,
          email: shopInfo.email,
          oauthConnected: true
        },
        connected: true,
        isActive: true
      }
    });

    console.log(`✅ Shopify OAuth completed for business ${businessId}: ${shopInfo.name}`);

    res.redirect(`${FRONTEND_URL}/dashboard/integrations?shopify=success&shop=${encodeURIComponent(shopInfo.name)}`);

  } catch (error) {
    console.error('❌ Shopify OAuth callback error:', error);
    res.redirect(`${FRONTEND_URL}/dashboard/integrations?shopify=error&message=${encodeURIComponent(error.message)}`);
  }
});

// ============================================================================
// AUTHENTICATED ROUTES
// ============================================================================

// All routes below require authentication
router.use(authenticateToken);

// ============================================================================
// CONNECTION MANAGEMENT
// ============================================================================

/**
 * POST /api/shopify/connect
 * Connect Shopify store
 */
router.post('/connect', async (req, res) => {
  try {
    const { shopUrl, accessToken } = req.body;

    // Validate required fields
    if (!shopUrl || !accessToken) {
      return res.status(400).json({
        error: 'Shop URL and Access Token are required'
      });
    }

    // Test connection first
    const testResult = await shopifyService.testConnection({ shopUrl, accessToken });

    if (!testResult.success) {
      return res.status(400).json({
        error: 'Failed to connect to Shopify',
        details: testResult.message
      });
    }

    // Save integration
    await prisma.integration.upsert({
      where: {
        businessId_type: {
          businessId: req.businessId,
          type: 'SHOPIFY'
        }
      },
      update: {
        credentials: {
          shopUrl,
          accessToken,
          shopName: testResult.shop.name,
          shopDomain: testResult.shop.domain
        },
        connected: true,
        isActive: true,
        lastSync: new Date()
      },
      create: {
        businessId: req.businessId,
        type: 'SHOPIFY',
        credentials: {
          shopUrl,
          accessToken,
          shopName: testResult.shop.name,
          shopDomain: testResult.shop.domain
        },
        connected: true,
        isActive: true
      }
    });

    console.log(`✅ Shopify connected for business ${req.businessId}: ${testResult.shop.name}`);

    res.json({
      success: true,
      message: 'Shopify connected successfully',
      shop: testResult.shop
    });

  } catch (error) {
    console.error('❌ Shopify connect error:', error);
    res.status(500).json({
      error: 'Failed to connect Shopify',
      message: error.message
    });
  }
});

/**
 * POST /api/shopify/disconnect
 * Disconnect Shopify store
 */
router.post('/disconnect', async (req, res) => {
  try {
    await prisma.integration.updateMany({
      where: {
        businessId: req.businessId,
        type: 'SHOPIFY'
      },
      data: {
        connected: false,
        isActive: false
      }
    });

    console.log(`✅ Shopify disconnected for business ${req.businessId}`);

    res.json({
      success: true,
      message: 'Shopify disconnected successfully'
    });

  } catch (error) {
    console.error('❌ Shopify disconnect error:', error);
    res.status(500).json({
      error: 'Failed to disconnect Shopify'
    });
  }
});

/**
 * POST /api/shopify/test
 * Test Shopify connection
 */
router.post('/test', async (req, res) => {
  try {
    const integration = await prisma.integration.findFirst({
      where: {
        businessId: req.businessId,
        type: 'SHOPIFY'
      }
    });

    if (!integration) {
      return res.status(404).json({
        error: 'Shopify not connected'
      });
    }

    const testResult = await shopifyService.testConnection(integration.credentials);

    res.json({
      success: true,
      message: 'Connection successful',
      shop: testResult.shop
    });

  } catch (error) {
    console.error('❌ Shopify test error:', error);
    res.status(500).json({
      success: false,
      error: 'Connection test failed',
      message: error.message
    });
  }
});

/**
 * GET /api/shopify/status
 * Get Shopify connection status
 */
router.get('/status', async (req, res) => {
  try {
    const integration = await prisma.integration.findFirst({
      where: {
        businessId: req.businessId,
        type: 'SHOPIFY'
      }
    });

    if (!integration || !integration.connected) {
      return res.json({
        connected: false
      });
    }

    res.json({
      connected: true,
      isActive: integration.isActive,
      shopName: integration.credentials?.shopName,
      shopDomain: integration.credentials?.shopDomain,
      lastSync: integration.lastSync
    });

  } catch (error) {
    console.error('❌ Shopify status error:', error);
    res.status(500).json({
      error: 'Failed to get status'
    });
  }
});

// ============================================================================
// ORDER ENDPOINTS
// ============================================================================

/**
 * GET /api/shopify/orders
 * Get recent orders
 */
router.get('/orders', async (req, res) => {
  try {
    const { limit, status } = req.query;

    const result = await shopifyService.getOrders(req.businessId, {
      limit: parseInt(limit) || 50,
      status: status || 'any'
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json(result);

  } catch (error) {
    console.error('❌ Shopify get orders error:', error);
    res.status(500).json({
      error: 'Failed to get orders'
    });
  }
});

/**
 * GET /api/shopify/orders/:orderNumber
 * Get order by order number
 */
router.get('/orders/:orderNumber', async (req, res) => {
  try {
    const { orderNumber } = req.params;

    const result = await shopifyService.getOrderByNumber(req.businessId, orderNumber);

    if (!result.success) {
      return res.status(404).json({
        error: result.message || 'Order not found'
      });
    }

    res.json(result);

  } catch (error) {
    console.error('❌ Shopify get order error:', error);
    res.status(500).json({
      error: 'Failed to get order'
    });
  }
});

/**
 * GET /api/shopify/orders/search/phone/:phone
 * Search order by phone number
 */
router.get('/orders/search/phone/:phone', async (req, res) => {
  try {
    const { phone } = req.params;

    const result = await shopifyService.getOrderByPhone(req.businessId, phone);

    if (!result.success) {
      return res.status(404).json({
        error: result.message || 'Order not found'
      });
    }

    res.json(result);

  } catch (error) {
    console.error('❌ Shopify search order error:', error);
    res.status(500).json({
      error: 'Failed to search order'
    });
  }
});

/**
 * GET /api/shopify/orders/search/email/:email
 * Search order by email
 */
router.get('/orders/search/email/:email', async (req, res) => {
  try {
    const { email } = req.params;

    const result = await shopifyService.getOrderByEmail(req.businessId, email);

    if (!result.success) {
      return res.status(404).json({
        error: result.message || 'Order not found'
      });
    }

    res.json(result);

  } catch (error) {
    console.error('❌ Shopify search order error:', error);
    res.status(500).json({
      error: 'Failed to search order'
    });
  }
});

// ============================================================================
// PRODUCT ENDPOINTS
// ============================================================================

/**
 * GET /api/shopify/products
 * Get products
 */
router.get('/products', async (req, res) => {
  try {
    const { limit, title } = req.query;

    if (title) {
      const result = await shopifyService.getProductByTitle(req.businessId, title);
      return res.json(result);
    }

    const result = await shopifyService.getProducts(req.businessId, {
      limit: parseInt(limit) || 50
    });

    res.json(result);

  } catch (error) {
    console.error('❌ Shopify get products error:', error);
    res.status(500).json({
      error: 'Failed to get products'
    });
  }
});

/**
 * GET /api/shopify/products/:productId/stock
 * Get product stock
 */
router.get('/products/:productId/stock', async (req, res) => {
  try {
    const { productId } = req.params;

    const result = await shopifyService.getProductStock(req.businessId, productId);

    if (!result.success) {
      return res.status(404).json({
        error: result.message || 'Product not found'
      });
    }

    res.json(result);

  } catch (error) {
    console.error('❌ Shopify get stock error:', error);
    res.status(500).json({
      error: 'Failed to get stock'
    });
  }
});

export default router;
