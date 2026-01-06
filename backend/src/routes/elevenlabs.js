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
import usageService from '../services/usageService.js';
import subscriptionService from '../services/subscriptionService.js';
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

    // 11Labs tool webhook sends tool_name directly without type field
    // Check if this is a tool call by looking for tool_name in body
    const isToolCall = event.tool_name || (eventType === 'tool_call') || (eventType === 'client_tool_call');

    // Get agentId from query param (we embed it in webhook URL)
    const agentIdFromQuery = req.query.agentId;

    if (isToolCall && event.tool_name) {
      console.log('🔧 11Labs Tool Call (direct):', event.tool_name, 'AgentID:', agentIdFromQuery);
      const result = await handleToolCall(event, agentIdFromQuery);
      return res.json(result);
    }

    // 11Labs sometimes sends tool calls without tool_name - detect by parameters
    // If we have query_type (customer_data_lookup specific param), it's that tool
    if (!eventType && event.query_type) {
      console.log('🔧 11Labs Tool Call (detected by params - customer_data_lookup):', event);
      const toolEvent = { ...event, tool_name: 'customer_data_lookup' };
      const result = await handleToolCall(toolEvent, agentIdFromQuery);
      return res.json(result);
    }

    switch (eventType) {
      // ========== TOOL CALL - Server-side tool execution (legacy format) ==========
      case 'tool_call':
      case 'client_tool_call': {
        console.log('🔧 11Labs Tool Call:', event.properties?.tool_name || event.tool_name);
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

    console.log('[11Labs Post-Call] Received:', JSON.stringify(req.body, null, 2).substring(0, 1000));
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
    const shouldAnalyze = (plan === 'PROFESSIONAL' || plan === 'PRO' || plan === 'ENTERPRISE') &&
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

    // === YENİ DURUM ANALİZİ ===
    // Teknik sonuç (callResult) ve içerik durumu (callStatus) hesapla
    let callResult = 'SUCCESS';
    let callStatus = null;
    let analysisData = null;
    let voicemailDetected = false;

    // Teknik sonuç belirleme
    const callData = {
      status,
      duration: call_duration_secs,
      voicemailDetected: metadata?.voicemail_detected || false
    };
    callResult = callAnalysis.determineCallResult(callData);
    voicemailDetected = callResult === 'VOICEMAIL';

    // İçerik analizi (PRO/ENTERPRISE için ve başarılı aramalar için)
    if (shouldAnalyze && callResult === 'SUCCESS' && transcriptText) {
      try {
        const contentAnalysis = await callAnalysis.analyzeCallContent(transcriptText);
        if (contentAnalysis) {
          callStatus = contentAnalysis.callStatus;
          analysisData = contentAnalysis;
        }
      } catch (contentError) {
        console.error('⚠️ Content analysis failed (non-critical):', contentError);
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
        // Yeni durum analizi alanları
        callResult,
        callStatus,
        analysisData,
        voicemailDetected,
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
        // Yeni durum analizi alanları
        callResult,
        callStatus,
        analysisData,
        voicemailDetected,
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

async function handleToolCall(event, agentIdFromQuery = null) {
  // 11Labs sends tool parameters directly in body (tool_name, query_type, phone, etc.)
  // No 'properties' wrapper, no 'type' field - just the raw parameters
  const toolName = event.tool_name;

  // Extract parameters - everything except tool_name is a parameter
  const { tool_name: _, ...parameters } = event;

  // agent_id comes from query param since 11Labs doesn't send it in body
  const conversation_id = event.conversation_id;
  const agent_id = agentIdFromQuery || event.agent_id;

  // Extract caller phone from various possible locations in 11Labs event
  const callerPhone = event.caller_phone ||
                      event.metadata?.caller_phone ||
                      event.metadata?.phone_call?.external_number ||
                      event.phone_call?.external_number ||
                      event.from ||
                      null;

  console.log('[11Labs Tool Call]', toolName, JSON.stringify(parameters), 'Caller:', callerPhone);

  try {
    // Find business from agent ID
    // IMPORTANT: If agent_id is undefined/null, we cannot find the correct business
    if (!agent_id) {
      console.error('❌ No agent_id provided in tool call - cannot identify business');
      // Try to find from conversation_id if available
      if (conversation_id) {
        const callLog = await prisma.callLog.findFirst({
          where: { callId: conversation_id },
          include: {
            assistant: {
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
            }
          }
        });
        if (callLog?.assistant?.business) {
          const business = callLog.assistant.business;
          console.log(`✅ Found business from conversation: ${business.name} (ID: ${business.id})`);

          let resolvedCallerPhone = callerPhone || callLog.callerId;
          if (resolvedCallerPhone === 'Unknown') resolvedCallerPhone = null;

          const result = await executeTool(toolName, parameters, business, {
            channel: 'PHONE',
            conversationId: conversation_id,
            callerPhone: resolvedCallerPhone
          });

          // Apply same response format as main path
          if (result.success) {
            return {
              success: true,
              message: result.message || JSON.stringify(result.data),
              data: result.data
            };
          } else {
            return {
              success: false,
              error: result.error || 'Tool execution failed'
            };
          }
        }
      }
      return {
        success: false,
        error: 'Cannot identify business - no agent_id or conversation_id'
      };
    }

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

    // If no caller phone in event, try to get from call log
    let resolvedCallerPhone = callerPhone;
    if (!resolvedCallerPhone && conversation_id) {
      const callLog = await prisma.callLog.findFirst({
        where: { callId: conversation_id },
        select: { callerId: true }
      });
      if (callLog?.callerId && callLog.callerId !== 'Unknown') {
        resolvedCallerPhone = callLog.callerId;
        console.log(`📞 Got caller phone from call log: ${resolvedCallerPhone}`);
      }
    }

    // Execute tool using central tool system with caller phone in context
    const result = await executeTool(toolName, parameters, business, {
      channel: 'PHONE',
      conversationId: conversation_id,
      callerPhone: resolvedCallerPhone,
      phone: resolvedCallerPhone,
      from: resolvedCallerPhone
    });

    console.log(`🔧 Tool result for ${toolName}:`, result.success ? 'SUCCESS' : 'FAILED', JSON.stringify(result).substring(0, 500));

    // 11Labs expects a simple response that the AI can use to continue conversation
    // Return the message directly for the AI to read and respond to
    if (result.success) {
      return {
        success: true,
        message: result.message || JSON.stringify(result.data),
        data: result.data
      };
    } else {
      return {
        success: false,
        error: result.error || 'Tool execution failed'
      };
    }

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

    const businessId = assistant.business.id;

    // Check if can make call (balance, trial limits, concurrent limits)
    try {
      const canCallResult = await subscriptionService.canMakeCall(businessId);

      if (!canCallResult.canMakeCall) {
        console.warn(`⚠️ Call blocked for business ${businessId}: ${canCallResult.reason}`);
        // Note: We can't reject the call from webhook, but we log it
        // In production, the call check should happen BEFORE initiating the call

        // Still log the call but mark it as blocked
        await prisma.callLog.create({
          data: {
            businessId,
            callId: conversationId,
            callerId: callerPhone,
            status: 'blocked',
            summary: `Blocked: ${canCallResult.reason}`,
            createdAt: new Date()
          }
        });
        return;
      }

      // Increment active calls counter
      const incrementResult = await subscriptionService.incrementActiveCalls(businessId);
      if (!incrementResult.success) {
        console.warn(`⚠️ Concurrent limit reached for business ${businessId}`);
      }
    } catch (checkError) {
      console.error('⚠️ Call check failed (continuing anyway):', checkError.message);
    }

    // Create initial call log
    await prisma.callLog.create({
      data: {
        businessId,
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
    const agentId = event.agent_id;

    if (!conversationId) {
      console.warn('⚠️ No conversation ID in conversation.ended event');
      return;
    }

    console.log(`📞 Conversation ended: ${conversationId}, fetching details...`);

    // Wait a bit for 11Labs to process the conversation
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Fetch conversation details from 11Labs API
    const elevenLabsService = (await import('../services/elevenlabs.js')).default;
    let conversationData;

    try {
      conversationData = await elevenLabsService.getConversation(conversationId);
      console.log(`✅ Fetched conversation data for ${conversationId}`);
    } catch (fetchError) {
      console.warn(`⚠️ Could not fetch conversation details: ${fetchError.message}`);
      // Still update status even if we can't get details
      await prisma.callLog.updateMany({
        where: { callId: conversationId },
        data: { status: 'completed', updatedAt: new Date() }
      });
      return;
    }

    // Find assistant by agent ID
    const assistant = await prisma.assistant.findFirst({
      where: { elevenLabsAgentId: agentId || conversationData.agent_id },
      include: {
        business: {
          include: {
            subscription: { select: { plan: true } }
          }
        }
      }
    });

    if (!assistant) {
      console.warn(`⚠️ No assistant found for agent ${agentId}`);
      return;
    }

    const business = assistant.business;

    // Parse transcript from conversation data
    let transcriptMessages = [];
    let transcriptText = '';
    const transcript = conversationData.transcript || [];

    if (Array.isArray(transcript)) {
      transcriptMessages = transcript.map(msg => ({
        speaker: msg.role === 'agent' ? 'assistant' : 'user',
        text: msg.message || msg.text || '',
        timestamp: msg.time_in_call_secs || msg.timestamp
      }));
      transcriptText = transcriptMessages.map(m => `${m.speaker}: ${m.text}`).join('\n');
    }

    // Get analysis data if available
    const analysis = conversationData.analysis || {};
    let aiAnalysis = {
      summary: analysis.summary || null,
      keyTopics: analysis.key_topics || [],
      actionItems: analysis.action_items || [],
      sentiment: analysis.sentiment || 'neutral',
      sentimentScore: analysis.sentiment_score || 0.5
    };

    // Run AI analysis for eligible plans if no summary
    const plan = business.subscription?.plan;
    const shouldAnalyze = (plan === 'PROFESSIONAL' || plan === 'ENTERPRISE') &&
                          transcriptMessages.length > 0 && !aiAnalysis.summary;

    if (shouldAnalyze) {
      console.log('🤖 Running AI analysis for conversation:', conversationId);
      try {
        const callAnalysisResult = await callAnalysis.analyzeCall(transcriptMessages, conversationData.call_duration_secs);
        aiAnalysis = {
          summary: callAnalysisResult.summary,
          keyTopics: callAnalysisResult.keyTopics,
          actionItems: callAnalysisResult.actionItems,
          sentiment: callAnalysisResult.sentiment,
          sentimentScore: callAnalysisResult.sentimentScore
        };
      } catch (analysisError) {
        console.error('⚠️ AI analysis failed:', analysisError.message);
      }
    }

    const duration = conversationData.call_duration_secs ||
                     conversationData.metadata?.call_duration_secs || 0;
    const callerPhone = conversationData.metadata?.caller_phone ||
                        event.metadata?.caller_phone || 'Unknown';

    // Save/update call log
    await prisma.callLog.upsert({
      where: { callId: conversationId },
      update: {
        duration: duration,
        transcript: transcriptMessages.length > 0 ? transcriptMessages : null,
        transcriptText: transcriptText || null,
        status: 'answered',
        summary: aiAnalysis.summary,
        keyTopics: aiAnalysis.keyTopics,
        actionItems: aiAnalysis.actionItems,
        sentiment: aiAnalysis.sentiment,
        sentimentScore: aiAnalysis.sentimentScore,
        updatedAt: new Date()
      },
      create: {
        businessId: business.id,
        callId: conversationId,
        callerId: callerPhone,
        duration: duration,
        transcript: transcriptMessages.length > 0 ? transcriptMessages : null,
        transcriptText: transcriptText || null,
        status: 'answered',
        summary: aiAnalysis.summary,
        keyTopics: aiAnalysis.keyTopics,
        actionItems: aiAnalysis.actionItems,
        sentiment: aiAnalysis.sentiment,
        sentimentScore: aiAnalysis.sentimentScore,
        createdAt: new Date()
      }
    });

    console.log(`✅ Call log saved: ${conversationId} (${duration}s)`);

    // Track usage with new usage service
    if (duration > 0) {
      // Get subscription for this business
      const subscription = await prisma.subscription.findUnique({
        where: { businessId: business.id }
      });

      if (subscription) {
        try {
          // Use new usage service for proper billing
          await usageService.recordUsage({
            subscriptionId: subscription.id,
            channel: 'PHONE',
            durationSeconds: duration,
            callId: conversationId,
            assistantId: assistant?.id,
            metadata: {
              transcript: transcriptText,
              status: 'answered',
              agentId: agentId
            }
          });
          console.log(`💰 Usage recorded via new service: ${Math.ceil(duration / 60)} dk`);
        } catch (usageError) {
          console.error('⚠️ New usage service failed, falling back to legacy:', usageError.message);
          // Fallback to legacy tracking
          await usageTracking.trackCallUsage(business.id, duration, {
            callId: conversationId,
            transcript: transcriptText,
            status: 'answered'
          });
        }
      } else {
        // No subscription, use legacy tracking
        await usageTracking.trackCallUsage(business.id, duration, {
          callId: conversationId,
          transcript: transcriptText,
          status: 'answered'
        });
      }

      // Decrement active calls
      await subscriptionService.decrementActiveCalls(business.id);
    }

    // Handle batch call updates
    try {
      await batchCallService.handleCallWebhook({
        type: 'call.ended',
        call: {
          id: conversationId,
          duration: duration,
          transcript: transcriptMessages,
          transcriptText,
          endedReason: 'completed',
          summary: aiAnalysis.summary
        }
      });
    } catch (batchError) {
      // Normal for regular calls
    }

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
// SYNC CONVERSATIONS ENDPOINT
// ============================================================================
// Fetch recent conversations from 11Labs and sync to CallLog
// This is needed because 11Labs phone call webhooks are not reliable

router.post('/sync-conversations', async (req, res) => {
  try {
    console.log('🔄 Starting 11Labs conversation sync...');

    const elevenLabsService = (await import('../services/elevenlabs.js')).default;

    // Get recent conversations from 11Labs (last 50)
    const conversations = await elevenLabsService.listConversations(50);

    if (!conversations || conversations.length === 0) {
      return res.json({ synced: 0, message: 'No conversations found' });
    }

    console.log(`📞 Found ${conversations.length} conversations to check`);

    let syncedCount = 0;
    let skippedCount = 0;

    for (const conv of conversations) {
      try {
        // Check if already exists
        const existing = await prisma.callLog.findFirst({
          where: { callId: conv.conversation_id }
        });

        if (existing) {
          skippedCount++;
          continue;
        }

        // Find assistant by agent ID
        const assistant = await prisma.assistant.findFirst({
          where: { elevenLabsAgentId: conv.agent_id },
          include: {
            business: {
              include: {
                subscription: { select: { plan: true } }
              }
            }
          }
        });

        if (!assistant) {
          console.log(`⚠️ No assistant found for agent ${conv.agent_id}`);
          continue;
        }

        // Fetch full conversation details
        let conversationData;
        try {
          conversationData = await elevenLabsService.getConversation(conv.conversation_id);
        } catch (err) {
          console.warn(`⚠️ Could not fetch details for ${conv.conversation_id}`);
          continue;
        }

        // Parse transcript
        let transcriptMessages = [];
        let transcriptText = '';
        const transcript = conversationData.transcript || [];

        if (Array.isArray(transcript)) {
          transcriptMessages = transcript.map(msg => ({
            speaker: msg.role === 'agent' ? 'assistant' : 'user',
            text: msg.message || msg.text || '',
            timestamp: msg.time_in_call_secs || msg.timestamp
          }));
          transcriptText = transcriptMessages.map(m => `${m.speaker}: ${m.text}`).join('\n');
        }

        // Get caller phone from metadata
        const callerPhone = conversationData.metadata?.phone_call?.external_number ||
                           conversationData.metadata?.caller_phone || 'Unknown';

        const duration = conv.call_duration_secs || 0;

        // Run AI analysis for eligible plans
        const business = assistant.business;
        const plan = business.subscription?.plan;
        let aiAnalysis = {
          summary: conv.call_summary_title || null,
          keyTopics: [],
          actionItems: [],
          sentiment: 'neutral',
          sentimentScore: 0.5
        };

        const shouldAnalyze = (plan === 'PROFESSIONAL' || plan === 'ENTERPRISE') &&
                              transcriptMessages.length > 2 && !aiAnalysis.summary;

        if (shouldAnalyze) {
          try {
            const callAnalysisResult = await callAnalysis.analyzeCall(transcriptMessages, duration);
            aiAnalysis = {
              summary: callAnalysisResult.summary,
              keyTopics: callAnalysisResult.keyTopics,
              actionItems: callAnalysisResult.actionItems,
              sentiment: callAnalysisResult.sentiment,
              sentimentScore: callAnalysisResult.sentimentScore
            };
          } catch (analysisError) {
            console.error('⚠️ AI analysis failed:', analysisError.message);
          }
        }

        // Create call log
        await prisma.callLog.create({
          data: {
            businessId: business.id,
            callId: conv.conversation_id,
            callerId: callerPhone,
            duration: duration,
            transcript: transcriptMessages.length > 0 ? transcriptMessages : null,
            transcriptText: transcriptText || null,
            status: conv.call_successful === 'success' ? 'answered' : 'failed',
            summary: aiAnalysis.summary,
            keyTopics: aiAnalysis.keyTopics,
            actionItems: aiAnalysis.actionItems,
            sentiment: aiAnalysis.sentiment,
            sentimentScore: aiAnalysis.sentimentScore,
            createdAt: new Date(conv.start_time_unix_secs * 1000)
          }
        });

        // Track usage
        if (duration > 0) {
          await usageTracking.trackCallUsage(business.id, duration, {
            callId: conv.conversation_id,
            transcript: transcriptText,
            status: 'answered'
          });
        }

        syncedCount++;
        console.log(`✅ Synced: ${conv.conversation_id} (${duration}s)`);

      } catch (convError) {
        console.error(`❌ Error syncing ${conv.conversation_id}:`, convError.message);
      }
    }

    console.log(`🔄 Sync complete: ${syncedCount} synced, ${skippedCount} skipped`);
    res.json({
      success: true,
      synced: syncedCount,
      skipped: skippedCount,
      total: conversations.length
    });

  } catch (error) {
    console.error('❌ Conversation sync error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// SIGNED URL ENDPOINT (for web client)
// ============================================================================

router.get('/signed-url/:assistantId', async (req, res) => {
  try {
    const { assistantId } = req.params;
    console.log('🔗 Signed URL requested for assistantId:', assistantId);

    const assistant = await prisma.assistant.findUnique({
      where: { id: assistantId }
    });

    console.log('📋 Assistant found:', assistant ? {
      id: assistant.id,
      name: assistant.name,
      elevenLabsAgentId: assistant.elevenLabsAgentId
    } : 'NOT FOUND');

    if (!assistant) {
      return res.status(404).json({ error: 'Assistant not found' });
    }

    if (!assistant.elevenLabsAgentId) {
      return res.status(404).json({ error: 'Assistant not configured for 11Labs (missing elevenLabsAgentId)' });
    }

    // Import the service
    const elevenLabsService = (await import('../services/elevenlabs.js')).default;
    console.log('🔑 Getting signed URL from 11Labs for agent:', assistant.elevenLabsAgentId);
    const result = await elevenLabsService.getSignedUrl(assistant.elevenLabsAgentId);

    // 11Labs returns { signed_url: "wss://..." }
    console.log('✅ Signed URL obtained successfully');
    res.json({ signedUrl: result.signed_url });
  } catch (error) {
    console.error('❌ Error getting signed URL:', error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
