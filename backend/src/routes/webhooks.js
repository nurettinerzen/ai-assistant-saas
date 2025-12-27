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
// 11LABS CALL-STARTED WEBHOOK (Conversation Initiation)
// This webhook is called when a call starts - for inbound calls, we need to
// verify that an inbound assistant is configured for this phone number
// ============================================================================
router.post('/elevenlabs/call-started', async (req, res) => {
  try {
    // Log raw payload for debugging
    console.log('📥 11Labs call-started RAW payload:', JSON.stringify(req.body, null, 2));

    // 11Labs webhook structure: { type, data: { ... } }
    const { type, data } = req.body;

    // Extract fields from data (if wrapped) or directly from body
    const callData = data || req.body;
    const {
      conversation_id,
      agent_id,
      metadata
    } = callData;

    // Extract phone call info
    const phoneCallInfo = callData.phone_call || metadata?.phone_call || {};
    const callDirection = phoneCallInfo.direction; // 'inbound' or 'outbound'
    const agentPhoneId = phoneCallInfo.agent_phone_number_id; // 11Labs phone ID
    const externalNumber = phoneCallInfo.external_number; // Caller's number (for inbound)

    const callId = conversation_id || callData.call_id;
    const agentId = agent_id;

    console.log('📞 11Labs Call Started:', {
      callId,
      direction: callDirection,
      agentPhoneId,
      externalNumber
    });

    // =========================================================================
    // INBOUND CALL CHECK - Verify inbound assistant is configured
    // =========================================================================
    if (callDirection === 'inbound') {
      console.log('📞 Inbound call detected, checking for inbound assistant...');

      // Find the phone number by 11Labs phone ID
      const phoneNumber = await prisma.phoneNumber.findFirst({
        where: { elevenLabsPhoneId: agentPhoneId },
        include: {
          assistant: {
            select: { id: true, name: true, isActive: true, elevenLabsAgentId: true }
          }
        }
      });

      if (!phoneNumber) {
        console.warn('⚠️ Phone number not found for 11Labs phone ID:', agentPhoneId);
        // Let the call proceed - may be configured differently
      } else if (!phoneNumber.assistant) {
        // No inbound assistant configured - reject the call
        console.warn('❌ No inbound assistant configured for phone:', phoneNumber.phoneNumber);
        return res.status(403).json({
          success: false,
          error: 'NO_INBOUND_ASSISTANT',
          message: 'Bu numara için gelen arama asistanı yapılandırılmamış. / No inbound assistant configured for this number.',
          action: 'reject_call'
        });
      } else if (!phoneNumber.assistant.isActive) {
        // Inbound assistant is not active - reject the call
        console.warn('❌ Inbound assistant is not active for phone:', phoneNumber.phoneNumber);
        return res.status(403).json({
          success: false,
          error: 'INBOUND_ASSISTANT_INACTIVE',
          message: 'Gelen arama asistanı aktif değil. / Inbound assistant is not active.',
          action: 'reject_call'
        });
      } else {
        console.log(`✅ Inbound assistant found: ${phoneNumber.assistant.name} (${phoneNumber.assistant.id})`);

        // IMPORTANT: For inbound calls, we should use the inbound assistant's agent_id
        // If 11Labs is using a different agent (outbound), we need to signal which agent to use
        // This may require returning the correct agent_id in the response
      }
    }

    // =========================================================================
    // Extract business ID
    // =========================================================================
    let businessId = metadata?.business_id;

    // Try to parse as integer if it's a string
    if (businessId && typeof businessId === 'string') {
      businessId = parseInt(businessId, 10);
    }

    // Fallback: find from agent
    if (!businessId) {
      businessId = await extractBusinessIdFromAgent(agentId);
    }

    // Fallback: find from phone number
    if (!businessId && agentPhoneId) {
      const phoneNumber = await prisma.phoneNumber.findFirst({
        where: { elevenLabsPhoneId: agentPhoneId },
        select: { businessId: true }
      });
      businessId = phoneNumber?.businessId;
    }

    if (!businessId) {
      console.warn('⚠️ No businessId found for call:', callId);
      return res.json({ success: true, warning: 'business_id not found' });
    }

    // =========================================================================
    // Acquire concurrent call slot
    // =========================================================================
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

    // Update BatchCall recipient if this is a batch call (outbound only)
    if (callDirection === 'outbound' && metadata?.recipient_id) {
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
    console.log(`✅ Call slot acquired: ${slotResult.currentActive}/${slotResult.limit} (${callDirection || 'unknown'} call)`);

    res.json({
      success: true,
      direction: callDirection,
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

    // 11Labs post-call webhook structure:
    // { type: "post_call_transcription", data: { conversation_id, agent_id, status, metadata: { call_duration_secs, ... } } }
    const { type, data } = req.body;

    // Extract fields from data wrapper
    const callData = data || req.body;
    const {
      conversation_id,
      agent_id,
      status,
      transcript,
      analysis
    } = callData;

    // Duration is inside metadata, not at root level
    const callMetadata = callData.metadata || {};
    const durationSeconds = callMetadata.call_duration_secs || callData.call_duration_secs || 0;

    // Phone call info from 11Labs metadata
    const phoneCallInfo = callMetadata.phone_call || {};
    const externalNumber = phoneCallInfo.external_number; // The external party's number
    const agentPhoneNumber = phoneCallInfo.agent_phone_number; // Our phone number
    const agentPhoneId = phoneCallInfo.agent_phone_number_id; // 11Labs phone ID
    const callDirection = phoneCallInfo.direction; // 'inbound' or 'outbound'

    // Batch call info from 11Labs metadata
    const batchCallInfo = callMetadata.batch_call || {};
    const elevenLabsBatchId = batchCallInfo.batch_call_id;
    const elevenLabsRecipientId = batchCallInfo.batch_call_recipient_id;

    // Our custom metadata (sent via conversation_initiation_client_data)
    const customMetadata = callMetadata.custom || callMetadata;

    const callId = conversation_id || callData.call_id;
    const agentId = agent_id;

    console.log('📊 11Labs Call Ended:', {
      callId,
      duration: durationSeconds + 's',
      status,
      direction: callDirection,
      externalNumber,
      agentPhoneNumber,
      elevenLabsBatchId,
      elevenLabsRecipientId
    });

    // Extract business ID - try multiple methods
    let businessId = customMetadata?.business_id;

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
        channel: customMetadata?.channel || 'phone'
      });

      console.log('📊 Usage tracked:', {
        durationMinutes: Math.ceil(durationSeconds / 60),
        fromPackage: usageResult?.fromPackage,
        fromCredit: usageResult?.fromCredit,
        fromOverage: usageResult?.fromOverage
      });
    } else {
      console.log('⚠️ Duration is 0, skipping usage tracking');
    }

    // 3. Update BatchCall recipient - try multiple methods
    const callStatus = status === 'done' ? 'completed' : 'failed';

    // Method A: Use our custom metadata (batch_call_id, recipient_id)
    if (customMetadata?.batch_call_id) {
      try {
        await updateBatchCallRecipientStatus(
          customMetadata.batch_call_id,
          customMetadata.recipient_id,
          callStatus,
          {
            duration: durationSeconds,
            completedAt: new Date(),
            elevenLabsConversationId: callId,
            transcript: transcript,
            analysis: analysis
          }
        );
        await updateBatchCallProgress(customMetadata.batch_call_id);
      } catch (err) {
        console.error('Failed to update batch call recipient (method A):', err);
      }
    }
    // Method B: Find by phone number (fallback)
    else if (externalNumber) {
      try {
        await updateBatchCallRecipientByPhone(externalNumber, callStatus, {
          duration: durationSeconds,
          completedAt: new Date(),
          elevenLabsConversationId: callId,
          transcript: transcript
        });
      } catch (err) {
        console.error('Failed to update batch call recipient (method B):', err);
      }
    }

    // 4. Create call log with full details
    const callLog = await createCallLog(businessId, {
      callId: callId,
      agentId: agentId,
      duration: durationSeconds,
      transcript,
      analysis,
      // Phone info for caller display - use external number as it's the customer
      callerNumber: externalNumber,
      calledNumber: agentPhoneNumber,
      direction: callDirection || 'unknown',
      metadata: { ...callMetadata, ...customMetadata }
    });

    // 5. Update batch call recipient with callLogId for "Listen" button
    if (callLog && customMetadata?.batch_call_id) {
      try {
        await updateBatchCallRecipientStatus(
          customMetadata.batch_call_id,
          customMetadata.recipient_id,
          callStatus,
          {
            callLogId: callLog.id
          }
        );
      } catch (err) {
        console.error('Failed to update batch call recipient with callLogId:', err);
      }
    }

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
// HELPER: Update BatchCall recipient by phone number (fallback method)
// ============================================================================
async function updateBatchCallRecipientByPhone(phoneNumber, status, additionalData = {}) {
  if (!phoneNumber) return;

  try {
    // Normalize phone number - get last 10 digits
    const normalizedPhone = phoneNumber.replace(/\D/g, '').slice(-10);

    console.log(`🔍 Looking for recipient with phone ending in: ${normalizedPhone}`);

    // Find recent batch calls that are IN_PROGRESS
    const recentBatchCalls = await prisma.batchCall.findMany({
      where: {
        status: 'IN_PROGRESS',
        startedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      orderBy: { startedAt: 'desc' },
      take: 10
    });

    for (const batchCall of recentBatchCalls) {
      let recipients = [];
      try {
        recipients = JSON.parse(batchCall.recipients || '[]');
      } catch (e) {
        continue;
      }

      // Find recipient by phone number
      const recipientIndex = recipients.findIndex(r => {
        const recipientPhone = (r.phone_number || '').replace(/\D/g, '');
        return recipientPhone.endsWith(normalizedPhone) &&
               (!r.status || r.status === 'pending' || r.status === 'in_progress');
      });

      if (recipientIndex >= 0) {
        // Update recipient
        recipients[recipientIndex] = {
          ...recipients[recipientIndex],
          status,
          ...additionalData
        };

        await prisma.batchCall.update({
          where: { id: batchCall.id },
          data: {
            recipients: JSON.stringify(recipients)
          }
        });

        console.log(`✅ BatchCall recipient updated by phone: ${phoneNumber} -> ${status}`);

        // Update batch call progress
        await updateBatchCallProgress(batchCall.id);

        return; // Found and updated, exit
      }
    }

    console.log(`⚠️ No pending recipient found for phone: ${phoneNumber}`);
  } catch (error) {
    console.error('Error updating batch call recipient by phone:', error);
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
    // Format transcript - handle 11Labs transcript format
    let transcriptText = '';
    let transcriptData = data.transcript;

    if (Array.isArray(transcriptData)) {
      // 11Labs format: [{ role: 'agent'|'user', message: '...', time_in_call_secs: 0 }]
      transcriptText = transcriptData.map(t => {
        const speaker = t.role === 'agent' ? 'Asistan' : 'Müşteri';
        const timeInSecs = t.time_in_call_secs || 0;
        const minutes = Math.floor(timeInSecs / 60);
        const seconds = Math.floor(timeInSecs % 60);
        const timeStr = `${minutes}:${String(seconds).padStart(2, '0')}`;
        return `[${timeStr}] ${speaker}: ${t.message || t.text || ''}`;
      }).join('\n');
    } else if (typeof transcriptData === 'string') {
      transcriptText = transcriptData;
    }

    // Extract analysis data from 11Labs
    const analysis = data.analysis || {};

    // Get summary from various possible locations
    const summary = analysis.transcript_summary ||
                   analysis.call_summary ||
                   analysis.summary ||
                   null;

    // Get sentiment - 11Labs might return it in different formats
    let sentiment = 'neutral';
    if (analysis.user_sentiment) {
      sentiment = analysis.user_sentiment.toLowerCase();
    } else if (analysis.sentiment) {
      sentiment = analysis.sentiment.toLowerCase();
    } else if (transcriptText) {
      // Fallback: detect sentiment from transcript
      sentiment = detectSentiment(transcriptText);
    }

    // Normalize sentiment values
    if (['positive', 'happy', 'satisfied'].includes(sentiment)) {
      sentiment = 'positive';
    } else if (['negative', 'angry', 'frustrated', 'dissatisfied'].includes(sentiment)) {
      sentiment = 'negative';
    } else {
      sentiment = 'neutral';
    }

    // Determine caller ID - prioritize external number (customer's phone)
    const callerId = data.callerNumber || data.metadata?.phone_number || data.metadata?.caller_id || 'unknown';

    // Parse boolean values - 11Labs may return strings like "true"/"false"
    const parseBoolean = (val) => {
      if (val === null || val === undefined) return null;
      if (typeof val === 'boolean') return val;
      if (typeof val === 'string') {
        if (val.toLowerCase() === 'true' || val === '1') return true;
        if (val.toLowerCase() === 'false' || val === '0') return false;
      }
      return null;
    };

    const taskCompletedRaw = analysis.call_successful ?? analysis.task_completed ?? analysis.taskCompleted;
    const followUpNeededRaw = analysis.follow_up_needed ?? analysis.followUpNeeded;

    const callLog = await prisma.callLog.create({
      data: {
        businessId,
        callId: data.callId || `call_${Date.now()}`,
        callerId: callerId,
        duration: data.duration || 0,
        status: 'completed',
        transcript: transcriptData || null,
        transcriptText,
        // Analysis fields
        summary: summary,
        sentiment: sentiment,
        intent: analysis.intent || analysis.user_intent || null,
        keyPoints: analysis.key_points || analysis.keyPoints || analysis.data_collected || [],
        keyTopics: analysis.key_topics || analysis.keyTopics || [],
        actionItems: analysis.action_items || analysis.actionItems || [],
        taskCompleted: parseBoolean(taskCompletedRaw),
        followUpNeeded: parseBoolean(followUpNeededRaw)
      }
    });

    console.log('✅ Call log created for call:', data.callId, {
      callLogId: callLog.id,
      callerId,
      duration: data.duration,
      sentiment,
      hasSummary: !!summary,
      hasTranscript: !!transcriptText
    });

    return callLog;
  } catch (error) {
    console.error('Error creating call log:', error);
    // Don't throw - call log creation failure shouldn't break the webhook
    return null;
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
