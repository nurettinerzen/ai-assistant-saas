// ============================================================================
// SHOPIFY INTEGRATION ROUTES
// ============================================================================
// FILE: backend/src/routes/shopify.js
//
// Handles Shopify integration connect/disconnect and API endpoints
// ============================================================================

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';
import shopifyService from '../services/shopify.js';

const router = express.Router();
const prisma = new PrismaClient();

// All routes require authentication
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
