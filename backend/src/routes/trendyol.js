/**
 * Trendyol Integration Routes
 * Handles Trendyol Marketplace API integration for e-commerce businesses
 *
 * Endpoints:
 * - POST /connect - Connect Trendyol account
 * - POST /disconnect - Disconnect Trendyol account
 * - POST /test - Test API connection
 * - GET /orders - Get orders list
 * - GET /orders/:orderNumber - Get specific order
 * - GET /products/stock/:barcode - Get product stock
 */

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';
import trendyolService from '../services/trendyol.js';

const router = express.Router();
const prisma = new PrismaClient();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/* ============================================================
   CONNECT TRENDYOL
============================================================ */
router.post('/connect', async (req, res) => {
  try {
    const { supplierId, apiKey, apiSecret } = req.body;
    const businessId = req.businessId;

    // Validate required fields
    if (!supplierId || !apiKey || !apiSecret) {
      return res.status(400).json({
        error: 'Supplier ID, API Key ve API Secret zorunludur'
      });
    }

    // Test connection before saving
    const testResult = await trendyolService.testConnection({
      supplierId,
      apiKey,
      apiSecret
    });

    if (!testResult.success) {
      return res.status(400).json({
        error: 'Trendyol API bağlantısı başarısız',
        details: testResult.message
      });
    }

    // Save credentials to Integration model
    const integration = await prisma.integration.upsert({
      where: {
        businessId_type: {
          businessId,
          type: 'TRENDYOL'
        }
      },
      update: {
        credentials: {
          supplierId,
          apiKey,
          apiSecret
        },
        connected: true,
        isActive: true,
        updatedAt: new Date()
      },
      create: {
        businessId,
        type: 'TRENDYOL',
        credentials: {
          supplierId,
          apiKey,
          apiSecret
        },
        connected: true,
        isActive: true
      }
    });

    console.log(`✅ Trendyol connected for business ${businessId}`);

    res.json({
      success: true,
      message: 'Trendyol hesabı başarıyla bağlandı',
      integration: {
        id: integration.id,
        type: integration.type,
        connected: integration.connected,
        isActive: integration.isActive
      }
    });
  } catch (error) {
    console.error('❌ Trendyol connect error:', error);
    res.status(500).json({
      error: 'Trendyol bağlantısı başarısız',
      message: error.message
    });
  }
});

/* ============================================================
   DISCONNECT TRENDYOL
============================================================ */
router.post('/disconnect', async (req, res) => {
  try {
    const businessId = req.businessId;

    // Update integration to disconnected state
    await prisma.integration.updateMany({
      where: {
        businessId,
        type: 'TRENDYOL'
      },
      data: {
        connected: false,
        isActive: false,
        updatedAt: new Date()
      }
    });

    console.log(`✅ Trendyol disconnected for business ${businessId}`);

    res.json({
      success: true,
      message: 'Trendyol bağlantısı kesildi'
    });
  } catch (error) {
    console.error('❌ Trendyol disconnect error:', error);
    res.status(500).json({
      error: 'Bağlantı kesme işlemi başarısız'
    });
  }
});

/* ============================================================
   TEST TRENDYOL CONNECTION
============================================================ */
router.post('/test', async (req, res) => {
  try {
    const businessId = req.businessId;

    // Get credentials from database
    const integration = await prisma.integration.findUnique({
      where: {
        businessId_type: {
          businessId,
          type: 'TRENDYOL'
        }
      }
    });

    if (!integration || !integration.credentials) {
      return res.status(404).json({
        error: 'Trendyol bağlantısı bulunamadı. Önce bağlantı yapın.'
      });
    }

    // Test connection
    const testResult = await trendyolService.testConnection(integration.credentials);

    if (testResult.success) {
      // Update last sync time
      await prisma.integration.update({
        where: { id: integration.id },
        data: { lastSync: new Date() }
      });
    }

    res.json(testResult);
  } catch (error) {
    console.error('❌ Trendyol test error:', error);
    res.status(500).json({
      success: false,
      error: 'Bağlantı testi başarısız',
      message: error.message
    });
  }
});

/* ============================================================
   GET ORDERS LIST
============================================================ */
router.get('/orders', async (req, res) => {
  try {
    const businessId = req.businessId;
    const { status, startDate, endDate, page, size } = req.query;

    // Build filters object
    const filters = {};
    if (status) filters.status = status;
    if (startDate) filters.startDate = parseInt(startDate);
    if (endDate) filters.endDate = parseInt(endDate);
    if (page) filters.page = parseInt(page);
    if (size) filters.size = parseInt(size);

    const orders = await trendyolService.getOrders(businessId, filters);

    res.json(orders);
  } catch (error) {
    console.error('❌ Trendyol get orders error:', error);

    // Check if integration not found
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Trendyol bağlantısı bulunamadı'
      });
    }

    res.status(500).json({
      error: 'Siparişler alınamadı',
      message: error.message
    });
  }
});

/* ============================================================
   GET SINGLE ORDER BY ORDER NUMBER
============================================================ */
router.get('/orders/:orderNumber', async (req, res) => {
  try {
    const businessId = req.businessId;
    const { orderNumber } = req.params;

    if (!orderNumber) {
      return res.status(400).json({
        error: 'Sipariş numarası gerekli'
      });
    }

    const order = await trendyolService.getOrderByNumber(businessId, orderNumber);

    if (!order) {
      return res.status(404).json({
        error: 'Sipariş bulunamadı',
        orderNumber
      });
    }

    res.json(order);
  } catch (error) {
    console.error('❌ Trendyol get order error:', error);
    res.status(500).json({
      error: 'Sipariş bilgisi alınamadı',
      message: error.message
    });
  }
});

/* ============================================================
   GET ORDERS BY CUSTOMER PHONE
============================================================ */
router.get('/orders/customer/:phone', async (req, res) => {
  try {
    const businessId = req.businessId;
    const { phone } = req.params;

    if (!phone) {
      return res.status(400).json({
        error: 'Telefon numarası gerekli'
      });
    }

    const orders = await trendyolService.getOrdersByCustomerPhone(businessId, phone);

    res.json({
      phone,
      orders,
      count: orders.length
    });
  } catch (error) {
    console.error('❌ Trendyol get orders by phone error:', error);
    res.status(500).json({
      error: 'Siparişler alınamadı',
      message: error.message
    });
  }
});

/* ============================================================
   GET CARGO TRACKING
============================================================ */
router.get('/cargo/:orderNumber', async (req, res) => {
  try {
    const businessId = req.businessId;
    const { orderNumber } = req.params;

    if (!orderNumber) {
      return res.status(400).json({
        error: 'Sipariş numarası gerekli'
      });
    }

    const cargoInfo = await trendyolService.getCargoTracking(businessId, orderNumber);

    res.json(cargoInfo);
  } catch (error) {
    console.error('❌ Trendyol get cargo error:', error);
    res.status(500).json({
      error: 'Kargo bilgisi alınamadı',
      message: error.message
    });
  }
});

/* ============================================================
   GET PRODUCT STOCK BY BARCODE
============================================================ */
router.get('/products/stock/:barcode', async (req, res) => {
  try {
    const businessId = req.businessId;
    const { barcode } = req.params;

    if (!barcode) {
      return res.status(400).json({
        error: 'Barkod numarası gerekli'
      });
    }

    const stockInfo = await trendyolService.getProductStock(businessId, barcode);

    res.json(stockInfo);
  } catch (error) {
    console.error('❌ Trendyol get stock error:', error);
    res.status(500).json({
      error: 'Stok bilgisi alınamadı',
      message: error.message
    });
  }
});

/* ============================================================
   SEARCH PRODUCTS BY NAME
============================================================ */
router.get('/products/search', async (req, res) => {
  try {
    const businessId = req.businessId;
    const { q, productName } = req.query;

    const searchTerm = q || productName;

    if (!searchTerm) {
      return res.status(400).json({
        error: 'Arama terimi gerekli (q veya productName parametresi)'
      });
    }

    const result = await trendyolService.searchProducts(businessId, searchTerm);

    res.json(result);
  } catch (error) {
    console.error('❌ Trendyol search products error:', error);
    res.status(500).json({
      error: 'Ürün araması başarısız',
      message: error.message
    });
  }
});

/* ============================================================
   GET INTEGRATION STATUS
============================================================ */
router.get('/status', async (req, res) => {
  try {
    const businessId = req.businessId;

    const integration = await prisma.integration.findUnique({
      where: {
        businessId_type: {
          businessId,
          type: 'TRENDYOL'
        }
      },
      select: {
        id: true,
        connected: true,
        isActive: true,
        lastSync: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!integration) {
      return res.json({
        connected: false,
        isActive: false
      });
    }

    res.json({
      connected: integration.connected,
      isActive: integration.isActive,
      lastSync: integration.lastSync,
      connectedAt: integration.createdAt
    });
  } catch (error) {
    console.error('❌ Trendyol status error:', error);
    res.status(500).json({
      error: 'Durum bilgisi alınamadı'
    });
  }
});

export default router;
