// ============================================================================
// CARGO ROUTES
// ============================================================================
// Kargo entegrasyonları için API endpoint'leri
// Yurtiçi Kargo, Aras Kargo, MNG Kargo
// ============================================================================

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';
import cargoAggregator from '../services/cargo-aggregator.js';
import yurticiKargo from '../services/yurtici-kargo.js';
import arasKargo from '../services/aras-kargo.js';
import mngKargo from '../services/mng-kargo.js';

const router = express.Router();
const prisma = new PrismaClient();

// All routes require authentication
router.use(authenticateToken);

// ============================================================================
// YURTICI KARGO ROUTES
// ============================================================================

/**
 * POST /api/cargo/yurtici/connect
 * Connect Yurtiçi Kargo integration
 */
router.post('/yurtici/connect', async (req, res) => {
  try {
    const businessId = req.businessId;
    const { customerCode, username, password } = req.body;

    if (!customerCode || !username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Müşteri kodu, kullanıcı adı ve şifre gerekli'
      });
    }

    const credentials = { customerCode, username, password };
    const result = await cargoAggregator.connectCarrier(businessId, 'yurtici', credentials);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Yurtiçi connect error:', error);
    res.status(500).json({
      success: false,
      error: 'Bağlantı hatası'
    });
  }
});

/**
 * POST /api/cargo/yurtici/disconnect
 * Disconnect Yurtiçi Kargo integration
 */
router.post('/yurtici/disconnect', async (req, res) => {
  try {
    const businessId = req.businessId;
    const result = await cargoAggregator.disconnectCarrier(businessId, 'yurtici');

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Yurtiçi disconnect error:', error);
    res.status(500).json({
      success: false,
      error: 'Bağlantı kesme hatası'
    });
  }
});

/**
 * POST /api/cargo/yurtici/test
 * Test Yurtiçi Kargo connection
 */
router.post('/yurtici/test', async (req, res) => {
  try {
    const businessId = req.businessId;
    const result = await cargoAggregator.testCarrierConnection(businessId, 'yurtici');

    res.json(result);
  } catch (error) {
    console.error('Yurtiçi test error:', error);
    res.status(500).json({
      success: false,
      error: 'Bağlantı testi hatası'
    });
  }
});

// ============================================================================
// ARAS KARGO ROUTES
// ============================================================================

/**
 * POST /api/cargo/aras/connect
 * Connect Aras Kargo integration
 */
router.post('/aras/connect', async (req, res) => {
  try {
    const businessId = req.businessId;
    const { username, password, customerCode } = req.body;

    if (!username || !password || !customerCode) {
      return res.status(400).json({
        success: false,
        error: 'Kullanıcı adı, şifre ve müşteri kodu gerekli'
      });
    }

    const credentials = { username, password, customerCode };
    const result = await cargoAggregator.connectCarrier(businessId, 'aras', credentials);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Aras connect error:', error);
    res.status(500).json({
      success: false,
      error: 'Bağlantı hatası'
    });
  }
});

/**
 * POST /api/cargo/aras/disconnect
 * Disconnect Aras Kargo integration
 */
router.post('/aras/disconnect', async (req, res) => {
  try {
    const businessId = req.businessId;
    const result = await cargoAggregator.disconnectCarrier(businessId, 'aras');

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Aras disconnect error:', error);
    res.status(500).json({
      success: false,
      error: 'Bağlantı kesme hatası'
    });
  }
});

/**
 * POST /api/cargo/aras/test
 * Test Aras Kargo connection
 */
router.post('/aras/test', async (req, res) => {
  try {
    const businessId = req.businessId;
    const result = await cargoAggregator.testCarrierConnection(businessId, 'aras');

    res.json(result);
  } catch (error) {
    console.error('Aras test error:', error);
    res.status(500).json({
      success: false,
      error: 'Bağlantı testi hatası'
    });
  }
});

// ============================================================================
// MNG KARGO ROUTES
// ============================================================================

/**
 * POST /api/cargo/mng/connect
 * Connect MNG Kargo integration
 */
router.post('/mng/connect', async (req, res) => {
  try {
    const businessId = req.businessId;
    const { apiKey, customerId } = req.body;

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: 'API anahtarı gerekli'
      });
    }

    const credentials = { apiKey, customerId: customerId || '' };
    const result = await cargoAggregator.connectCarrier(businessId, 'mng', credentials);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('MNG connect error:', error);
    res.status(500).json({
      success: false,
      error: 'Bağlantı hatası'
    });
  }
});

/**
 * POST /api/cargo/mng/disconnect
 * Disconnect MNG Kargo integration
 */
router.post('/mng/disconnect', async (req, res) => {
  try {
    const businessId = req.businessId;
    const result = await cargoAggregator.disconnectCarrier(businessId, 'mng');

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('MNG disconnect error:', error);
    res.status(500).json({
      success: false,
      error: 'Bağlantı kesme hatası'
    });
  }
});

/**
 * POST /api/cargo/mng/test
 * Test MNG Kargo connection
 */
router.post('/mng/test', async (req, res) => {
  try {
    const businessId = req.businessId;
    const result = await cargoAggregator.testCarrierConnection(businessId, 'mng');

    res.json(result);
  } catch (error) {
    console.error('MNG test error:', error);
    res.status(500).json({
      success: false,
      error: 'Bağlantı testi hatası'
    });
  }
});

// ============================================================================
// GENERAL CARGO ROUTES
// ============================================================================

/**
 * POST /api/cargo/track
 * Track shipment by tracking number
 * Body: { trackingNumber: string, carrier?: string }
 */
router.post('/track', async (req, res) => {
  try {
    const businessId = req.businessId;
    const { trackingNumber, carrier } = req.body;

    if (!trackingNumber) {
      return res.status(400).json({
        success: false,
        error: 'Takip numarası gerekli'
      });
    }

    const result = await cargoAggregator.trackShipment(businessId, trackingNumber, carrier);
    res.json(result);
  } catch (error) {
    console.error('Track shipment error:', error);
    res.status(500).json({
      success: false,
      error: 'Kargo takip hatası'
    });
  }
});

/**
 * GET /api/cargo/connected
 * Get list of connected cargo carriers
 */
router.get('/connected', async (req, res) => {
  try {
    const businessId = req.businessId;
    const carriers = await cargoAggregator.getConnectedCarriers(businessId);

    res.json({
      success: true,
      carriers,
      hasIntegration: carriers.length > 0
    });
  } catch (error) {
    console.error('Get connected carriers error:', error);
    res.status(500).json({
      success: false,
      error: 'Bağlı kargo firmaları alınamadı'
    });
  }
});

/**
 * GET /api/cargo/status/:carrier
 * Get status of a specific cargo carrier integration
 */
router.get('/status/:carrier', async (req, res) => {
  try {
    const businessId = req.businessId;
    const { carrier } = req.params;

    const integration = await prisma.integration.findFirst({
      where: {
        businessId,
        type: `${carrier.toUpperCase()}_KARGO`,
        isActive: true
      }
    });

    if (!integration) {
      return res.json({
        success: true,
        connected: false,
        carrier
      });
    }

    // Mask sensitive data
    const maskedCredentials = {};
    if (integration.credentials) {
      const creds = integration.credentials;
      if (creds.customerCode) maskedCredentials.customerCode = creds.customerCode;
      if (creds.username) maskedCredentials.username = creds.username;
      if (creds.customerId) maskedCredentials.customerId = creds.customerId;
      // Don't include password or apiKey
    }

    res.json({
      success: true,
      connected: true,
      carrier,
      connectedAt: integration.createdAt,
      lastUpdated: integration.updatedAt,
      credentials: maskedCredentials
    });
  } catch (error) {
    console.error('Get carrier status error:', error);
    res.status(500).json({
      success: false,
      error: 'Durum alınamadı'
    });
  }
});

export default router;
