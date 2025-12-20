// ============================================================================
// 11LABS CONVERSATIONAL AI WEBHOOK HANDLER
// ============================================================================
// FILE: backend/src/routes/elevenlabs.js
//
// Handles 11Labs webhooks for call events and tool execution
// Replaces VAPI webhook handler for phone channel
// ============================================================================

import express from 'express';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import usageTracking from '../services/usageTracking.js';
import callAnalysis from '../services/callAnalysis.js';
import { executeTool } from '../tools/index.js';
import batchCallService from '../services/batch-call.js';

const router = express.Router();
const prisma = new PrismaClient();

// ============================================================================
// WEBHOOK SIGNATURE VERIFICATION
// ============================================================================

/**
 * Verify 11Labs webhook signature
 * @param {Object} req - Express request
 * @param {string} secret - Webhook secret
 * @returns {boolean} Whether signature is valid
 */
function verifyWebhookSignature(req, secret) {
  if (!secret) {
    console.warn('⚠️ No ELEVENLABS_WEBHOOK_SECRET configured, skipping verification');
    return true;
  }

  const signature = req.headers['elevenlabs-signature'];
  if (!signature) {
    console.warn('⚠️ No signature header in 11Labs webhook');
    return false;
  }

  try {
    // Format: t=timestamp,v0=hash
    const parts = signature.split(',');
    const timestamp = parts.find(p => p.startsWith('t='))?.split('=')[1];
    const hash = parts.find(p => p.startsWith('v0='))?.split('=')[1];

    if (!timestamp || !hash) {
      console.warn('⚠️ Invalid signature format');
      return false;
    }

    // Check timestamp is within 5 minutes
    const timestampMs = parseInt(timestamp) * 1000;
    const now = Date.now();
    if (Math.abs(now - timestampMs) > 5 * 60 * 1000) {
      console.warn('⚠️ Webhook timestamp too old');
      return false;
    }

    // Verify signature
    const payload = `${timestamp}.${JSON.stringify(req.body)}`;
    const expectedHash = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    return hash === expectedHash;
  } catch (error) {
    console.error('❌ Signature verification error:', error);
    return false;
  }
}

/**
 * Get formatted date/time string for a business timezone
 * @param {Object} business - Business object with timezone and language
 * @returns {string} Formatted date/time context string for prompt
 */
function getDynamicDateTimeContext(business) {
  const now = new Date();
  const timezone = business.timezone || 'Europe/Istanbul';
  const lang = business.language || 'TR';
  const locale = lang === 'TR' ? 'tr-TR' : 'en-US';

  const dateStr = now.toLocaleDateString(locale, {
    timeZone: timezone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const timeStr = now.toLocaleTimeString(locale, {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit'
  });

  if (lang === 'TR') {
    return `\n\n## GUNCEL BILGILER (CEVRIMICI)\n- Bugun: ${dateStr}\n- Su anki saat: ${timeStr}\n- Saat Dilimi: ${timezone}`;
  }
  return `\n\n## CURRENT INFORMATION (LIVE)\n- Today: ${dateStr}\n- Current time: ${timeStr}\n- Timezone: ${timezone}`;
}

// ============================================================================
// MAIN WEBHOOK ENDPOINT
// ============================================================================

router.post('/webhook', async (req, res) => {
  try {
    const event = req.body;
    console.log('📞 11Labs Webhook received:', JSON.stringify(event, null, 2).substring(0, 500));

    // Verify signature in production
    if (process.env.NODE_ENV === 'production') {
      if (!verifyWebhookSignature(req, process.env.ELEVENLABS_WEBHOOK_SECRET)) {
        console.error('❌ Invalid webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    // Determine event type
    const eventType = event.type || event.event_type;

    switch (eventType) {
      // ========== TOOL CALL - Server-side tool execution ==========
      case 'tool_call':
      case 'client_tool_call': {
        console.log('🔧 11Labs Tool Call:', event.tool_name);
        const result = await handleToolCall(event);
        return res.json(result);
      }

      // ========== CONVERSATION STARTED ==========
      case 'conversation.started':
      case 'conversation_started': {
        res.status(200).json({ received: true });
        await handleConversationStarted(event);
        break;
      }

      // ========== CONVERSATION ENDED ==========
      case 'conversation.ended':
      case 'conversation_ended': {
        res.status(200).json({ received: true });
        await handleConversationEnded(event);
        break;
      }

      // ========== AGENT RESPONSE - For dynamic prompts ==========
      case 'agent_response':
      case 'conversation.initiation': {
        // Similar to VAPI's assistant-request for dynamic prompt injection
        const agentId = event.agent_id;
        if (agentId) {
          const assistant = await prisma.assistant.findFirst({
            where: { elevenLabsAgentId: agentId },
            include: { business: true }
          });

          if (assistant && assistant.business) {
            const dynamicContext = getDynamicDateTimeContext(assistant.business);
            console.log('📅 Injecting dynamic date/time for business:', assistant.business.name);
            return res.json({
              prompt_override: dynamicContext
            });
          }
        }
        return res.status(200).json({});
      }

      default:
        console.log(`ℹ️ Unhandled 11Labs event: ${eventType}`);
        res.status(200).json({ received: true });
    }
  } catch (error) {
    console.error('❌ 11Labs webhook error:', error);
    // Still return 200 to acknowledge receipt
    res.status(200).json({ received: true, error: error.message });
  }
});

// ============================================================================
// POST-CALL WEBHOOK (Call Analysis)
// ============================================================================

router.post('/post-call', async (req, res) => {
  try {
    const {
      conversation_id,
      agent_id,
      transcript,
      analysis,
      metadata,
      call_duration_secs,
      status
    } = req.body;

    console.log('[11Labs Post-Call] Conversation:', conversation_id);

    // Find assistant by agent ID
    const assistant = await prisma.assistant.findFirst({
      where: { elevenLabsAgentId: agent_id },
      include: {
        business: {
          include: {
            subscription: { select: { plan: true } }
          }
        }
      }
    });

    if (!assistant) {
      console.warn(`⚠️ No assistant found for agent ${agent_id}`);
      return res.json({ success: true, warning: 'Assistant not found' });
    }

    const business = assistant.business;

    // Parse transcript
    let transcriptMessages = [];
    let transcriptText = '';

    if (transcript && Array.isArray(transcript)) {
      transcriptMessages = transcript.map(msg => ({
        speaker: msg.role === 'agent' ? 'assistant' : 'user',
        text: msg.message || msg.text || '',
        timestamp: msg.time_in_call_secs || msg.timestamp
      }));
      transcriptText = transcriptMessages.map(m => `${m.speaker}: ${m.text}`).join('\n');
    }

    // Run AI analysis for eligible plans
    let aiAnalysis = {
      summary: analysis?.summary || null,
      keyTopics: analysis?.key_topics || [],
      actionItems: analysis?.action_items || [],
      sentiment: analysis?.sentiment || 'neutral',
      sentimentScore: analysis?.sentiment_score || 0.5
    };

    const plan = business.subscription?.plan;
    const shouldAnalyze = (plan === 'PROFESSIONAL' || plan === 'ENTERPRISE') &&
                          transcriptMessages.length > 0;

    if (shouldAnalyze && !aiAnalysis.summary) {
      console.log('🤖 Running AI analysis for conversation:', conversation_id);
      try {
        const callAnalysisResult = await callAnalysis.analyzeCall(transcriptMessages, call_duration_secs);
        aiAnalysis = {
          summary: callAnalysisResult.summary,
          keyTopics: callAnalysisResult.keyTopics,
          actionItems: callAnalysisResult.actionItems,
          sentiment: callAnalysisResult.sentiment,
          sentimentScore: callAnalysisResult.sentimentScore
        };
      } catch (analysisError) {
        console.error('⚠️ AI analysis failed (non-critical):', analysisError);
      }
    }

    // Save/update call log
    await prisma.callLog.upsert({
      where: { callId: conversation_id },
      update: {
        duration: call_duration_secs || 0,
        transcript: transcriptMessages.length > 0 ? transcriptMessages : null,
        transcriptText: transcriptText || null,
        status: mapStatus(status),
        summary: aiAnalysis.summary,
        keyTopics: aiAnalysis.keyTopics,
        actionItems: aiAnalysis.actionItems,
        sentiment: aiAnalysis.sentiment,
        sentimentScore: aiAnalysis.sentimentScore,
        updatedAt: new Date()
      },
      create: {
        businessId: business.id,
        callId: conversation_id,
        callerId: metadata?.caller_phone || 'Unknown',
        duration: call_duration_secs || 0,
        transcript: transcriptMessages.length > 0 ? transcriptMessages : null,
        transcriptText: transcriptText || null,
        status: mapStatus(status),
        summary: aiAnalysis.summary,
        keyTopics: aiAnalysis.keyTopics,
        actionItems: aiAnalysis.actionItems,
        sentiment: aiAnalysis.sentiment,
        sentimentScore: aiAnalysis.sentimentScore,
        createdAt: new Date()
      }
    });

    console.log(`✅ Call log saved: ${conversation_id} (${call_duration_secs}s)`);

    // Track usage
    if (call_duration_secs > 0) {
      await usageTracking.trackCallUsage(business.id, call_duration_secs, {
        callId: conversation_id,
        transcript: transcriptText,
        status: status
      });
    }

    // Handle batch call updates
    try {
      await batchCallService.handleCallWebhook({
        type: 'call.ended',
        call: {
          id: conversation_id,
          duration: call_duration_secs,
          transcript: transcriptMessages,
          transcriptText,
          endedReason: status,
          summary: aiAnalysis.summary
        }
      });
    } catch (batchError) {
      console.log('ℹ️ No batch call found for this conversation (normal for regular calls)');
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[11Labs Post-Call] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// TOOL CALL HANDLER
// ============================================================================

async function handleToolCall(event) {
  const {
    tool_name,
    parameters,
    conversation_id,
    agent_id
  } = event;

  console.log('[11Labs Tool Call]', tool_name, parameters);

  try {
    // Find business from agent ID
    const assistant = await prisma.assistant.findFirst({
      where: { elevenLabsAgentId: agent_id },
      include: {
        business: {
          include: {
            integrations: { where: { isActive: true } },
            users: {
              where: { role: 'OWNER' },
              take: 1,
              select: { email: true }
            }
          }
        }
      }
    });

    if (!assistant || !assistant.business) {
      console.error(`❌ No business found for agent ${agent_id}`);
      return {
        success: false,
        error: 'Business not found'
      };
    }

    const business = assistant.business;
    console.log(`✅ Found business: ${business.name} (ID: ${business.id})`);

    // Execute tool using central tool system
    const result = await executeTool(tool_name, parameters, business, {
      channel: 'PHONE',
      conversationId: conversation_id
    });

    console.log(`🔧 Tool result for ${tool_name}:`, result.success ? 'SUCCESS' : 'FAILED');

    return {
      success: result.success,
      result: result.data || result.message,
      error: result.error
    };

  } catch (error) {
    console.error('[11Labs Tool Call] Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================================
// CONVERSATION EVENT HANDLERS
// ============================================================================

async function handleConversationStarted(event) {
  try {
    const conversationId = event.conversation_id;
    const agentId = event.agent_id;
    const callerPhone = event.metadata?.caller_phone || event.caller_phone || 'Unknown';

    if (!conversationId) {
      console.warn('⚠️ No conversation ID in conversation.started event');
      return;
    }

    // Find business by agent ID
    const assistant = await prisma.assistant.findFirst({
      where: { elevenLabsAgentId: agentId },
      include: { business: true }
    });

    if (!assistant) {
      console.warn(`⚠️ No assistant found for agent ${agentId}`);
      return;
    }

    // Create initial call log
    await prisma.callLog.create({
      data: {
        businessId: assistant.business.id,
        callId: conversationId,
        callerId: callerPhone,
        status: 'in_progress',
        createdAt: new Date()
      }
    });

    console.log(`✅ Conversation started logged: ${conversationId}`);
  } catch (error) {
    console.error('❌ Error handling conversation started:', error);
  }
}

async function handleConversationEnded(event) {
  try {
    const conversationId = event.conversation_id;

    if (!conversationId) {
      console.warn('⚠️ No conversation ID in conversation.ended event');
      return;
    }

    // Basic status update - full details come via post-call webhook
    await prisma.callLog.updateMany({
      where: { callId: conversationId },
      data: {
        status: 'completed',
        updatedAt: new Date()
      }
    });

    console.log(`✅ Conversation ended: ${conversationId}`);
  } catch (error) {
    console.error('❌ Error handling conversation ended:', error);
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function mapStatus(elevenLabsStatus) {
  const statusMap = {
    'completed': 'answered',
    'ended': 'answered',
    'success': 'answered',
    'failed': 'failed',
    'no_answer': 'no_answer',
    'busy': 'busy',
    'voicemail': 'voicemail'
  };
  return statusMap[elevenLabsStatus] || elevenLabsStatus || 'completed';
}

// ============================================================================
// SIGNED URL ENDPOINT (for web client)
// ============================================================================

router.get('/signed-url/:assistantId', async (req, res) => {
  try {
    const { assistantId } = req.params;

    const assistant = await prisma.assistant.findUnique({
      where: { id: assistantId }
    });

    if (!assistant || !assistant.elevenLabsAgentId) {
      return res.status(404).json({ error: 'Assistant not found or not configured for 11Labs' });
    }

    // Import the service
    const elevenLabsService = (await import('../services/elevenlabs.js')).default;
    const signedUrl = await elevenLabsService.getSignedUrl(assistant.elevenLabsAgentId);

    res.json({ signedUrl });
  } catch (error) {
    console.error('❌ Error getting signed URL:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
