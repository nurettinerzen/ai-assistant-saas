/**
 * Email Channel Routes
 * OAuth, Threads, Messages, and Drafts management
 */

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';
import gmailService from '../services/gmail.js';
import outlookService from '../services/outlook.js';
import emailAggregator from '../services/email-aggregator.js';
import emailAI from '../services/email-ai.js';

const router = express.Router();
const prisma = new PrismaClient();

// ==================== OAUTH ROUTES ====================

/**
 * Gmail OAuth - Get Auth URL
 * GET /api/email/gmail/auth
 */
router.get('/gmail/auth', authenticateToken, async (req, res) => {
  try {
    // Check if already connected to a different provider
    const existing = await prisma.emailIntegration.findUnique({
      where: { businessId: req.businessId }
    });

    if (existing && existing.connected && existing.provider !== 'GMAIL') {
      return res.status(400).json({
        error: 'Another email provider is already connected. Please disconnect it first.'
      });
    }

    const authUrl = gmailService.getAuthUrl(req.businessId);
    res.json({ authUrl });
  } catch (error) {
    console.error('Gmail auth error:', error);
    res.status(500).json({ error: 'Failed to generate Gmail auth URL' });
  }
});

/**
 * Gmail OAuth Callback
 * GET /api/email/gmail/callback
 */
router.get('/gmail/callback', async (req, res) => {
  try {
    const { code, state, error: oauthError } = req.query;

    if (oauthError) {
      console.error('Gmail OAuth error:', oauthError);
      return res.redirect(`${process.env.FRONTEND_URL}/dashboard/integrations?error=gmail-denied`);
    }

    if (!code || !state) {
      return res.redirect(`${process.env.FRONTEND_URL}/dashboard/integrations?error=gmail-invalid`);
    }

    const businessId = parseInt(state);

    await gmailService.handleCallback(code, businessId);

    console.log(`Gmail connected for business ${businessId}`);

    // Trigger style analysis in background
    import('../services/email-style-analyzer.js').then((module) => {
      module.analyzeWritingStyle(businessId).catch((err) => {
        console.error('Background style analysis failed:', err);
      });
    });

    res.redirect(`${process.env.FRONTEND_URL}/dashboard/integrations?success=gmail`);
  } catch (error) {
    console.error('Gmail callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/dashboard/integrations?error=gmail-failed`);
  }
});

/**
 * Outlook OAuth - Get Auth URL
 * GET /api/email/outlook/auth
 */
router.get('/outlook/auth', authenticateToken, async (req, res) => {
  try {
    // Check if already connected to a different provider
    const existing = await prisma.emailIntegration.findUnique({
      where: { businessId: req.businessId }
    });

    if (existing && existing.connected && existing.provider !== 'OUTLOOK') {
      return res.status(400).json({
        error: 'Another email provider is already connected. Please disconnect it first.'
      });
    }

    const authUrl = outlookService.getAuthUrl(req.businessId);
    res.json({ authUrl });
  } catch (error) {
    console.error('Outlook auth error:', error);
    res.status(500).json({ error: 'Failed to generate Outlook auth URL' });
  }
});

/**
 * Outlook OAuth Callback
 * GET /api/email/outlook/callback
 */
router.get('/outlook/callback', async (req, res) => {
  try {
    const { code, state, error: oauthError } = req.query;

    if (oauthError) {
      console.error('Outlook OAuth error:', oauthError);
      return res.redirect(`${process.env.FRONTEND_URL}/dashboard/integrations?error=outlook-denied`);
    }

    if (!code || !state) {
      return res.redirect(`${process.env.FRONTEND_URL}/dashboard/integrations?error=outlook-invalid`);
    }

    const businessId = parseInt(state);

    await outlookService.handleCallback(code, businessId);

    console.log(`Outlook connected for business ${businessId}`);

    // Trigger style analysis in background
    import('../services/email-style-analyzer.js').then((module) => {
      module.analyzeWritingStyle(businessId).catch((err) => {
        console.error('Background style analysis failed:', err);
      });
    });

    res.redirect(`${process.env.FRONTEND_URL}/dashboard/integrations?success=outlook`);
  } catch (error) {
    console.error('Outlook callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/dashboard/integrations?error=outlook-failed`);
  }
});

/**
 * Disconnect Email
 * POST /api/email/disconnect
 */
router.post('/disconnect', authenticateToken, async (req, res) => {
  try {
    await emailAggregator.disconnect(req.businessId);
    res.json({ success: true, message: 'Email disconnected successfully' });
  } catch (error) {
    console.error('Disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect email' });
  }
});

/**
 * Get Email Connection Status
 * GET /api/email/status
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const status = await emailAggregator.getStatus(req.businessId);
    res.json(status);
  } catch (error) {
    console.error('Status error:', error);
    res.status(500).json({ error: 'Failed to get email status' });
  }
});

// ==================== THREAD ROUTES ====================

/**
 * Get Thread List
 * GET /api/email/threads
 */
router.get('/threads', authenticateToken, async (req, res) => {
  try {
    const { status, limit = 20, offset = 0 } = req.query;

    const { threads, total } = await emailAggregator.getThreadsFromDb(
      req.businessId,
      {
        status,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    );

    res.json({
      threads,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Get threads error:', error);
    res.status(500).json({ error: 'Failed to get threads' });
  }
});

/**
 * Get Single Thread
 * GET /api/email/threads/:threadId
 */
router.get('/threads/:threadId', authenticateToken, async (req, res) => {
  try {
    const thread = await emailAggregator.getThreadFromDb(
      req.businessId,
      req.params.threadId
    );

    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    res.json(thread);
  } catch (error) {
    console.error('Get thread error:', error);
    res.status(500).json({ error: 'Failed to get thread' });
  }
});

/**
 * Close Thread
 * POST /api/email/threads/:threadId/close
 */
router.post('/threads/:threadId/close', authenticateToken, async (req, res) => {
  try {
    const thread = await prisma.emailThread.findFirst({
      where: {
        id: req.params.threadId,
        businessId: req.businessId
      }
    });

    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    await emailAggregator.updateThreadStatus(thread.id, 'CLOSED');

    res.json({ success: true, message: 'Thread closed' });
  } catch (error) {
    console.error('Close thread error:', error);
    res.status(500).json({ error: 'Failed to close thread' });
  }
});

/**
 * Update Thread Status (Manual Tagging)
 * PATCH /api/email/threads/:threadId
 * Allows user to manually set thread status (e.g., NO_REPLY_NEEDED)
 */
router.patch('/threads/:threadId', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['PENDING_REPLY', 'NO_REPLY_NEEDED', 'CLOSED'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const thread = await prisma.emailThread.findFirst({
      where: {
        id: req.params.threadId,
        businessId: req.businessId
      }
    });

    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    await emailAggregator.updateThreadStatus(thread.id, status);

    res.json({ success: true, message: `Thread status updated to ${status}` });
  } catch (error) {
    console.error('Update thread status error:', error);
    res.status(500).json({ error: 'Failed to update thread status' });
  }
});

// ==================== DRAFT ROUTES ====================

/**
 * Get Pending Drafts
 * GET /api/email/drafts
 */
router.get('/drafts', authenticateToken, async (req, res) => {
  try {
    const drafts = await emailAI.getPendingDrafts(req.businessId);
    res.json({ drafts });
  } catch (error) {
    console.error('Get drafts error:', error);
    res.status(500).json({ error: 'Failed to get drafts' });
  }
});

/**
 * Get Single Draft
 * GET /api/email/drafts/:draftId
 */
router.get('/drafts/:draftId', authenticateToken, async (req, res) => {
  try {
    const draft = await emailAI.getDraft(req.params.draftId);

    if (!draft || draft.businessId !== req.businessId) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    res.json(draft);
  } catch (error) {
    console.error('Get draft error:', error);
    res.status(500).json({ error: 'Failed to get draft' });
  }
});

/**
 * Update Draft Content
 * PUT /api/email/drafts/:draftId
 */
router.put('/drafts/:draftId', authenticateToken, async (req, res) => {
  try {
    const { content } = req.body;

    const draft = await emailAI.getDraft(req.params.draftId);

    if (!draft || draft.businessId !== req.businessId) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    const updated = await emailAI.updateDraft(req.params.draftId, content);
    res.json(updated);
  } catch (error) {
    console.error('Update draft error:', error);
    res.status(500).json({ error: 'Failed to update draft' });
  }
});

/**
 * Approve Draft
 * POST /api/email/drafts/:draftId/approve
 */
router.post('/drafts/:draftId/approve', authenticateToken, async (req, res) => {
  try {
    const draft = await emailAI.getDraft(req.params.draftId);

    if (!draft || draft.businessId !== req.businessId) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    const approved = await emailAI.approveDraft(req.params.draftId, req.userId);
    res.json(approved);
  } catch (error) {
    console.error('Approve draft error:', error);
    res.status(500).json({ error: 'Failed to approve draft' });
  }
});

/**
 * Send Draft
 * POST /api/email/drafts/:draftId/send
 */
router.post('/drafts/:draftId/send', authenticateToken, async (req, res) => {
  try {
    const draft = await emailAI.getDraft(req.params.draftId);

    if (!draft || draft.businessId !== req.businessId) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    const thread = draft.thread;
    const content = draft.editedContent || draft.generatedContent;

    // Get the email integration to find connected email
    const integration = await emailAggregator.getIntegration(req.businessId);

    // Build reply options
    const options = {
      threadId: thread.threadId,
      conversationId: thread.threadId // For Outlook
    };

    // If replying to a specific message, include reference
    if (draft.message) {
      options.inReplyTo = draft.message.messageId;
      options.replyToId = draft.message.messageId;
    }

    // Send the email
    const result = await emailAggregator.sendMessage(
      req.businessId,
      thread.customerEmail,
      `Re: ${thread.subject}`,
      content,
      options
    );

    // Save the sent message to database
    await prisma.emailMessage.upsert({
      where: {
        threadId_messageId: {
          threadId: thread.id,
          messageId: result.messageId || `sent-${Date.now()}-${Math.random().toString(36).substring(7)}`
        }
      },
      update: {
        status: 'SENT',
        sentAt: new Date()
      },
      create: {
        threadId: thread.id,
        messageId: result.messageId || `sent-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        direction: 'OUTBOUND',
        fromEmail: integration.email,
        fromName: null,
        toEmail: thread.customerEmail,
        subject: `Re: ${thread.subject}`,
        bodyText: content,
        bodyHtml: content,
        status: 'SENT',
        sentAt: new Date()
      }
    });

    // Update draft status to SENT
    await prisma.emailDraft.update({
      where: { id: draft.id },
      data: {
        status: 'SENT',
        sentAt: new Date()
      }
    });

    // Update thread status to REPLIED
    await prisma.emailThread.update({
      where: { id: thread.id },
      data: { status: 'REPLIED' }
    });

    res.json({
      success: true,
      message: 'Email sent successfully',
      messageId: result.messageId
    });
  } catch (error) {
    console.error('Send draft error:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

/**
 * Reject Draft
 * POST /api/email/drafts/:draftId/reject
 */
router.post('/drafts/:draftId/reject', authenticateToken, async (req, res) => {
  try {
    const draft = await emailAI.getDraft(req.params.draftId);

    if (!draft || draft.businessId !== req.businessId) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    const rejected = await emailAI.rejectDraft(req.params.draftId, req.userId);
    res.json(rejected);
  } catch (error) {
    console.error('Reject draft error:', error);
    res.status(500).json({ error: 'Failed to reject draft' });
  }
});

/**
 * Generate Draft Manually for a Thread
 * POST /api/email/threads/:threadId/generate-draft
 * Use this to manually create a draft for emails that were auto-classified as NO_REPLY_NEEDED
 */
router.post('/threads/:threadId/generate-draft', authenticateToken, async (req, res) => {
  try {
    const { threadId } = req.params;

    // Get thread with latest inbound message
    const thread = await prisma.emailThread.findFirst({
      where: {
        id: threadId,
        businessId: req.businessId
      }
    });

    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    // Get the latest inbound message from this thread
    const latestInbound = await prisma.emailMessage.findFirst({
      where: {
        threadId: thread.id,
        direction: 'INBOUND'
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!latestInbound) {
      return res.status(400).json({ error: 'No inbound message found in this thread' });
    }

    // Check if draft already exists
    const existingDraft = await prisma.emailDraft.findFirst({
      where: {
        threadId: thread.id,
        status: 'PENDING_REVIEW'
      }
    });

    if (existingDraft) {
      return res.status(400).json({
        error: 'A pending draft already exists for this thread',
        draftId: existingDraft.id
      });
    }

    // Generate draft
    const draft = await emailAI.generateDraft(req.businessId, thread, latestInbound);

    // Update thread status
    await prisma.emailThread.update({
      where: { id: thread.id },
      data: { status: 'DRAFT_READY' }
    });

    res.json({
      success: true,
      message: 'Draft generated successfully',
      draft
    });
  } catch (error) {
    console.error('Manual draft generation error:', error);
    res.status(500).json({ error: 'Failed to generate draft' });
  }
});

/**
 * Regenerate Draft
 * POST /api/email/drafts/:draftId/regenerate
 */
router.post('/drafts/:draftId/regenerate', authenticateToken, async (req, res) => {
  try {
    const { feedback } = req.body;

    const draft = await emailAI.getDraft(req.params.draftId);

    if (!draft || draft.businessId !== req.businessId) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    const regenerated = await emailAI.regenerateDraft(req.params.draftId, feedback);
    res.json(regenerated);
  } catch (error) {
    console.error('Regenerate draft error:', error);
    res.status(500).json({ error: 'Failed to regenerate draft' });
  }
});

// ==================== SYNC ROUTES ====================

/**
 * Manual Sync
 * POST /api/email/sync
 *
 * NOTE: This route ONLY syncs emails - NO automatic draft generation.
 * Draft generation is 100% manual via the generate-draft endpoint.
 */
router.post('/sync', authenticateToken, async (req, res) => {
  try {
    const status = await emailAggregator.getStatus(req.businessId);

    if (!status.connected) {
      return res.status(400).json({ error: 'No email provider connected' });
    }

    // Get new messages from provider
    const newMessages = await emailAggregator.syncNewMessages(req.businessId);

    // Get connected email to determine direction
    const integration = await emailAggregator.getIntegration(req.businessId);
    const connectedEmail = integration.email;

    let processedCount = 0;

    for (const message of newMessages) {
      // Determine direction
      const direction = message.from.email.toLowerCase() === connectedEmail.toLowerCase()
        ? 'OUTBOUND'
        : 'INBOUND';

      // Save to database
      const { thread, isNew } = await emailAggregator.saveMessageToDb(
        req.businessId,
        message,
        direction
      );

      if (isNew) {
        processedCount++;

        // For OUTBOUND messages (sent by user via external app), mark thread as REPLIED
        if (direction === 'OUTBOUND' && thread.status !== 'REPLIED') {
          await prisma.emailThread.update({
            where: { id: thread.id },
            data: { status: 'REPLIED' }
          });
          console.log(`[Email Sync] Thread ${thread.id} marked as REPLIED (outbound message detected)`);
        }
        // For INBOUND messages, keep status as PENDING_REPLY (default)
        // User will manually generate drafts or mark as no-reply-needed
      }
    }

    res.json({
      success: true,
      message: `Synced ${processedCount} new messages`,
      processedCount
    });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Failed to sync messages' });
  }
});

// ==================== STATS ROUTES ====================

/**
 * Get Email Stats
 * GET /api/email/stats
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      newCount,
      pendingCount,
      draftReadyCount,
      repliedCount,
      repliedTodayCount,
      noReplyNeededCount,
      totalThreads
    ] = await Promise.all([
      // NEW status (new emails without any action)
      prisma.emailThread.count({
        where: {
          businessId: req.businessId,
          status: 'NEW'
        }
      }),
      // PENDING_REPLY (legacy - kept for backward compatibility)
      prisma.emailThread.count({
        where: {
          businessId: req.businessId,
          status: 'PENDING_REPLY'
        }
      }),
      // DRAFT_READY (AI draft generated)
      prisma.emailThread.count({
        where: {
          businessId: req.businessId,
          status: 'DRAFT_READY'
        }
      }),
      // Total REPLIED count
      prisma.emailThread.count({
        where: {
          businessId: req.businessId,
          status: 'REPLIED'
        }
      }),
      // Replied today count
      prisma.emailThread.count({
        where: {
          businessId: req.businessId,
          status: 'REPLIED',
          updatedAt: { gte: today }
        }
      }),
      // NO_REPLY_NEEDED
      prisma.emailThread.count({
        where: {
          businessId: req.businessId,
          status: 'NO_REPLY_NEEDED'
        }
      }),
      // Total threads
      prisma.emailThread.count({
        where: { businessId: req.businessId }
      })
    ]);

    res.json({
      newCount,
      pendingCount,
      draftReadyCount,
      repliedCount,
      repliedTodayCount,
      noReplyNeededCount,
      totalThreads
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// ==================== WEBHOOK ROUTES ====================

/**
 * Gmail Push Notification Webhook
 * POST /api/email/webhook/gmail
 */
router.post('/webhook/gmail', async (req, res) => {
  try {
    // Gmail sends base64 encoded data
    const message = req.body.message;
    if (message && message.data) {
      const data = JSON.parse(Buffer.from(message.data, 'base64').toString());
      console.log('Gmail webhook received:', data);
      // TODO: Process the notification and sync new messages
    }
    res.status(200).send('OK');
  } catch (error) {
    console.error('Gmail webhook error:', error);
    res.status(200).send('OK'); // Always return 200 to prevent retries
  }
});

/**
 * Outlook Subscription Webhook
 * POST /api/email/webhook/outlook
 */
router.post('/webhook/outlook', async (req, res) => {
  try {
    // Validation request
    if (req.query.validationToken) {
      return res.status(200).send(req.query.validationToken);
    }

    // Notification
    const notifications = req.body.value || [];
    console.log('Outlook webhook received:', notifications);
    // TODO: Process the notifications and sync new messages

    res.status(202).send('Accepted');
  } catch (error) {
    console.error('Outlook webhook error:', error);
    res.status(202).send('Accepted');
  }
});

// ==================== STYLE LEARNING ROUTES ====================

import { analyzeWritingStyle, getStyleProfile, reanalyzeWritingStyle } from '../services/email-style-analyzer.js';
import { classifyEmailSender, overrideClassification, getClassificationStats } from '../services/email-classifier.js';

/**
 * Get Style Profile
 * GET /api/email/style-profile
 */
router.get('/style-profile', authenticateToken, async (req, res) => {
  try {
    const profile = await getStyleProfile(req.businessId);

    if (!profile) {
      return res.status(404).json({ error: 'No email integration found' });
    }

    res.json({
      styleProfile: profile.styleProfile,
      status: profile.styleAnalysisStatus,
      analyzedAt: profile.styleAnalyzedAt,
    });
  } catch (error) {
    console.error('Get style profile error:', error);
    res.status(500).json({ error: 'Failed to get style profile' });
  }
});

/**
 * Trigger Style Analysis
 * POST /api/email/style-profile/analyze
 */
router.post('/style-profile/analyze', authenticateToken, async (req, res) => {
  try {
    // Check if integration exists
    const integration = await prisma.emailIntegration.findUnique({
      where: { businessId: req.businessId },
    });

    if (!integration || !integration.connected) {
      return res.status(400).json({ error: 'No email provider connected' });
    }

    // If already processing, don't start another
    if (integration.styleAnalysisStatus === 'PROCESSING') {
      return res.status(400).json({ error: 'Analysis is already in progress' });
    }

    // Start analysis in background
    const result = await reanalyzeWritingStyle(req.businessId);

    res.json({
      success: true,
      message: 'Style analysis started',
      status: 'PROCESSING',
    });
  } catch (error) {
    console.error('Trigger style analysis error:', error);
    res.status(500).json({ error: 'Failed to start style analysis' });
  }
});

// ==================== SMART FILTERING ROUTES ====================

/**
 * Classify Email Sender
 * POST /api/email/classify
 */
router.post('/classify', authenticateToken, async (req, res) => {
  try {
    const { senderEmail, subject, snippet, headers } = req.body;

    if (!senderEmail) {
      return res.status(400).json({ error: 'Sender email is required' });
    }

    const result = await classifyEmailSender(req.businessId, senderEmail, {
      subject,
      snippet,
      headers,
    });

    res.json(result);
  } catch (error) {
    console.error('Classify email error:', error);
    res.status(500).json({ error: 'Failed to classify email' });
  }
});

/**
 * Override Classification
 * POST /api/email/classify/override
 */
router.post('/classify/override', authenticateToken, async (req, res) => {
  try {
    const { senderEmail, classification } = req.body;

    if (!senderEmail || !classification) {
      return res.status(400).json({ error: 'Sender email and classification are required' });
    }

    if (!['PERSONAL', 'AUTOMATED'].includes(classification)) {
      return res.status(400).json({ error: 'Invalid classification. Must be PERSONAL or AUTOMATED' });
    }

    const result = await overrideClassification(req.businessId, senderEmail, classification);

    res.json({
      success: true,
      message: 'Classification updated',
      result,
    });
  } catch (error) {
    console.error('Override classification error:', error);
    res.status(500).json({ error: 'Failed to override classification' });
  }
});

/**
 * Get Classification Stats
 * GET /api/email/classify/stats
 */
router.get('/classify/stats', authenticateToken, async (req, res) => {
  try {
    const stats = await getClassificationStats(req.businessId);

    const summary = {
      total: 0,
      personal: 0,
      automated: 0,
      bySource: {
        heuristic: 0,
        ai: 0,
        userOverride: 0,
      },
    };

    for (const stat of stats) {
      summary.total += stat._count;
      if (stat.classification === 'PERSONAL') {
        summary.personal += stat._count;
      } else {
        summary.automated += stat._count;
      }
      if (stat.classifiedBy === 'HEURISTIC') {
        summary.bySource.heuristic += stat._count;
      } else if (stat.classifiedBy === 'AI') {
        summary.bySource.ai += stat._count;
      } else {
        summary.bySource.userOverride += stat._count;
      }
    }

    res.json(summary);
  } catch (error) {
    console.error('Get classification stats error:', error);
    res.status(500).json({ error: 'Failed to get classification stats' });
  }
});

export default router;
