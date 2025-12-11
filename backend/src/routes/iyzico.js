/**
 * iyzico Payment API Routes
 * API Key authentication + Payment & Refund endpoints
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import iyzicoService from '../services/iyzico.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// ============================================================================
// Connection Management
// ============================================================================

/**
 * Connect iyzico with API credentials
 * POST /api/iyzico/connect
 * Body: { apiKey, secretKey, environment }
 */
router.post('/connect', async (req, res) => {
  try {
    const { apiKey, secretKey, environment } = req.body;

    // Validate required fields
    if (!apiKey || !secretKey) {
      return res.status(400).json({
        error: 'API Key ve Secret Key zorunludur'
      });
    }

    // Validate environment
    const validEnvironments = ['sandbox', 'production'];
    const env = validEnvironments.includes(environment) ? environment : 'sandbox';

    const result = await iyzicoService.connect(req.businessId, apiKey, secretKey, env);

    if (result.success) {
      res.json({
        success: true,
        message: 'iyzico basariyla baglandi',
        environment: result.environment
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Baglanti basarisiz'
      });
    }
  } catch (error) {
    console.error('iyzico connect error:', error);
    res.status(500).json({
      error: 'iyzico baglanirken hata olustu',
      message: error.message
    });
  }
});

/**
 * Disconnect iyzico integration
 * POST /api/iyzico/disconnect
 */
router.post('/disconnect', async (req, res) => {
  try {
    const result = await iyzicoService.disconnect(req.businessId);

    if (result.success) {
      res.json({
        success: true,
        message: 'iyzico baglantisi kesildi'
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Baglanti kesilemedi'
      });
    }
  } catch (error) {
    console.error('iyzico disconnect error:', error);
    res.status(500).json({
      error: 'Baglanti kesilirken hata olustu',
      message: error.message
    });
  }
});

/**
 * Test iyzico connection
 * POST /api/iyzico/test
 * Body: { apiKey, secretKey, environment } - Optional, uses saved credentials if not provided
 */
router.post('/test', async (req, res) => {
  try {
    const { apiKey, secretKey, environment } = req.body;

    let result;

    if (apiKey && secretKey) {
      // Test with provided credentials
      result = await iyzicoService.testConnection(apiKey, secretKey, environment || 'sandbox');
    } else {
      // Test with saved credentials
      try {
        const credentials = await iyzicoService.getCredentials(req.businessId);
        result = await iyzicoService.testConnection(
          credentials.apiKey,
          credentials.secretKey,
          credentials.environment
        );
      } catch (credError) {
        return res.status(400).json({
          success: false,
          error: 'iyzico baglantisi bulunamadi. Lutfen once baglanin.'
        });
      }
    }

    res.json(result);
  } catch (error) {
    console.error('iyzico test error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get connection status
 * GET /api/iyzico/status
 */
router.get('/status', async (req, res) => {
  try {
    const status = await iyzicoService.getStatus(req.businessId);
    res.json(status);
  } catch (error) {
    console.error('iyzico status error:', error);
    res.status(500).json({
      error: 'Durum alinamadi',
      message: error.message
    });
  }
});

// ============================================================================
// Payment Endpoints
// ============================================================================

/**
 * Get payment details
 * POST /api/iyzico/payment
 * Body: { paymentId } or { conversationId }
 */
router.post('/payment', async (req, res) => {
  try {
    const { paymentId, conversationId, orderNumber } = req.body;

    if (!paymentId && !conversationId && !orderNumber) {
      return res.status(400).json({
        error: 'paymentId, conversationId veya orderNumber gerekli'
      });
    }

    let result;

    if (paymentId) {
      result = await iyzicoService.getPaymentDetail(req.businessId, paymentId);
    } else {
      // Use conversationId or orderNumber (they're typically the same)
      const convId = conversationId || orderNumber;
      result = await iyzicoService.getPaymentByConversationId(req.businessId, convId);
    }

    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({
      success: false,
      error: 'Odeme bilgisi alinamadi',
      message: error.message
    });
  }
});

// ============================================================================
// Refund Endpoints
// ============================================================================

/**
 * Get refund status
 * POST /api/iyzico/refund-status
 * Body: { paymentId } or { conversationId }
 */
router.post('/refund-status', async (req, res) => {
  try {
    const { paymentId, conversationId, orderNumber } = req.body;

    if (!paymentId && !conversationId && !orderNumber) {
      return res.status(400).json({
        error: 'paymentId, conversationId veya orderNumber gerekli'
      });
    }

    // First get payment to get paymentId if we have conversationId
    let targetPaymentId = paymentId;

    if (!targetPaymentId) {
      const convId = conversationId || orderNumber;
      const paymentResult = await iyzicoService.getPaymentByConversationId(req.businessId, convId);

      if (!paymentResult.success) {
        return res.status(404).json({
          success: false,
          error: 'Odeme bulunamadi'
        });
      }

      targetPaymentId = paymentResult.payment.paymentId;
    }

    const result = await iyzicoService.getRefundStatus(req.businessId, targetPaymentId);

    res.json(result);
  } catch (error) {
    console.error('Get refund status error:', error);
    res.status(500).json({
      success: false,
      error: 'Iade durumu alinamadi',
      message: error.message
    });
  }
});

/**
 * Initiate refund (optional - use with caution)
 * POST /api/iyzico/refund
 * Body: { paymentTransactionId, amount, reason }
 */
router.post('/refund', async (req, res) => {
  try {
    const { paymentTransactionId, amount, reason } = req.body;

    if (!paymentTransactionId || !amount) {
      return res.status(400).json({
        error: 'paymentTransactionId ve amount zorunludur'
      });
    }

    const result = await iyzicoService.initiateRefund(
      req.businessId,
      paymentTransactionId,
      parseFloat(amount),
      reason || ''
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Initiate refund error:', error);
    res.status(500).json({
      success: false,
      error: 'Iade baslatilamadi',
      message: error.message
    });
  }
});

export default router;
