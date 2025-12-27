// ============================================================================
// WEBHOOK ROUTES - 11Labs & VAPI Integration
// ============================================================================
// Handles webhooks from external services (11Labs, VAPI, Stripe, etc.)
// ============================================================================

import express from 'express';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import concurrentCallManager from '../services/concurrentCallManager.js';
import { trackCallUsage } from '../services/usageTracking.js';

const router = express.Router();
const prisma = new PrismaClient();

// ============================================================================
// WEBHOOK SIGNATURE VERIFICATION
// ============================================================================

/**
 * Verify 11Labs webhook signature
 * @param {Object} req - Express request
 * @returns {boolean} - Whether signature is valid
 */
function verifyElevenLabsSignature(req) {
  const webhookSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.warn('⚠️ ELEVENLABS_WEBHOOK_SECRET not configured - skipping signature verification');
    return true; // Skip verification if secret not configured
  }

  const signature = req.headers['elevenlabs-signature'];
  if (!signature) {
    console.warn('⚠️ No elevenlabs-signature header found');
    return false;
  }

  try {
    // Parse signature: "t=timestamp,v0=hash"
    const parts = signature.split(',');
    const timestampPart = parts.find(p => p.startsWith('t='));
    const hashPart = parts.find(p => p.startsWith('v0='));

    if (!timestampPart || !hashPart) {
      console.warn('⚠️ Invalid signature format');
      return false;
    }

    const timestamp = timestampPart.split('=')[1];
    const receivedHash = hashPart.split('=')[1];

    // Create signed payload
    const payload = `${timestamp}.${JSON.stringify(req.body)}`;
    const expectedHash = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');

    return receivedHash === expectedHash;
  } catch (error) {
    console.error('❌ Signature verification error:', error);
    return false;
  }
}

// ============================================================================
// VAPI WEBHOOK (Legacy - deprecated, use 11Labs)
// ============================================================================
router.post('/vapi', async (req, res) => {
  try {
    const { type, call } = req.body;

    console.log('📞 VAPI Webhook received:', type);
    console.log('Call data:', JSON.stringify(call, null, 2));

    // Handle call-ended event
    if (type === 'call-ended' || type === 'end-of-call-report') {
      await handleVapiCallEnded(call);
    }

    // Handle call-started event
    if (type === 'call-start') {
      console.log('✅ Call started:', call.id);
    }

    // Respond immediately to VAPI
    res.json({ success: true, received: true });

  } catch (error) {
    console.error('❌ VAPI webhook error:', error);
    // Still return 200 to avoid retries
    res.json({ success: false, error: error.message });
  }
});

// ============================================================================
// 11LABS CALL-STARTED WEBHOOK
// ============================================================================
router.post('/elevenlabs/call-started', async (req, res) => {
  try {
    // Log raw payload for debugging
    console.log('📥 11Labs call-started RAW payload:', JSON.stringify(req.body, null, 2));

    // 11Labs post-call webhook structure: { type, data: { ... } }
    const { type, data } = req.body;

    // Extract fields from data (if wrapped) or directly from body
    const callData = data || req.body;
    const {
      conversation_id,
      agent_id,
      metadata
    } = callData;

    const callId = conversation_id || callData.call_id;
    const agentId = agent_id;

    console.log('📞 11Labs Call Started:', callId);

    // Extract business ID from metadata or agent
    let businessId = metadata?.business_id;

    // Try to parse as integer if it's a string
    if (businessId && typeof businessId === 'string') {
      businessId = parseInt(businessId, 10);
    }

    // Fallback: find from agent
    if (!businessId) {
      businessId = await extractBusinessIdFromAgent(agentId);
    }

    if (!businessId) {
      console.warn('⚠️ No businessId found for call:', callId);
      return res.json({ success: true, warning: 'business_id not found' });
    }

    // Acquire concurrent call slot
    const slotResult = await concurrentCallManager.acquireSlot(businessId);

    if (!slotResult.success) {
      console.log(`⚠️ Concurrent limit exceeded for business ${businessId}`);
      // Return 429 to indicate limit exceeded
      return res.status(429).json({
        success: false,
        error: slotResult.error,
        message: slotResult.message,
        currentActive: slotResult.currentActive,
        limit: slotResult.limit
      });
    }

    // Update BatchCall recipient if this is a batch call
    if (metadata?.recipient_id) {
      try {
        await updateBatchCallRecipientStatus(metadata.batch_call_id, metadata.recipient_id, 'in_progress', {
          elevenLabsCallId: callId,
          startedAt: new Date()
        });
      } catch (err) {
        console.error('Failed to update batch call recipient:', err);
      }
    }

    // Log the call start
    console.log(`✅ Call slot acquired: ${slotResult.currentActive}/${slotResult.limit}`);

    res.json({
      success: true,
      activeCalls: slotResult.currentActive,
      limit: slotResult.limit
    });

  } catch (error) {
    console.error('❌ 11Labs call-started webhook error:', error);
    res.json({ success: false, error: error.message });
  }
});

// ============================================================================
// 11LABS CALL-ENDED / POST-CALL WEBHOOK
// ============================================================================
router.post('/elevenlabs/call-ended', async (req, res) => {
  try {
    // Log raw payload for debugging
    console.log('📥 11Labs call-ended RAW payload:', JSON.stringify(req.body, null, 2));

    // Verify signature (optional if secret configured)
    if (process.env.ELEVENLABS_WEBHOOK_SECRET && !verifyElevenLabsSignature(req)) {
      console.warn('⚠️ Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // 11Labs post-call webhook structure can be:
    // 1. { type: "post_call_transcription", data: { ... } }
    // 2. Direct fields: { conversation_id, agent_id, ... }
    const { type, data, event_timestamp } = req.body;

    // Extract fields from data (if wrapped) or directly from body
    const callData = data || req.body;
    const {
      conversation_id,
      agent_id,
      call_duration_secs,
      duration_seconds,
      start_time,
      end_time,
      status,
      metadata,
      transcript,
      analysis
    } = callData;

    const callId = conversation_id || callData.call_id;
    const agentId = agent_id;
    const durationSeconds = call_duration_secs || duration_seconds || 0;

    console.log('📊 11Labs Call Ended:', callId, 'Duration:', durationSeconds, 's', 'Status:', status);

    // Extract business ID - try multiple methods
    let businessId = metadata?.business_id;

    // Try to parse as integer if it's a string
    if (businessId && typeof businessId === 'string') {
      businessId = parseInt(businessId, 10);
    }

    // Fallback: find from agent
    if (!businessId && agentId) {
      businessId = await extractBusinessIdFromAgent(agentId);
    }

    if (!businessId) {
      console.warn('⚠️ No businessId found for call:', callId);
      return res.json({ success: true, warning: 'business_id not found' });
    }

    console.log('📊 Processing call for business:', businessId);

    // 1. Release concurrent call slot
    await concurrentCallManager.releaseSlot(businessId);
    console.log('✅ Call slot released for business:', businessId);

    // 2. Track minute usage
    let usageResult = null;
    if (durationSeconds > 0) {
      usageResult = await trackCallUsage(businessId, durationSeconds, {
        callId: callId,
        channel: metadata?.channel || 'phone'
      });

      console.log('📊 Usage tracked:', {
        fromPackage: usageResult?.fromPackage,
        fromCredit: usageResult?.fromCredit,
        fromOverage: usageResult?.fromOverage
      });
    }

    // 3. Update BatchCall recipient if this is a batch call
    if (metadata?.recipient_id || metadata?.batch_call_id) {
      try {
        const callStatus = status === 'done' ? 'completed' : 'failed';
        await updateBatchCallRecipientStatus(
          metadata.batch_call_id,
          metadata.recipient_id,
          callStatus,
          {
            duration: durationSeconds,
            completedAt: new Date(),
            transcript: transcript,
            analysis: analysis
          }
        );

        // Update batch call progress
        await updateBatchCallProgress(metadata.batch_call_id);
      } catch (err) {
        console.error('Failed to update batch call recipient:', err);
      }
    }

    // 4. Create call log
    await createCallLog(businessId, {
      callId: callId,
      agentId: agentId,
      duration: durationSeconds,
      startTime: start_time,
      endTime: end_time,
      transcript,
      analysis,
      metadata
    });

    res.json({
      success: true,
      usage: {
        durationMinutes: Math.ceil(durationSeconds / 60),
        source: usageResult?.fromOverage > 0 ? 'overage' :
                usageResult?.fromCredit > 0 ? 'credit' : 'package',
        overageCharge: usageResult?.fromOverage > 0 ?
                       usageResult.fromOverage * (usageResult.subscription?.overageRate || 0) : 0
      }
    });

  } catch (error) {
    console.error('❌ 11Labs call-ended webhook error:', error);
    res.json({ success: false, error: error.message });
  }
});

// ============================================================================
// 11LABS POST-CALL WEBHOOK (Alternative endpoint)
// ============================================================================
router.post('/elevenlabs/post-call', async (req, res) => {
  // Forward to call-ended handler
  console.log('📥 11Labs post-call webhook - forwarding to call-ended handler');
  req.url = '/elevenlabs/call-ended';
  return router.handle(req, res, () => {
    // Call the call-ended handler directly
    return res.json({ success: true, note: 'Forwarded to call-ended handler' });
  });
});

// ============================================================================
// HELPER: Update BatchCall recipient status
// ============================================================================
async function updateBatchCallRecipientStatus(batchCallId, recipientId, status, additionalData = {}) {
  if (!batchCallId) return;

  try {
    // Get current batch call
    const batchCall = await prisma.batchCall.findUnique({
      where: { id: batchCallId }
    });

    if (!batchCall) {
      console.warn('BatchCall not found:', batchCallId);
      return;
    }

    // Parse recipients JSON
    let recipients = [];
    try {
      recipients = JSON.parse(batchCall.recipients || '[]');
    } catch (e) {
      console.error('Failed to parse recipients JSON:', e);
      return;
    }

    // Find and update the recipient
    const recipientIndex = recipients.findIndex(r =>
      r.id === recipientId ||
      r.elevenLabsCallId === additionalData.elevenLabsCallId
    );

    if (recipientIndex >= 0) {
      recipients[recipientIndex] = {
        ...recipients[recipientIndex],
        status,
        ...additionalData
      };

      // Update batch call with new recipients JSON
      await prisma.batchCall.update({
        where: { id: batchCallId },
        data: {
          recipients: JSON.stringify(recipients)
        }
      });

      console.log(`✅ BatchCall recipient updated: ${recipientId} -> ${status}`);
    }
  } catch (error) {
    console.error('Error updating batch call recipient:', error);
  }
}

// ============================================================================
// HELPER: Update BatchCall progress
// ============================================================================
async function updateBatchCallProgress(batchCallId) {
  if (!batchCallId) return;

  try {
    const batchCall = await prisma.batchCall.findUnique({
      where: { id: batchCallId }
    });

    if (!batchCall) return;

    // Parse recipients and count statuses
    let recipients = [];
    try {
      recipients = JSON.parse(batchCall.recipients || '[]');
    } catch (e) {
      return;
    }

    const completedCount = recipients.filter(r => r.status === 'completed').length;
    const failedCount = recipients.filter(r => r.status === 'failed').length;
    const successfulCount = recipients.filter(r => r.status === 'completed' && r.duration > 0).length;

    // Determine batch status
    const totalProcessed = completedCount + failedCount;
    let batchStatus = batchCall.status;

    if (totalProcessed >= recipients.length) {
      batchStatus = 'COMPLETED';
    }

    // Update batch call
    await prisma.batchCall.update({
      where: { id: batchCallId },
      data: {
        completedCalls: completedCount,
        failedCalls: failedCount,
        successfulCalls: successfulCount,
        status: batchStatus,
        ...(batchStatus === 'COMPLETED' ? { completedAt: new Date() } : {})
      }
    });

    console.log(`✅ BatchCall progress updated: ${completedCount}/${recipients.length} completed`);
  } catch (error) {
    console.error('Error updating batch call progress:', error);
  }
}

// ============================================================================
// HELPER: Extract business ID from 11Labs agent ID
// ============================================================================
async function extractBusinessIdFromAgent(agentId) {
  if (!agentId) return null;

  try {
    const assistant = await prisma.assistant.findFirst({
      where: { elevenLabsAgentId: agentId },
      select: { businessId: true }
    });
    return assistant?.businessId || null;
  } catch (error) {
    console.error('Error extracting business ID from agent:', error);
    return null;
  }
}

// ============================================================================
// HELPER: Create call log from 11Labs data
// ============================================================================
async function createCallLog(businessId, data) {
  try {
    // Format transcript
    let transcriptText = '';
    if (Array.isArray(data.transcript)) {
      transcriptText = data.transcript.map(t =>
        `${t.speaker || t.role}: ${t.text || t.message}`
      ).join('\n');
    } else if (typeof data.transcript === 'string') {
      transcriptText = data.transcript;
    }

    await prisma.callLog.create({
      data: {
        businessId,
        callId: data.callId || `call_${Date.now()}`,
        callerId: data.metadata?.caller_id || data.metadata?.phone_number || 'unknown',
        duration: data.duration || 0,
        status: 'completed',
        transcript: data.transcript || null,
        transcriptText,
        summary: data.analysis?.summary || null,
        sentiment: data.analysis?.sentiment || 'neutral',
        intent: data.analysis?.intent || null,
        keyPoints: data.analysis?.key_points || data.analysis?.keyPoints || [],
        keyTopics: data.analysis?.key_topics || data.analysis?.keyTopics || [],
        actionItems: data.analysis?.action_items || data.analysis?.actionItems || [],
        taskCompleted: data.analysis?.task_completed ?? data.analysis?.taskCompleted ?? null,
        followUpNeeded: data.analysis?.follow_up_needed ?? data.analysis?.followUpNeeded ?? null
      }
    });

    console.log('✅ Call log created for call:', data.callId);
  } catch (error) {
    console.error('Error creating call log:', error);
    // Don't throw - call log creation failure shouldn't break the webhook
  }
}

// ============================================================================
// VAPI: HANDLE CALL ENDED (Legacy)
// ============================================================================
async function handleVapiCallEnded(call) {
  try {
    console.log('📊 Processing VAPI call-ended:', call.id);

    // Extract business ID from assistant ID or phone number
    const businessId = await extractVapiBusinessId(call);

    if (!businessId) {
      console.warn('⚠️ Could not extract businessId from call');
      return;
    }

    // Extract AI analysis from call
    const analysis = call.analysis || {};
    const transcript = call.transcript || call.messages?.map(m => m.message).join('\n') || '';

    // Create CallLog entry
    const callLog = await prisma.callLog.create({
      data: {
        businessId: businessId,
        callId: call.id,
        callerId: call.customer?.number || call.phoneNumber || 'unknown',
        duration: call.duration || (call.endedAt && call.startedAt
          ? Math.floor((new Date(call.endedAt) - new Date(call.startedAt)) / 1000)
          : 0),
        status: call.status || 'completed',
        transcript: transcript,
        recordingUrl: call.recordingUrl || call.artifact?.recordingUrl,

        // AI Analysis
        intent: analysis.intent || analysis.structuredData?.intent,
        sentiment: analysis.sentiment || detectSentiment(transcript),
        summary: analysis.summary || generateSummary(transcript),
        keyPoints: analysis.keyPoints || [],
        taskCompleted: analysis.taskCompleted ?? null,
        followUpNeeded: analysis.followUpNeeded ?? null,
      }
    });

    console.log('✅ CallLog created:', callLog.id);

    // Trigger Zapier webhook if configured
    await triggerZapierWebhook(businessId, call, callLog);

  } catch (error) {
    console.error('❌ Error handling VAPI call-ended:', error);
    throw error;
  }
}

// ============================================================================
// HELPER: Extract business ID from VAPI call
// ============================================================================
async function extractVapiBusinessId(call) {
  try {
    // Method 1: From assistant ID
    if (call.assistantId) {
      const assistant = await prisma.assistant.findUnique({
        where: { vapiAssistantId: call.assistantId },
        select: { businessId: true }
      });
      if (assistant) return assistant.businessId;
    }

    // Method 2: From phone number
    if (call.phoneNumber || call.customer?.number) {
      const phoneNumber = call.phoneNumber || call.customer?.number;
      const business = await prisma.business.findFirst({
        where: {
          phoneNumbers: {
            has: phoneNumber
          }
        },
        select: { id: true }
      });
      if (business) return business.id;
    }

    return null;
  } catch (error) {
    console.error('Error extracting business ID:', error);
    return null;
  }
}

// ============================================================================
// HELPER: Detect Sentiment (Simple implementation)
// ============================================================================
function detectSentiment(transcript) {
  if (!transcript) return 'neutral';

  const text = transcript.toLowerCase();

  // Positive words (Turkish + English)
  const positiveWords = ['thank', 'great', 'excellent', 'perfect', 'happy', 'good', 'wonderful', 'amazing',
    'teşekkür', 'harika', 'mükemmel', 'güzel', 'iyi', 'süper'];
  const positiveCount = positiveWords.filter(word => text.includes(word)).length;

  // Negative words (Turkish + English)
  const negativeWords = ['bad', 'terrible', 'awful', 'angry', 'frustrated', 'disappointed', 'problem', 'issue',
    'kötü', 'berbat', 'sinir', 'sorun', 'problem', 'şikayet'];
  const negativeCount = negativeWords.filter(word => text.includes(word)).length;

  if (positiveCount > negativeCount + 1) return 'positive';
  if (negativeCount > positiveCount + 1) return 'negative';
  return 'neutral';
}

// ============================================================================
// HELPER: Generate Summary (Simple implementation)
// ============================================================================
function generateSummary(transcript) {
  if (!transcript) return 'No transcript available';

  // Take first 150 characters as summary
  const summary = transcript.substring(0, 150).trim();
  return summary.length < transcript.length ? summary + '...' : summary;
}

// ============================================================================
// HELPER: Trigger Zapier Webhook
// ============================================================================
async function triggerZapierWebhook(businessId, call, callLog) {
  try {
    // Get Zapier integration
    const integration = await prisma.integration.findFirst({
      where: {
        businessId: businessId,
        type: 'ZAPIER',
        connected: true
      }
    });

    if (!integration || !integration.credentials?.webhookUrl) {
      console.log('No Zapier webhook configured');
      return;
    }

    const webhookUrl = integration.credentials.webhookUrl;

    // Prepare payload
    const payload = {
      event: 'call_completed',
      call_id: call.id,
      duration: callLog.duration,
      transcript: callLog.transcript,
      summary: callLog.summary,
      sentiment: callLog.sentiment,
      customer_phone: callLog.callerId,
      timestamp: new Date().toISOString()
    };

    // Send to Zapier
    const axios = (await import('axios')).default;
    await axios.post(webhookUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000
    });

    console.log('✅ Zapier webhook triggered');

  } catch (error) {
    console.error('❌ Zapier webhook error:', error.message);
    // Don't throw - webhook failures shouldn't break the main flow
  }
}

// ============================================================================
// STRIPE WEBHOOK (for future use)
// ============================================================================
router.post('/stripe', async (req, res) => {
  try {
    // Stripe webhook handling
    console.log('💳 Stripe webhook received');
    res.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    res.status(400).json({ error: error.message });
  }
});

export default router;
