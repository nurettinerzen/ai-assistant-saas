// ============================================================================
// WEBHOOK ROUTES
// ============================================================================
// Handles webhooks from external services (VAPI, 11Labs, Stripe, etc.)
// ============================================================================

import express from 'express';
import { PrismaClient } from '@prisma/client';
import concurrentCallManager from '../services/concurrentCallManager.js';
import { trackCallUsage } from '../services/usageTracking.js';

const router = express.Router();
const prisma = new PrismaClient();

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
      await handleCallEnded(call);
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
    const { call_id, agent_id, metadata } = req.body;

    console.log('📞 11Labs Call Started:', call_id);

    // Extract business ID from metadata or agent
    const businessId = metadata?.business_id || await extractBusinessIdFromAgent(agent_id);

    if (!businessId) {
      console.warn('⚠️ No businessId found for call:', call_id);
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
// 11LABS CALL-ENDED WEBHOOK
// ============================================================================
router.post('/elevenlabs/call-ended', async (req, res) => {
  try {
    const {
      call_id,
      agent_id,
      duration_seconds,
      start_time,
      end_time,
      metadata,
      transcript,
      analysis
    } = req.body;

    console.log('📊 11Labs Call Ended:', call_id, 'Duration:', duration_seconds, 's');

    // Extract business ID
    const businessId = metadata?.business_id || await extractBusinessIdFromAgent(agent_id);

    if (!businessId) {
      console.warn('⚠️ No businessId found for call:', call_id);
      return res.json({ success: true, warning: 'business_id not found' });
    }

    // 1. Release concurrent call slot
    await concurrentCallManager.releaseSlot(businessId);
    console.log('✅ Call slot released for business:', businessId);

    // 2. Track minute usage
    const usageResult = await trackCallUsage(businessId, duration_seconds || 0, {
      callId: call_id,
      channel: 'phone'
    });

    console.log('📊 Usage tracked:', {
      fromPackage: usageResult?.fromPackage,
      fromCredit: usageResult?.fromCredit,
      fromOverage: usageResult?.fromOverage
    });

    // 3. Create call log
    await createCallLog(businessId, {
      callId: call_id,
      agentId: agent_id,
      duration: duration_seconds,
      startTime: start_time,
      endTime: end_time,
      transcript,
      analysis,
      metadata
    });

    res.json({
      success: true,
      usage: {
        durationMinutes: Math.ceil((duration_seconds || 0) / 60),
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

/**
 * Extract business ID from 11Labs agent ID
 */
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

/**
 * Create call log from 11Labs data
 */
async function createCallLog(businessId, data) {
  try {
    const transcriptText = Array.isArray(data.transcript)
      ? data.transcript.map(t => `${t.speaker}: ${t.text}`).join('\n')
      : typeof data.transcript === 'string'
        ? data.transcript
        : '';

    await prisma.callLog.create({
      data: {
        businessId,
        callId: data.callId,
        callerId: data.metadata?.caller_id || 'unknown',
        duration: data.duration || 0,
        status: 'completed',
        transcript: data.transcript || null,
        transcriptText,
        summary: data.analysis?.summary || null,
        sentiment: data.analysis?.sentiment || 'neutral',
        intent: data.analysis?.intent || null,
        keyPoints: data.analysis?.keyPoints || [],
        keyTopics: data.analysis?.keyTopics || [],
        actionItems: data.analysis?.actionItems || [],
        taskCompleted: data.analysis?.taskCompleted ?? null,
        followUpNeeded: data.analysis?.followUpNeeded ?? null
      }
    });

    console.log('✅ Call log created for call:', data.callId);
  } catch (error) {
    console.error('Error creating call log:', error);
    // Don't throw - call log creation failure shouldn't break the webhook
  }
}

// ============================================================================
// HANDLE CALL ENDED
// ============================================================================
async function handleCallEnded(call) {
  try {
    console.log('📊 Processing call-ended:', call.id);

    // Extract business ID from assistant ID or phone number
    // This needs to be implemented based on your assistant setup
    const businessId = await extractBusinessId(call);
    
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
        duration: call.duration || call.endedAt && call.startedAt 
          ? Math.floor((new Date(call.endedAt) - new Date(call.startedAt)) / 1000) 
          : 0,
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
    console.error('❌ Error handling call-ended:', error);
    throw error;
  }
}

// ============================================================================
// EXTRACT BUSINESS ID
// ============================================================================
async function extractBusinessId(call) {
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
// DETECT SENTIMENT (Simple implementation)
// ============================================================================
function detectSentiment(transcript) {
  if (!transcript) return 'neutral';
  
  const text = transcript.toLowerCase();
  
  // Positive words
  const positiveWords = ['thank', 'great', 'excellent', 'perfect', 'happy', 'good', 'wonderful', 'amazing'];
  const positiveCount = positiveWords.filter(word => text.includes(word)).length;
  
  // Negative words
  const negativeWords = ['bad', 'terrible', 'awful', 'angry', 'frustrated', 'disappointed', 'problem', 'issue'];
  const negativeCount = negativeWords.filter(word => text.includes(word)).length;
  
  if (positiveCount > negativeCount + 1) return 'positive';
  if (negativeCount > positiveCount + 1) return 'negative';
  return 'neutral';
}

// ============================================================================
// GENERATE SUMMARY (Simple implementation)
// ============================================================================
function generateSummary(transcript) {
  if (!transcript) return 'No transcript available';
  
  // Take first 150 characters as summary
  const summary = transcript.substring(0, 150).trim();
  return summary.length < transcript.length ? summary + '...' : summary;
}

// ============================================================================
// TRIGGER ZAPIER WEBHOOK
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
