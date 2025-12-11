/**
 * Paraşüt Muhasebe API Routes
 * OAuth2 flow + Invoice & Contact endpoints
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import parasutService from '../services/parasut.js';

const router = express.Router();

// ============================================================================
// OAuth Flow (Callback BEFORE auth middleware)
// ============================================================================

/**
 * OAuth Callback - Handle Paraşüt redirect
 * This MUST be before authenticateToken middleware
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query;

    // Handle OAuth errors
    if (error) {
      console.error('Paraşüt OAuth error:', error, error_description);
      return res.redirect(
        `${process.env.FRONTEND_URL}/dashboard/integrations?error=parasut&message=${encodeURIComponent(error_description || error)}`
      );
    }

    if (!code || !state) {
      return res.redirect(
        `${process.env.FRONTEND_URL}/dashboard/integrations?error=parasut&message=Missing authorization code`
      );
    }

    // Handle callback - exchange code for tokens
    const result = await parasutService.handleCallback(code, state);

    if (result.success) {
      console.log(`Paraşüt connected for business ${result.businessId}`);
      return res.redirect(
        `${process.env.FRONTEND_URL}/dashboard/integrations?success=parasut`
      );
    } else {
      return res.redirect(
        `${process.env.FRONTEND_URL}/dashboard/integrations?error=parasut`
      );
    }
  } catch (error) {
    console.error('Paraşüt callback error:', error);
    return res.redirect(
      `${process.env.FRONTEND_URL}/dashboard/integrations?error=parasut&message=${encodeURIComponent(error.message)}`
    );
  }
});

// ============================================================================
// Protected Routes (require authentication)
// ============================================================================

router.use(authenticateToken);

/**
 * Get OAuth authorization URL
 * GET /api/parasut/auth
 */
router.get('/auth', async (req, res) => {
  try {
    const authUrl = parasutService.getAuthUrl(req.businessId);
    res.json({ authUrl });
  } catch (error) {
    console.error('Paraşüt auth error:', error);
    res.status(500).json({
      error: 'Failed to generate authorization URL',
      message: error.message
    });
  }
});

/**
 * Get connection status
 * GET /api/parasut/status
 */
router.get('/status', async (req, res) => {
  try {
    const status = await parasutService.getStatus(req.businessId);
    res.json(status);
  } catch (error) {
    console.error('Paraşüt status error:', error);
    res.status(500).json({
      error: 'Failed to get connection status',
      message: error.message
    });
  }
});

/**
 * Disconnect Paraşüt integration
 * POST /api/parasut/disconnect
 */
router.post('/disconnect', async (req, res) => {
  try {
    const result = await parasutService.disconnect(req.businessId);

    if (result.success) {
      res.json({
        success: true,
        message: 'Paraşüt disconnected successfully'
      });
    } else {
      res.status(500).json({
        error: 'Failed to disconnect',
        message: result.error
      });
    }
  } catch (error) {
    console.error('Paraşüt disconnect error:', error);
    res.status(500).json({
      error: 'Failed to disconnect Paraşüt',
      message: error.message
    });
  }
});

// ============================================================================
// Invoice Endpoints
// ============================================================================

/**
 * Get all invoices with optional filters
 * GET /api/parasut/invoices
 * Query params: status, start_date, end_date, page, limit
 */
router.get('/invoices', async (req, res) => {
  try {
    const { status, start_date, end_date, page, limit } = req.query;

    const result = await parasutService.getInvoices(req.businessId, {
      status,
      start_date,
      end_date,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined
    });

    res.json(result);
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get invoices',
      message: error.message
    });
  }
});

/**
 * Get invoice by invoice number
 * GET /api/parasut/invoices/:number
 */
router.get('/invoices/:number', async (req, res) => {
  try {
    const { number } = req.params;

    const result = await parasutService.getInvoiceByNumber(req.businessId, number);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Get invoice by number error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get invoice',
      message: error.message
    });
  }
});

/**
 * Get invoices by customer name
 * GET /api/parasut/invoices/customer/:name
 */
router.get('/invoices/customer/:name', async (req, res) => {
  try {
    const { name } = req.params;

    const result = await parasutService.getInvoicesByCustomer(req.businessId, name);

    res.json(result);
  } catch (error) {
    console.error('Get invoices by customer error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get invoices',
      message: error.message
    });
  }
});

// ============================================================================
// Contact (Cari) Endpoints
// ============================================================================

/**
 * Get all contacts
 * GET /api/parasut/contacts
 * Query params: type (customer/supplier), page, limit
 */
router.get('/contacts', async (req, res) => {
  try {
    const { type, page, limit } = req.query;

    const result = await parasutService.getContacts(req.businessId, {
      type,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined
    });

    res.json(result);
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get contacts',
      message: error.message
    });
  }
});

/**
 * Get contact balance by ID
 * GET /api/parasut/contacts/:id/balance
 */
router.get('/contacts/:id/balance', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await parasutService.getContactBalance(req.businessId, id);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Get contact balance error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get contact balance',
      message: error.message
    });
  }
});

/**
 * Search contact by name
 * GET /api/parasut/contacts/search/:name
 */
router.get('/contacts/search/:name', async (req, res) => {
  try {
    const { name } = req.params;

    const result = await parasutService.getContactByName(req.businessId, name);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Search contact error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search contact',
      message: error.message
    });
  }
});

export default router;
