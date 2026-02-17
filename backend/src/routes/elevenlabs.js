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
import OpenAI from 'openai';
import prisma from '../prismaClient.js';
import usageTracking from '../services/usageTracking.js';
import usageService from '../services/usageService.js';
import subscriptionService from '../services/subscriptionService.js';
import callAnalysis from '../services/callAnalysis.js';
import { executeTool } from '../tools/index.js';
import { authenticateToken } from '../middleware/auth.js';
import { hasProFeatures, isProTier } from '../config/plans.js';
import concurrentCallManager from '../services/concurrentCallManager.js';
import elevenLabsService from '../services/elevenlabs.js';
import metricsService from '../services/metricsService.js';
import {
  isPhoneOutboundV1Enabled,
  isPhoneInboundEnabled,
  getPhoneOutboundV1ClassifierMode
} from '../config/feature-flags.js';
import {
  runFlowStep,
  PHONE_OUTBOUND_V1_ALLOWED_TOOLS,
  isAllowedOutboundV1Tool,
  applyOutboundV1Actions,
  normalizePhoneE164,
  getInboundDisabledMessage
} from '../phone-outbound-v1/index.js';
import {
  containsChildSafetyViolation,
  logContentSafetyViolation
} from '../utils/content-safety.js';

const router = express.Router();
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

/**
 * Translate summary to Turkish using OpenAI
 */
async function translateSummaryToTurkish(englishSummary, businessLanguage = 'tr') {
  if (!englishSummary || !openai || businessLanguage !== 'tr') return englishSummary;
  // If already in Turkish, return as is
  if (/[ğüşıöçĞÜŞİÖÇ]/.test(englishSummary)) return englishSummary;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Sen bir çevirmensin. Verilen İngilizce metni doğal Türkçe\'ye çevir. Kısa ve öz tut.'
        },
        {
          role: 'user',
          content: englishSummary
        }
      ],
      max_tokens: 300,
      temperature: 0.3
    });

    const turkishSummary = response.choices[0]?.message?.content?.trim();
    console.log('🌐 Summary translated to Turkish');
    return turkishSummary || englishSummary;
  } catch (error) {
    console.error('❌ Failed to translate summary:', error.message);
    return englishSummary;
  }
}

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

function normalizeDirection(rawDirection = '') {
  const direction = String(rawDirection || '').toLowerCase();
  if (direction === 'web' || direction === 'chat' || !direction) {
    return 'inbound';
  }
  if (direction.includes('outbound')) {
    return 'outbound';
  }
  return direction;
}

function inferCallType({ metadata = {}, assistant = null } = {}) {
  const directType = metadata.call_type || metadata.callType;
  if (directType) {
    const normalizedDirectType = String(directType).toUpperCase();
    if (['BILLING_REMINDER', 'APPOINTMENT_REMINDER', 'SHIPPING_UPDATE'].includes(normalizedDirectType)) {
      return normalizedDirectType;
    }
  }

  const dynamicVars = metadata.dynamic_variables || metadata.dynamicVariables || {};

  if (metadata.debt_amount || dynamicVars.debt_amount || assistant?.callDirection === 'outbound_collection') {
    return 'BILLING_REMINDER';
  }

  if (metadata.appointment_date || dynamicVars.appointment_date) {
    return 'APPOINTMENT_REMINDER';
  }

  if (
    metadata.tracking_number || metadata.shipping_status ||
    dynamicVars.tracking_number || dynamicVars.shipping_status || dynamicVars.order_status
  ) {
    return 'SHIPPING_UPDATE';
  }

  return 'BILLING_REMINDER';
}

function extractConversationMetadata(event = {}) {
  const rootMetadata = event.metadata || {};
  const phoneCallMetadata = rootMetadata.phone_call || {};
  const initData = rootMetadata.conversation_initiation_client_data || {};
  const initMetadata = initData.metadata || {};

  return {
    ...rootMetadata,
    ...phoneCallMetadata,
    ...initMetadata,
    dynamic_variables: initData.dynamic_variables || rootMetadata.dynamic_variables || {}
  };
}

async function getActiveCallSession(callId) {
  if (!callId) return null;
  return prisma.activeCallSession.findUnique({
    where: { callId },
    select: {
      businessId: true,
      direction: true,
      metadata: true
    }
  });
}

async function updateActiveSessionMetadata(callId, nextMetadata) {
  if (!callId) return;
  await prisma.activeCallSession.updateMany({
    where: { callId },
    data: {
      metadata: nextMetadata || {},
      updatedAt: new Date()
    }
  });
}

function extractUserUtterance(event = {}, parameters = {}) {
  const explicit =
    event.user_utterance ||
    event.user_transcript ||
    event.user_message ||
    event.transcript_text ||
    event.utterance ||
    null;

  if (explicit) {
    return String(explicit);
  }

  const ignoredKeys = new Set([
    'tool_name',
    'conversation_id',
    'agent_id',
    'dtmfDigits',
    'dtmf_digits',
    'call_id',
    'business_id'
  ]);

  const candidateStrings = Object.entries(parameters || {})
    .filter(([key, value]) => !ignoredKeys.has(key) && typeof value === 'string' && value.trim().length > 0)
    .map(([, value]) => value.trim())
    .sort((a, b) => b.length - a.length);

  return candidateStrings[0] || '';
}

async function consumePendingV1Script(conversationId) {
  if (!conversationId) return null;

  const session = await getActiveCallSession(conversationId);
  const pendingScript = session?.metadata?.phoneOutboundV1?.pendingScript;
  if (!pendingScript) return null;

  const nextMetadata = {
    ...(session.metadata || {}),
    phoneOutboundV1: {
      ...(session.metadata?.phoneOutboundV1 || {}),
      pendingScript: null
    }
  };

  await updateActiveSessionMetadata(conversationId, nextMetadata);
  return pendingScript;
}

async function runOutboundV1Turn({
  assistant,
  business,
  conversationId,
  eventMetadata = {},
  userUtterance = '',
  dtmfDigits = ''
}) {
  const activeSession = await getActiveCallSession(conversationId);
  const sessionMetadata = activeSession?.metadata || {};
  const v1Metadata = sessionMetadata.phoneOutboundV1 || {};

  const callType = v1Metadata.callType || inferCallType({ metadata: eventMetadata, assistant });
  const callSession = {
    callId: conversationId,
    sessionId: conversationId,
    conversationId,
    callType,
    customerName: eventMetadata.customer_name || eventMetadata.customerName || v1Metadata.customerName || 'Müşteri',
    phoneE164: normalizePhoneE164(eventMetadata.external_number || eventMetadata.caller_phone || v1Metadata.phoneE164 || '')
  };

  const flowResult = await runFlowStep({
    business,
    callSession,
    userUtterance,
    dtmfDigits,
    flowState: v1Metadata.flowState || null,
    classifierMode: getPhoneOutboundV1ClassifierMode()
  });

  const actionResults = await applyOutboundV1Actions(flowResult.actions || [], {
    businessId: business.id,
    assistantId: assistant.id,
    callId: conversationId,
    sessionId: conversationId,
    customerName: callSession.customerName,
    phoneE164: callSession.phoneE164
  });

  const nextMetadata = {
    ...sessionMetadata,
    phoneOutboundV1: {
      enabled: true,
      callType,
      customerName: callSession.customerName,
      phoneE164: callSession.phoneE164,
      flowState: flowResult.nextState,
      pendingScript: flowResult.nextScriptText || null,
      lastLabel: flowResult.label || 'UNKNOWN',
      actionResults
    }
  };

  await updateActiveSessionMetadata(conversationId, nextMetadata);

  return flowResult;
}

// ============================================================================
// MAIN WEBHOOK ENDPOINT
// ============================================================================

router.post('/webhook', async (req, res) => {
  try {
    const event = req.body;
    const eventType = event.type || event.event_type;
    console.log('[MAIN_WEBHOOK_HIT]', JSON.stringify({
      endpoint: '/api/elevenlabs/webhook',
      eventType: eventType || 'unknown',
      hasSignature: Boolean(req.headers['elevenlabs-signature']),
      keys: Object.keys(event || {})
    }));
    console.log('📞 11Labs Webhook received:', JSON.stringify(event, null, 2).substring(0, 500));

    // Get agentId from query param (we embed it in webhook URL)
    const agentIdFromQuery = req.query.agentId;

    // 11Labs tool webhook sends tool_name directly OR we detect by parameters
    // Tool calls do NOT have signature - they come directly from 11Labs conversation servers
    const isToolCall = event.tool_name || (eventType === 'tool_call') || (eventType === 'client_tool_call');
    const looksLikeToolCall = !eventType && (event.query_type || event.order_number || event.customer_name || (event.phone && !event.type));

    // Handle tool calls FIRST (before signature check - 11Labs doesn't sign tool webhooks)
    if (isToolCall && event.tool_name) {
      console.log('🔧 11Labs Tool Call (direct):', event.tool_name, 'AgentID:', agentIdFromQuery);
      const result = await handleToolCall(event, agentIdFromQuery);
      return res.json(result);
    }

    // 11Labs may send tool calls without tool_name - detect by parameters
    if (looksLikeToolCall) {
      console.log('🔧 11Labs Tool Call (detected by params - customer_data_lookup):', JSON.stringify(event));
      const toolEvent = { ...event, tool_name: 'customer_data_lookup' };
      const result = await handleToolCall(toolEvent, agentIdFromQuery);
      return res.json(result);
    }

    // If no event type and we have agentId, this is likely a tool call
    if (!eventType && agentIdFromQuery && Object.keys(event).length > 0) {
      console.log('🔧 11Labs Tool Call (unknown tool, detecting...):', JSON.stringify(event));
      const toolEvent = { ...event, tool_name: 'customer_data_lookup' };
      const result = await handleToolCall(toolEvent, agentIdFromQuery);
      return res.json(result);
    }

    // ========== CONVERSATION INITIATION CLIENT DATA WEBHOOK ==========
    // 11Labs sends this when an inbound Twilio/SIP call starts (NO signature, NO event type)
    // Keys: caller_id, agent_id, called_number, call_sid, conversation_id
    // Must be handled BEFORE signature check (this webhook has no signature)
    const isConversationInitiation = !eventType && event.caller_id && event.agent_id && event.called_number && event.call_sid;
    if (isConversationInitiation) {
      console.log(`[CONVERSATION_INITIATION] ${JSON.stringify({
        conversationId: event.conversation_id,
        callerId: event.caller_id,
        agentId: event.agent_id,
        calledNumber: event.called_number,
        callSid: event.call_sid
      })}`);

      // Run inbound blocking logic via handleConversationStarted
      const initiationEvent = {
        conversation_id: event.conversation_id,
        agent_id: event.agent_id,
        metadata: {
          phone_call: {
            direction: 'inbound',
            external_number: event.caller_id,
            call_type: 'inbound'
          }
        },
        caller_phone: event.caller_id,
        _isConversationInitiation: true
      };

      const startResult = await handleConversationStarted(initiationEvent);

      // If inbound is blocked, return empty response (11Labs will see no overrides)
      // The terminateConversation call in handleConversationStarted will kill the call
      if (startResult?.inboundDisabled) {
        console.log(`[INBOUND_BLOCKED_INITIATION] conversationId=${event.conversation_id} — returning empty initiation data`);
        return res.status(200).json({});
      }

      // If not blocked, return conversation initiation client data
      // This allows dynamic variables and overrides for outbound/allowed calls
      return res.status(200).json({
        type: 'conversation_initiation_client_data',
        dynamic_variables: {},
        conversation_config_override: {}
      });
    }

    // Verify signature in production ONLY for lifecycle events (not tool calls)
    // SECURITY: If webhook secret is configured, reject invalid signatures
    if (process.env.NODE_ENV === 'production') {
      const candidateSecrets = [
        process.env.ELEVENLABS_WEBHOOK_SECRET,
        process.env.ELEVENLABS_WORKSPACE_WEBHOOK_SECRET
      ].filter(Boolean);

      if (candidateSecrets.length === 0) {
        console.error('[SECURITY] ELEVENLABS_WEBHOOK_SECRET not set in production — lifecycle events REJECTED (fail-closed)');
        return res.status(401).json({ error: 'Webhook secret not configured — lifecycle events rejected in production' });
      } else if (!candidateSecrets.some(secret => verifyWebhookSignature(req, secret))) {
        console.error('❌ 11Labs webhook signature verification failed');

        // P0: Log webhook signature failure to SecurityEvent
        const { logWebhookSignatureFailure } = await import('../middleware/securityEventLogger.js');
        await logWebhookSignatureFailure(req, '11labs', 401);

        return res.status(401).json({ error: 'Invalid webhook signature' });
      }
    }

    switch (eventType) {
      // ========== TOOL CALL - Server-side tool execution (legacy format) ==========
      case 'tool_call':
      case 'client_tool_call': {
        console.log('🔧 11Labs Tool Call:', event.properties?.tool_name || event.tool_name);
        const result = await handleToolCall(event, agentIdFromQuery);
        return res.json(result);
      }

      // ========== CONVERSATION STARTED ==========
      case 'conversation.started':
      case 'conversation_started': {
        const startResult = await handleConversationStarted(event);
        return res.status(200).json({
          received: true,
          ...(startResult || {})
        });
      }

      // ========== CONVERSATION ENDED ==========
      case 'conversation.ended':
      case 'conversation_ended': {
        await handleConversationEnded(event);
        return res.status(200).json({ received: true });
      }

      // ========== WORKSPACE POST-CALL WEBHOOK FORMAT ==========
      case 'post_call_transcription':
      case 'post_call_audio': {
        const callData = event.data || {};
        await handleConversationEnded({
          conversation_id: callData.conversation_id || event.conversation_id,
          agent_id: callData.agent_id || event.agent_id,
          metadata: callData.metadata || event.metadata || {}
        });
        return res.status(200).json({ received: true, source: 'workspace_post_call' });
      }

      case 'call_initiation_failure': {
        const failureData = event.data || {};
        console.warn('⚠️ [11Labs] call initiation failure webhook:', failureData);

        const conversationId = failureData.conversation_id || failureData.call_id || null;
        const assistant = failureData.agent_id
          ? await prisma.assistant.findFirst({
            where: { elevenLabsAgentId: failureData.agent_id },
            include: { business: true }
          })
          : null;

        if (conversationId && assistant?.business?.id) {
          await prisma.callLog.upsert({
            where: { callId: conversationId },
            update: {
              businessId: assistant.business.id,
              status: 'failed',
              direction: 'outbound',
              summary: `11Labs call initiation failure: ${failureData.reason || 'unknown'}`,
              updatedAt: new Date()
            },
            create: {
              businessId: assistant.business.id,
              callId: conversationId,
              status: 'failed',
              direction: 'outbound',
              summary: `11Labs call initiation failure: ${failureData.reason || 'unknown'}`,
              createdAt: new Date()
            }
          });
        }

        return res.status(200).json({ received: true, source: 'workspace_call_initiation_failure' });
      }

      // ========== AGENT RESPONSE - For dynamic prompts ==========
      case 'agent_response':
      case 'conversation.initiation': {
        const conversationId = event.conversation_id || event.metadata?.conversation_id || null;
        const pendingV1Script = await consumePendingV1Script(conversationId);

        if (pendingV1Script) {
          console.log('🧭 [PHONE_OUTBOUND_V1] Sending pending script via prompt_override');
          return res.json({
            prompt_override: pendingV1Script
          });
        }

        // Similar to VAPI's assistant-request for dynamic prompt injection
        const agentId = event.agent_id;
        if (agentId) {
          const assistant = await prisma.assistant.findFirst({
            where: { elevenLabsAgentId: agentId },
            include: { business: true }
          });

          if (assistant && assistant.business) {
            const activeSession = await getActiveCallSession(conversationId);
            const sessionDirection = normalizeDirection(
              activeSession?.direction ||
              assistant.callDirection ||
              'inbound'
            );

            // INBOUND GATE: Don't serve prompt overrides for blocked inbound calls
            if (sessionDirection === 'inbound' && !isPhoneInboundEnabled()) {
              console.log(`[INBOUND_BLOCKED] agent_response/initiation blocked, conversationId=${conversationId}`);
              return res.status(200).json({});
            }

            const outboundV1Enabled = sessionDirection === 'outbound' && isPhoneOutboundV1Enabled({
              businessId: assistant.business.id
            });

            if (outboundV1Enabled && activeSession?.metadata?.phoneOutboundV1?.enabled) {
              const utterance = extractUserUtterance(event, event);
              if (utterance) {
                const flowResult = await runOutboundV1Turn({
                  assistant,
                  business: assistant.business,
                  conversationId,
                  eventMetadata: extractConversationMetadata(event),
                  userUtterance: utterance,
                  dtmfDigits: event.dtmfDigits || event.dtmf_digits || ''
                });

                return res.json({
                  prompt_override: flowResult.nextScriptText
                });
              }
            }

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
        return res.status(200).json({ received: true });
    }
  } catch (error) {
    console.error('❌ 11Labs webhook error:', error);

    // Persist to ErrorLog
    import('../services/errorLogger.js')
      .then(({ logError, ERROR_CATEGORY, SEVERITY, EXTERNAL_SERVICE }) => {
        logError({
          category: ERROR_CATEGORY.WEBHOOK_ERROR,
          severity: SEVERITY.HIGH,
          message: error?.message,
          error,
          source: 'elevenlabs/webhook',
          externalService: EXTERNAL_SERVICE.ELEVENLABS,
          endpoint: req.path,
          method: req.method,
        }).catch(() => {});
      })
      .catch(() => {});

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
    const shouldAnalyze = (plan === 'PRO' || plan === 'ENTERPRISE') &&
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

    // === NORMALLEŞTİRİLMİŞ KONU BELİRLEME ===
    let normalizedCategory = null;
    let normalizedTopic = null;
    if (transcriptText && transcriptText.length > 20) {
      try {
        const topicResult = await callAnalysis.determineNormalizedTopic(transcriptText);
        normalizedCategory = topicResult.normalizedCategory;
        normalizedTopic = topicResult.normalizedTopic;
        console.log(`📊 Post-call topic determined: ${normalizedCategory} > ${normalizedTopic}`);
      } catch (topicError) {
        console.error('⚠️ Topic determination failed (non-critical):', topicError.message);
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
        normalizedCategory,
        normalizedTopic,
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
        normalizedCategory,
        normalizedTopic,
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

    res.json({ success: true });
  } catch (error) {
    console.error('[11Labs Post-Call] Error:', error);

    // Persist to ErrorLog
    import('../services/errorLogger.js')
      .then(({ logError, ERROR_CATEGORY, SEVERITY, EXTERNAL_SERVICE }) => {
        logError({
          category: ERROR_CATEGORY.API_ERROR,
          severity: SEVERITY.HIGH,
          message: error?.message,
          error,
          source: 'elevenlabs/post-call',
          externalService: EXTERNAL_SERVICE.ELEVENLABS,
          endpoint: req.path,
          method: req.method,
        }).catch(() => {});
      })
      .catch(() => {});

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

  // SECURITY: Don't log full parameters (may contain PII) or caller phone
  console.log('[11Labs Tool Call]', toolName, 'paramCount:', Object.keys(parameters || {}).length, 'hasCaller:', !!callerPhone);

  // P0 SECURITY: Content safety check on user input parameters
  const parametersText = Object.values(parameters || {}).filter(v => typeof v === 'string').join(' ');
  if (containsChildSafetyViolation(parametersText)) {
    console.error('🚨 [CONTENT_SAFETY] Child safety violation in phone tool call - BLOCKED');

    logContentSafetyViolation({
      sessionId: conversation_id || 'unknown',
      channel: 'PHONE',
      businessId: 'unknown', // We don't have businessId yet at this point
      timestamp: new Date().toISOString()
    });

    return {
      success: false,
      error: 'Your request contains inappropriate content and cannot be processed.',
      message: 'Üzgünüm, talebiniz uygunsuz içerik içerdiği için işlenemiyor.' // Turkish fallback
    };
  }

  try {
    // Find business from agent ID
    // IMPORTANT: If agent_id is undefined/null, we cannot find the correct business
    if (!agent_id) {
      console.error('❌ No agent_id provided in tool call - cannot identify business');
      if (conversation_id) {
        const activeSession = await getActiveCallSession(conversation_id);

        // FAIL-CLOSED: If no activeSession, direction is unknown → block
        if (!activeSession) {
          console.warn(`[TOOL_FAILCLOSED] No activeSession for conversation_id=${conversation_id}, agent_id missing — blocking tool execution`);
          metricsService.incrementCounter('phone_inbound_tool_blocked_total', { source: 'no_session_no_agent' });
          return {
            success: false,
            error: 'TOOL_BLOCKED_NO_SESSION',
            message: 'Cannot verify call direction — tool execution blocked'
          };
        }

        // INBOUND GATE: Check direction before executing tool
        const fallbackDirection = normalizeDirection(activeSession.direction || 'inbound');
        if (fallbackDirection === 'inbound' && !isPhoneInboundEnabled()) {
          console.log(`[INBOUND_TOOL_BLOCKED] conversationId=${conversation_id}, source=no_agent_fallback`);
          metricsService.incrementCounter('phone_inbound_tool_blocked_total', { source: 'no_agent_fallback' });
          return {
            success: false,
            error: 'PHONE_INBOUND_DISABLED',
            message: getInboundDisabledMessage()
          };
        }

        if (activeSession.businessId) {
          const business = await prisma.business.findUnique({
            where: { id: activeSession.businessId },
            include: {
              integrations: { where: { isActive: true } },
              users: {
                where: { role: 'OWNER' },
                take: 1,
                select: { email: true }
              }
            }
          });

          if (business) {
            const result = await executeTool(toolName, parameters, business, {
              channel: 'PHONE',
              conversationId: conversation_id,
              callerPhone: callerPhone || null
            });

            if (result.success) {
              return {
                success: true,
                message: result.message || JSON.stringify(result.data),
                data: result.data
              };
            }

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

    const activeSession = await getActiveCallSession(conversation_id);
    const sessionDirection = normalizeDirection(
      activeSession?.direction ||
      event.metadata?.phone_call?.call_type ||
      event.metadata?.channel ||
      assistant.callDirection ||
      'inbound'
    );

    if (sessionDirection === 'inbound' && !isPhoneInboundEnabled()) {
      console.log(`[INBOUND_TOOL_BLOCKED] conversationId=${conversation_id}, source=main_agent_path`);
      metricsService.incrementCounter('phone_inbound_tool_blocked_total', { source: 'main_agent_path' });
      return {
        success: false,
        error: 'PHONE_INBOUND_DISABLED',
        message: getInboundDisabledMessage(business.language)
      };
    }

    const outboundV1Enabled = sessionDirection === 'outbound' && isPhoneOutboundV1Enabled({
      businessId: business.id
    });

    if (outboundV1Enabled) {
      if (!isAllowedOutboundV1Tool(toolName)) {
        console.warn(`⛔ [PHONE_OUTBOUND_V1] Rejected non-allowlisted tool: ${toolName}`);
        return {
          success: false,
          error: 'TOOL_NOT_ALLOWED_IN_PHONE_OUTBOUND_V1',
          message: `Allowed tools: ${PHONE_OUTBOUND_V1_ALLOWED_TOOLS.join(', ')}`
        };
      }

      if (!conversation_id) {
        return {
          success: false,
          error: 'MISSING_CONVERSATION_ID_FOR_PHONE_OUTBOUND_V1'
        };
      }

      const flowResult = await runOutboundV1Turn({
        assistant,
        business,
        conversationId: conversation_id,
        eventMetadata: extractConversationMetadata(event),
        userUtterance: extractUserUtterance(event, parameters),
        dtmfDigits: parameters.dtmfDigits || parameters.dtmf_digits || ''
      });

      return {
        success: true,
        message: flowResult.nextScriptText,
        data: {
          label: flowResult.label,
          terminal: flowResult.isTerminal
        }
      };
    }

    // Execute tool using central tool system with caller phone in context
    const result = await executeTool(toolName, parameters, business, {
      channel: 'PHONE',
      conversationId: conversation_id,
      callerPhone: resolvedCallerPhone,
      phone: resolvedCallerPhone,
      from: resolvedCallerPhone
    });

    // SECURITY: Don't log full result (may contain customer PII)
    console.log(`🔧 Tool result for ${toolName}:`, result.success ? 'SUCCESS' : 'FAILED', `(${result.message?.length || 0} chars)`);

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
    const eventMetadata = extractConversationMetadata(event);
    const callerPhone = eventMetadata.external_number || eventMetadata.caller_phone || event.caller_phone || 'Unknown';

    // Determine call direction from metadata or assistant settings
    let direction = normalizeDirection(
      event.metadata?.channel ||
      event.metadata?.phone_call?.call_type ||
      eventMetadata.direction ||
      'inbound'
    );

    if (!conversationId) {
      console.warn('⚠️ No conversation ID in conversation.started event');
      return {
        branch: 'missing_conversation_id'
      };
    }

    // Find business by agent ID
    const assistant = await prisma.assistant.findFirst({
      where: { elevenLabsAgentId: agentId },
      include: { business: true }
    });

    if (!assistant) {
      console.warn(`⚠️ No assistant found for agent ${agentId}`);
      return {
        branch: 'assistant_not_found'
      };
    }

    // Use assistant's callDirection if not determined from metadata
    if (direction === 'inbound' && assistant.callDirection === 'outbound') {
      direction = 'outbound';
    }

    const businessId = assistant.business.id;
    const inboundEnabled = isPhoneInboundEnabled();
    const outboundV1Enabled = direction === 'outbound' && isPhoneOutboundV1Enabled({ businessId });

    // Structured call-started log for monitoring
    console.log(`[CALL_STARTED] ${JSON.stringify({
      conversationId,
      resolvedDirection: direction,
      assistantDirection: assistant.callDirection || null,
      metadataDirection: event.metadata?.phone_call?.call_type || event.metadata?.channel || null,
      businessId,
      agentId
    })}`);

    if (direction === 'inbound' && !inboundEnabled) {
      const disabledMessage = getInboundDisabledMessage(assistant.business?.language);
      console.log(`[INBOUND_BLOCKED] ${JSON.stringify({ conversationId, source: 'main', reason: 'PHONE_INBOUND_ENABLED=false', businessId })}`);
      metricsService.incrementCounter('phone_inbound_blocked_total', { source: 'main' });

      await prisma.callLog.upsert({
        where: { callId: conversationId },
        update: {
          businessId,
          callerId: callerPhone,
          direction: 'inbound',
          status: 'inbound_disabled_v1',
          summary: disabledMessage,
          updatedAt: new Date()
        },
        create: {
          businessId,
          callId: conversationId,
          callerId: callerPhone,
          direction: 'inbound',
          status: 'inbound_disabled_v1',
          summary: disabledMessage,
          createdAt: new Date()
        }
      });

      try {
        await elevenLabsService.terminateConversation(conversationId);
      } catch (terminateError) {
        console.error(`❌ Failed to terminate inbound-disabled call ${conversationId}:`, terminateError.message);
      }

      return {
        branch: 'phone_inbound_disabled_v1',
        inboundDisabled: true,
        message: disabledMessage
      };
    }

    // P0.1: CRITICAL - Acquire concurrent call slot (business + global capacity)
    let slotAcquired = false;
    try {
      console.log(`📞 [PHONE] Acquiring slot for business ${businessId}, call ${conversationId}, direction=${direction}`);

      const slotResult = await concurrentCallManager.acquireSlot(
        businessId,
        conversationId,
        direction,
        {
          agentId,
          callerPhone,
          inbound: direction === 'inbound',
          phoneOutboundV1: outboundV1Enabled
        }
      );

      if (!slotResult.success) {
        // NO SLOT AVAILABLE - TERMINATE CALL IMMEDIATELY
        console.warn(`⚠️ [INBOUND] NO CAPACITY - Terminating call ${conversationId}: ${slotResult.error}`);

        // P0.5: Increment rejection metric
        metricsService.incrementCounter('concurrent_rejected_total', {
          reason: slotResult.error,
          plan: 'inbound'
        });

        // Log terminated call
        await prisma.callLog.create({
          data: {
            businessId,
            callId: conversationId,
            callerId: callerPhone,
            direction: direction,
            status: 'terminated_capacity',
            summary: `Terminated due to capacity: ${slotResult.message}`,
            endReason: slotResult.error,
            createdAt: new Date()
          }
        });

        // TERMINATE THE CALL VIA 11LABS API
        try {
          await elevenLabsService.terminateConversation(conversationId);
          console.log(`✅ [INBOUND] Call ${conversationId} terminated successfully`);
        } catch (terminateError) {
          console.error(`❌ [INBOUND] Failed to terminate call ${conversationId}:`, terminateError.message);
          // Even if termination fails, we've logged it and denied the slot
        }

        return {
          branch: 'capacity_rejected',
          reason: slotResult.error
        }; // Stop processing this webhook
      }

      slotAcquired = true;
      console.log(`✅ [INBOUND] Slot acquired for call ${conversationId}`);

    } catch (capacityError) {
      console.error('❌ [INBOUND] Critical error in capacity check:', capacityError);

      // Log error and terminate call (fail-safe)
      await prisma.callLog.create({
        data: {
          businessId,
          callId: conversationId,
          callerId: callerPhone,
          direction: direction,
          status: 'failed',
          summary: `Capacity check failed: ${capacityError.message}`,
          createdAt: new Date()
        }
      });

      try {
        await elevenLabsService.terminateConversation(conversationId);
      } catch (terminateError) {
        console.error(`❌ Failed to terminate after error:`, terminateError.message);
      }

      return {
        branch: 'capacity_error'
      };
    }

    // Create initial call log
    await prisma.callLog.create({
      data: {
        businessId,
        callId: conversationId,
        callerId: callerPhone,
        direction: direction,
        status: 'in_progress',
        createdAt: new Date()
      }
    });

    if (outboundV1Enabled) {
      console.log('🧭 [PHONE_OUTBOUND_V1] Main webhook path selected: /api/elevenlabs/webhook (legacy /api/webhooks/elevenlabs/* kept)');

      const initialFlow = await runOutboundV1Turn({
        assistant,
        business: assistant.business,
        conversationId,
        eventMetadata,
        userUtterance: '',
        dtmfDigits: ''
      });

      return {
        branch: 'phone_outbound_v1',
        outboundV1: true,
        initialLabel: initialFlow.label,
        scriptTransport: 'prompt_override_and_tool_response'
      };
    }

    console.log(`✅ Conversation started logged: ${conversationId}`);
    return {
      branch: 'legacy_phone_flow',
      outboundV1: false
    };
  } catch (error) {
    console.error('❌ Error handling conversation started:', error);
    return {
      branch: 'error',
      error: error.message
    };
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

    // SECURITY: Protect inbound_disabled_v1 status from being overwritten
    const existingLog = await prisma.callLog.findFirst({
      where: { callId: conversationId },
      select: { status: true }
    });
    if (existingLog?.status === 'inbound_disabled_v1') {
      console.log(`[INBOUND_PROTECTED] conversationId=${conversationId} — skipping ended processing, status preserved`);
      return;
    }

    // Wait for 11Labs to process the conversation data (they need time to calculate duration, cost, etc.)
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Fetch conversation details from 11Labs API with retry
    const elevenLabsService = (await import('../services/elevenlabs.js')).default;
    let conversationData;
    let retryCount = 0;
    const maxRetries = 2;

    while (retryCount <= maxRetries) {
      try {
        conversationData = await elevenLabsService.getConversation(conversationId);

        // Check if critical data is present - if not, retry
        if (!conversationData.call_duration_secs && retryCount < maxRetries) {
          console.log(`⏳ Duration not ready yet, retry ${retryCount + 1}/${maxRetries}...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          retryCount++;
          continue;
        }

        console.log(`✅ Fetched conversation data for ${conversationId} (duration: ${conversationData.call_duration_secs}s)`);
        break;
      } catch (fetchError) {
        if (retryCount < maxRetries) {
          console.log(`⏳ Fetch failed, retry ${retryCount + 1}/${maxRetries}...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          retryCount++;
          continue;
        }
        console.warn(`⚠️ Could not fetch conversation details after ${maxRetries} retries: ${fetchError.message}`);
        // Still update status even if we can't get details
        await prisma.callLog.updateMany({
          where: { callId: conversationId },
          data: { status: 'completed', updatedAt: new Date() }
        });
        return;
      }
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
    // Use transcript_summary from 11Labs analysis
    let rawSummary = analysis.transcript_summary || analysis.summary || null;
    console.log('📝 Raw summary from 11Labs:', rawSummary);
    console.log('🏢 Business language:', business.language);

    // Translate summary to Turkish (always translate if not already Turkish)
    if (rawSummary) {
      // Check if already in Turkish by looking for Turkish-specific characters
      const hasTurkishChars = /[ğüşıöçĞÜŞİÖÇ]/.test(rawSummary);
      console.log('🔍 Has Turkish chars:', hasTurkishChars);

      if (!hasTurkishChars) {
        console.log('🌐 Translating summary to Turkish...');
        rawSummary = await translateSummaryToTurkish(rawSummary, 'tr');
        console.log('✅ Translated summary:', rawSummary?.substring(0, 100));
      }
    }
    let aiAnalysis = {
      summary: rawSummary,
      keyTopics: analysis.key_topics || [],
      actionItems: analysis.action_items || [],
      sentiment: analysis.sentiment || 'neutral',
      sentimentScore: analysis.sentiment_score || 0.5
    };

    // Run AI analysis for eligible plans if no summary
    const plan = business.subscription?.plan;
    const shouldAnalyze = hasProFeatures(plan) &&
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
                        conversationData.metadata?.phone_call?.external_number ||
                        event.metadata?.caller_phone || 'Unknown';

    // Extract termination reason from 11Labs
    // Log full metadata to see what's available
    console.log('📊 11Labs conversation metadata:', JSON.stringify(conversationData.metadata, null, 2));
    console.log('📊 11Labs conversation status:', conversationData.status);
    console.log('📊 11Labs conversation call_successful:', conversationData.call_successful);

    // Try multiple locations for termination reason
    const terminationReason = conversationData.metadata?.termination_reason ||
                              conversationData.termination_reason ||
                              conversationData.status ||
                              null;
    console.log('🔚 Termination reason:', terminationReason);

    let endReason = null; // Default to null instead of generic value
    if (terminationReason) {
      const reason = terminationReason.toLowerCase();
      // 11Labs specific: "Remote party ended call" = customer hung up
      if (reason.includes('remote party') || reason.includes('client disconnected') || reason.includes('client') || reason.includes('user_ended') || reason.includes('hangup') || reason.includes('customer')) {
        endReason = 'client_ended';
      } else if (reason.includes('agent') || reason.includes('assistant') || reason.includes('ai') || reason.includes('local')) {
        endReason = 'agent_ended';
      } else if (reason.includes('timeout') || reason.includes('silence') || reason.includes('no_input') || reason.includes('inactivity')) {
        endReason = 'system_timeout';
      } else if (reason.includes('error') || reason.includes('failed')) {
        endReason = 'error';
      } else if (reason === 'done' || reason === 'completed' || reason === 'finished') {
        endReason = 'completed';
      }
    }
    console.log('🏷️ Mapped endReason:', endReason);

    // Calculate call cost based on subscription
    const subscription = business.subscription || await prisma.subscription.findUnique({
      where: { businessId: business.id }
    });
    console.log('💰 Subscription plan:', subscription?.plan);
    console.log('⏱️ Duration (seconds):', duration);

    // Default cost per minute in TL
    let costPerMinute = 0.60;
    if (subscription?.plan === 'STARTER') {
      costPerMinute = 0.70;
    } else if (isProTier(subscription?.plan)) {
      costPerMinute = 0.50;
    } else if (subscription?.plan === 'ENTERPRISE') {
      costPerMinute = 0.40;
    }
    // Calculate cost - minimum 1 minute billing
    const durationMinutes = duration > 0 ? Math.ceil(duration / 60) : 0;
    const callCost = durationMinutes > 0 ? durationMinutes * costPerMinute : 0;
    console.log('💵 Cost per minute:', costPerMinute, 'TL, Duration:', durationMinutes, 'min, Total cost:', callCost, 'TL');

    // Determine call direction
    let direction = conversationData.metadata?.channel ||
                    conversationData.metadata?.phone_call?.call_type ||
                    event.metadata?.channel ||
                    assistant.callDirection ||
                    'inbound';
    if (direction === 'web' || direction === 'chat') {
      direction = 'inbound';
    }

    // === NORMALLEŞTİRİLMİŞ KONU BELİRLEME ===
    let normalizedCategory = null;
    let normalizedTopic = null;
    if (transcriptText && transcriptText.length > 20) {
      try {
        const topicResult = await callAnalysis.determineNormalizedTopic(transcriptText);
        normalizedCategory = topicResult.normalizedCategory;
        normalizedTopic = topicResult.normalizedTopic;
        console.log(`📊 Topic determined: ${normalizedCategory} > ${normalizedTopic}`);
      } catch (topicError) {
        console.error('⚠️ Topic determination failed (non-critical):', topicError.message);
      }
    }

    // Save/update call log
    await prisma.callLog.upsert({
      where: { callId: conversationId },
      update: {
        duration: duration,
        direction: direction,
        transcript: transcriptMessages.length > 0 ? transcriptMessages : null,
        transcriptText: transcriptText || null,
        status: 'answered',
        summary: aiAnalysis.summary,
        keyTopics: aiAnalysis.keyTopics,
        actionItems: aiAnalysis.actionItems,
        sentiment: aiAnalysis.sentiment,
        sentimentScore: aiAnalysis.sentimentScore,
        endReason: endReason,
        callCost: callCost,
        normalizedCategory: normalizedCategory,
        normalizedTopic: normalizedTopic,
        updatedAt: new Date()
      },
      create: {
        businessId: business.id,
        callId: conversationId,
        callerId: callerPhone,
        duration: duration,
        direction: direction,
        transcript: transcriptMessages.length > 0 ? transcriptMessages : null,
        transcriptText: transcriptText || null,
        status: 'answered',
        summary: aiAnalysis.summary,
        keyTopics: aiAnalysis.keyTopics,
        actionItems: aiAnalysis.actionItems,
        sentiment: aiAnalysis.sentiment,
        sentimentScore: aiAnalysis.sentimentScore,
        endReason: endReason,
        callCost: callCost,
        normalizedCategory: normalizedCategory,
        normalizedTopic: normalizedTopic,
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

      // P0.1: Release concurrent call slot (business + global capacity)
      try {
        console.log(`📞 [ENDED] Releasing slot for business ${business.id}, call ${conversationId}`);
        await concurrentCallManager.releaseSlot(business.id, conversationId);
        console.log(`✅ [ENDED] Slot released for call ${conversationId}`);
      } catch (releaseError) {
        console.error(`❌ [ENDED] Failed to release slot for ${conversationId}:`, releaseError);
        // Continue anyway - cleanup cron will handle it
      }
    }

  } catch (error) {
    console.error('❌ Error handling conversation ended:', error);

    // P0.1: Fail-safe - try to release slot even on error
    try {
      const conversationId = event.conversation_id;
      if (conversationId) {
        // Try to find business ID from CallLog
        const callLog = await prisma.callLog.findFirst({
          where: { callId: conversationId },
          select: { businessId: true }
        });

        if (callLog) {
          await concurrentCallManager.releaseSlot(callLog.businessId, conversationId);
          console.log(`✅ [ENDED-ERROR] Fail-safe slot release successful for ${conversationId}`);
        }
      }
    } catch (failsafeError) {
      console.error(`❌ [ENDED-ERROR] Fail-safe slot release failed:`, failsafeError);
    }
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

router.post('/sync-conversations', authenticateToken, async (req, res) => {
  try {
    const businessId = req.user.businessId;
    console.log(`🔄 Starting 11Labs conversation sync for business ${businessId}...`);

    const elevenLabsService = (await import('../services/elevenlabs.js')).default;

    // Get this business's assistant agent IDs
    const businessAssistants = await prisma.assistant.findMany({
      where: {
        businessId: businessId,
        elevenLabsAgentId: { not: null }
      },
      select: { elevenLabsAgentId: true, id: true, name: true, callDirection: true }
    });

    if (businessAssistants.length === 0) {
      return res.json({ synced: 0, message: 'No assistants with 11Labs configured' });
    }

    const agentIds = businessAssistants.map(a => a.elevenLabsAgentId);
    console.log(`📋 Business has ${businessAssistants.length} assistants to sync`);

    // Get recent conversations from 11Labs (last 50)
    const allConversations = await elevenLabsService.listConversations(50);

    if (!allConversations || allConversations.length === 0) {
      return res.json({ synced: 0, message: 'No conversations found' });
    }

    // Filter only this business's conversations
    const conversations = allConversations.filter(conv => agentIds.includes(conv.agent_id));
    console.log(`📞 Found ${conversations.length} conversations for this business (filtered from ${allConversations.length})`);

    let syncedCount = 0;
    let skippedCount = 0;

    for (const conv of conversations) {
      try {
        // Check if already exists
        const existing = await prisma.callLog.findFirst({
          where: { callId: conv.conversation_id }
        });

        // Skip only if exists AND is already completed/answered (not in_progress)
        if (existing && existing.status !== 'in_progress' && existing.status !== 'in-progress') {
          skippedCount++;
          continue;
        }

        // Find assistant by agent ID (we know it exists since we filtered)
        const assistant = await prisma.assistant.findFirst({
          where: {
            elevenLabsAgentId: conv.agent_id,
            businessId: businessId  // Extra safety check
          },
          include: {
            business: {
              include: {
                subscription: { select: { plan: true } }
              }
            }
          }
        });

        if (!assistant) {
          // Should not happen but just in case
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

        // Determine call direction
        // Priority: metadata.channel > phone_call type > assistant.callDirection
        let direction = conversationData.metadata?.channel ||
                        conversationData.metadata?.phone_call?.call_type ||
                        assistant.callDirection ||
                        'inbound';
        // Normalize direction value
        if (direction === 'web' || direction === 'chat') {
          direction = 'inbound'; // Web/chat calls are considered inbound
        }

        const duration = conv.call_duration_secs || 0;

        // Extract endReason from conversation data (same logic as webhook)
        const terminationReason = conversationData.metadata?.termination_reason ||
                                  conversationData.termination_reason ||
                                  conversationData.status ||
                                  null;

        let endReason = null;
        if (terminationReason) {
          const reason = terminationReason.toLowerCase();
          if (reason.includes('remote party') || reason.includes('client disconnected') || reason.includes('client') || reason.includes('user_ended') || reason.includes('hangup') || reason.includes('customer')) {
            endReason = 'client_ended';
          } else if (reason.includes('agent') || reason.includes('assistant') || reason.includes('ai') || reason.includes('local')) {
            endReason = 'agent_ended';
          } else if (reason.includes('timeout') || reason.includes('silence') || reason.includes('no_input') || reason.includes('inactivity')) {
            endReason = 'system_timeout';
          } else if (reason.includes('error') || reason.includes('failed')) {
            endReason = 'error';
          } else if (reason === 'done' || reason === 'completed' || reason === 'finished') {
            endReason = 'completed';
          }
        }

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

        const shouldAnalyze = hasProFeatures(plan) &&
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

        // === NORMALLEŞTİRİLMİŞ KONU BELİRLEME ===
        let normalizedCategory = null;
        let normalizedTopic = null;
        if (transcriptText && transcriptText.length > 20) {
          try {
            const topicResult = await callAnalysis.determineNormalizedTopic(transcriptText);
            normalizedCategory = topicResult.normalizedCategory;
            normalizedTopic = topicResult.normalizedTopic;
            console.log(`📊 Sync topic determined: ${normalizedCategory} > ${normalizedTopic}`);
          } catch (topicError) {
            console.error('⚠️ Topic determination failed (non-critical):', topicError.message);
          }
        }

        // Create or update call log (upsert for in_progress calls)
        await prisma.callLog.upsert({
          where: { callId: conv.conversation_id },
          update: {
            callerId: callerPhone !== 'Unknown' ? callerPhone : undefined,
            duration: duration,
            direction: direction,
            transcript: transcriptMessages.length > 0 ? transcriptMessages : undefined,
            transcriptText: transcriptText || undefined,
            status: conv.call_successful === 'success' ? 'answered' : 'failed',
            summary: aiAnalysis.summary,
            keyTopics: aiAnalysis.keyTopics,
            actionItems: aiAnalysis.actionItems,
            sentiment: aiAnalysis.sentiment,
            sentimentScore: aiAnalysis.sentimentScore,
            endReason: endReason,
            normalizedCategory: normalizedCategory,
            normalizedTopic: normalizedTopic,
            updatedAt: new Date()
          },
          create: {
            businessId: business.id,
            callId: conv.conversation_id,
            callerId: callerPhone,
            duration: duration,
            direction: direction,
            transcript: transcriptMessages.length > 0 ? transcriptMessages : null,
            transcriptText: transcriptText || null,
            status: conv.call_successful === 'success' ? 'answered' : 'failed',
            summary: aiAnalysis.summary,
            keyTopics: aiAnalysis.keyTopics,
            actionItems: aiAnalysis.actionItems,
            sentiment: aiAnalysis.sentiment,
            sentimentScore: aiAnalysis.sentimentScore,
            endReason: endReason,
            normalizedCategory: normalizedCategory,
            normalizedTopic: normalizedTopic,
            createdAt: new Date(conv.start_time_unix_secs * 1000)
          }
        });

        // Track usage only for new calls (not updates)
        if (duration > 0 && !existing) {
          // Get subscription for proper billing
          const subscription = await prisma.subscription.findUnique({
            where: { businessId: business.id }
          });

          if (subscription) {
            try {
              // Use new usage service for proper billing (updates includedMinutesUsed)
              await usageService.recordUsage({
                subscriptionId: subscription.id,
                channel: 'PHONE',
                durationSeconds: duration,
                callId: conv.conversation_id,
                assistantId: assistant?.id,
                metadata: {
                  transcript: transcriptText,
                  status: 'answered',
                  source: 'sync' // Mark as synced vs webhook
                }
              });
              console.log(`💰 Usage recorded via sync: ${Math.ceil(duration / 60)} dk`);
            } catch (usageError) {
              console.error('⚠️ Usage service failed during sync:', usageError.message);
              // Fallback to legacy tracking
              await usageTracking.trackCallUsage(business.id, duration, {
                callId: conv.conversation_id,
                transcript: transcriptText,
                status: 'answered'
              });
            }
          } else {
            // No subscription, use legacy tracking
            await usageTracking.trackCallUsage(business.id, duration, {
              callId: conv.conversation_id,
              transcript: transcriptText,
              status: 'answered'
            });
          }
        }

        syncedCount++;
        console.log(`✅ ${existing ? 'Updated' : 'Synced'}: ${conv.conversation_id} (${duration}s)`);

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

// ============================================================================
// INBOUND GATE DIAGNOSTICS (temporary - for verifying inbound blocking)
// ============================================================================
router.get('/inbound-gate-status', async (req, res) => { // TODO: re-add authenticateToken
  try {
    const inboundEnabled = isPhoneInboundEnabled();
    const metrics = metricsService.getMetrics();
    const recentEvents = metricsService.getRecentEvents(20);

    // Check 11Labs workspace webhook configuration
    let elevenLabsWebhookConfig = null;
    try {
      const elService = (await import('../services/elevenlabs.js')).default;
      const convaiSettings = await elService.getConvaiSettings();
      const workspaceWebhooks = await elService.listWorkspaceWebhooks(false);
      elevenLabsWebhookConfig = {
        conversation_initiation_webhook_url: convaiSettings?.conversation_initiation_client_data_webhook?.url || null,
        post_call_webhook_id: convaiSettings?.webhooks?.post_call_webhook_id || null,
        workspace_webhooks: workspaceWebhooks.map(wh => ({
          id: wh.webhook_id,
          url: wh.webhook_url,
          name: wh.name,
          disabled: wh.is_disabled || wh.is_auto_disabled || false
        })),
        expected_url: `${process.env.BACKEND_URL || 'https://api.telyx.ai'}/api/elevenlabs/webhook`
      };
    } catch (elErr) {
      elevenLabsWebhookConfig = { error: elErr.message };
    }

    // Find recent inbound_disabled_v1 call logs
    const recentBlockedCalls = await prisma.callLog.findMany({
      where: { status: 'inbound_disabled_v1' },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        callId: true,
        callerId: true,
        direction: true,
        status: true,
        summary: true,
        createdAt: true,
        updatedAt: true,
        businessId: true
      }
    });

    // Also fetch last 5 call logs of ANY status to see if webhooks are working at all
    const recentAllCalls = await prisma.callLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        callId: true,
        callerId: true,
        direction: true,
        status: true,
        createdAt: true,
        businessId: true
      }
    });

    return res.json({
      inboundGate: {
        PHONE_INBOUND_ENABLED: inboundEnabled,
        NODE_ENV: process.env.NODE_ENV || 'unset',
        WEBHOOK_SECRET_SET: Boolean(process.env.ELEVENLABS_WEBHOOK_SECRET),
        WORKSPACE_SECRET_SET: Boolean(process.env.ELEVENLABS_WORKSPACE_WEBHOOK_SECRET)
      },
      elevenLabsWebhookConfig,
      metrics: {
        phone_inbound_blocked_total: metrics.counters.phone_inbound_blocked_total,
        phone_inbound_tool_blocked_total: metrics.counters.phone_inbound_tool_blocked_total
      },
      recentBlockedCalls,
      recentAllCalls,
      recentEvents: recentEvents.filter(e =>
        e.type === 'phone_inbound_blocked' || e.type === 'phone_inbound_tool_blocked'
      ),
      serverTime: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Inbound gate status error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// WEBHOOK DIAGNOSTICS ENDPOINT
// ============================================================================
router.get('/webhook-diagnostics/:agentId', authenticateToken, async (req, res) => {
  try {
    const { agentId } = req.params;
    const backendUrl = process.env.BACKEND_URL || 'https://api.telyx.ai';
    const sync = String(req.query.sync || '').toLowerCase() === 'true';

    let workspaceSync = null;
    if (sync) {
      workspaceSync = await elevenLabsService.ensureWorkspaceWebhookRouting({ backendUrl });
    }

    const diagnostics = await elevenLabsService.getWebhookDiagnostics({
      agentId,
      backendUrl
    });

    return res.json({
      success: true,
      diagnostics,
      workspaceSync
    });
  } catch (error) {
    console.error('❌ Webhook diagnostics error:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
