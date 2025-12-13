/**
 * Batch Call Routes
 * Collection campaign management endpoints
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import batchCallService from '../services/batch-call.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// ============================================================================
// CAMPAIGN MANAGEMENT
// ============================================================================

/**
 * Create a new collection campaign
 * POST /api/batch-call/campaigns
 * Body: {
 *   name?: string,
 *   channel: 'PHONE' | 'WHATSAPP',
 *   customers: [{ name, phone, email?, invoiceId?, invoiceNumber?, amount, daysOverdue }],
 *   maxConcurrent?: number,
 *   callDelay?: number,
 *   maxRetries?: number,
 *   collectionScript?: string
 * }
 */
router.post('/campaigns', async (req, res) => {
  try {
    const result = await batchCallService.createCampaign(req.businessId, req.body);
    res.status(201).json(result);
  } catch (error) {
    console.error('Create campaign error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get all campaigns for business
 * GET /api/batch-call/campaigns
 * Query: status?, page?, limit?
 */
router.get('/campaigns', async (req, res) => {
  try {
    const { status, page, limit } = req.query;
    const result = await batchCallService.getCampaigns(req.businessId, {
      status,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20
    });
    res.json(result);
  } catch (error) {
    console.error('Get campaigns error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get single campaign with stats
 * GET /api/batch-call/campaigns/:id
 */
router.get('/campaigns/:id', async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id);
    const campaign = await batchCallService.getCampaignWithStats(campaignId);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    // Verify ownership
    if (campaign.businessId !== req.businessId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.json({
      success: true,
      campaign
    });
  } catch (error) {
    console.error('Get campaign error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get campaign calls
 * GET /api/batch-call/campaigns/:id/calls
 * Query: status?, page?, limit?
 */
router.get('/campaigns/:id/calls', async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id);
    const { status, page, limit } = req.query;

    // First verify campaign ownership
    const campaign = await batchCallService.getCampaignWithStats(campaignId);
    if (!campaign || campaign.businessId !== req.businessId) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    const result = await batchCallService.getCampaignCalls(campaignId, {
      status,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Get campaign calls error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// CAMPAIGN CONTROL
// ============================================================================

/**
 * Start a campaign
 * POST /api/batch-call/campaigns/:id/start
 */
router.post('/campaigns/:id/start', async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id);
    const result = await batchCallService.startCampaign(campaignId, req.businessId);
    res.json(result);
  } catch (error) {
    console.error('Start campaign error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Pause a running campaign
 * POST /api/batch-call/campaigns/:id/pause
 */
router.post('/campaigns/:id/pause', async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id);
    const result = await batchCallService.pauseCampaign(campaignId, req.businessId);
    res.json(result);
  } catch (error) {
    console.error('Pause campaign error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Resume a paused campaign
 * POST /api/batch-call/campaigns/:id/resume
 */
router.post('/campaigns/:id/resume', async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id);
    const result = await batchCallService.resumeCampaign(campaignId, req.businessId);
    res.json(result);
  } catch (error) {
    console.error('Resume campaign error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Cancel a campaign
 * POST /api/batch-call/campaigns/:id/cancel
 */
router.post('/campaigns/:id/cancel', async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id);
    const result = await batchCallService.cancelCampaign(campaignId, req.businessId);
    res.json(result);
  } catch (error) {
    console.error('Cancel campaign error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// WEBHOOK (No auth - called by VAPI)
// ============================================================================

/**
 * VAPI Call Webhook
 * POST /api/batch-call/webhook
 * Called by VAPI when call status changes
 */
router.post('/webhook', async (req, res) => {
  try {
    console.log('📞 Batch call webhook received:', JSON.stringify(req.body, null, 2));

    await batchCallService.handleCallWebhook(req.body);

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Batch call webhook error:', error);
    // Still return 200 to prevent VAPI retries
    res.status(200).json({ received: true, error: error.message });
  }
});

export default router;
