/**
 * Core Orchestrator: handleIncomingMessage
 *
 * GOLDEN RULE: This function NEVER calls send().
 * It returns { reply, shouldEndSession, forceEnd, state, metrics, debug }
 * Channel adapters handle sending.
 *
 * Step-by-step pipeline:
 * 01. Load Context (session, state, termination check)
 * 02. Prepare Context (system prompt, history from ChatLog, tools)
 * 03. Classify Message (Gemini Flash classifier with timeout)
 * 04. Router Decision (slot processing, dispute handling, intent routing)
 * 05. Build LLM Request (tool gating, Gemini setup)
 * 06. Tool Loop (execution with retry, idempotency, fail policy)
 * 07. Guardrails (action claim validation)
 * 08. Persist and Metrics (state save, ChatLog append, metrics emission)
 */

import { loadContext } from './orchestrator/steps/01_loadContext.js';
import { prepareContext } from './orchestrator/steps/02_prepareContext.js';
import { classifyMessage } from './orchestrator/steps/03_classify.js';
import { makeRoutingDecision } from './orchestrator/steps/04_routerDecision.js';
import { buildLLMRequest } from './orchestrator/steps/05_buildLLMRequest.js';
import { executeToolLoop } from './orchestrator/steps/06_toolLoop.js';
import { applyGuardrails } from './orchestrator/steps/07_guardrails.js';
import { persistAndEmitMetrics } from './orchestrator/steps/08_persistAndMetrics.js';
import { isFeatureEnabled } from '../config/feature-flags.js';
import prisma from '../config/database.js';
import {
  containsChildSafetyViolation,
  getBlockedContentMessage,
  logContentSafetyViolation
} from '../utils/content-safety.js';

/**
 * Extract order number from user message
 * CONSERVATIVE: Only matches clear order number patterns to avoid false positives
 *
 * Safe patterns:
 * - Prefix formats: ORD-123456, SIP-123456, ORDER-123456
 * - Anchored: "sipariş no 123456", "order number 123456"
 *
 * AVOIDED (false positive risk):
 * - Bare numbers like "123456" (could be year, phone, etc.)
 * - Numbers without anchor words
 */
function extractOrderNumberFromMessage(message) {
  if (!message) return null;

  // Pattern 1: Prefix formats - HIGH CONFIDENCE
  // ORD-123456, SIP-123456789, ORDER-123456 (dash/underscore REQUIRED)
  const prefixMatch = message.match(/\b(ORD|SIP|ORDER)[-_](\d{6,12})\b/i);
  if (prefixMatch) {
    return normalizeOrderNo(prefixMatch[1].toUpperCase() + '-' + prefixMatch[2]);
  }

  // Pattern 2: Turkish anchor words - MEDIUM CONFIDENCE
  // "sipariş no: 123456", "sipariş numarası 123456", "sipariş numaram 123456"
  // Anchor word REQUIRED before number
  const turkishMatch = message.match(/sipariş\s*(no|numarası|numaram|num)[:\s]+#?(\d{6,12})\b/i);
  if (turkishMatch && turkishMatch[2]) {
    return normalizeOrderNo(turkishMatch[2]);
  }

  // Pattern 3: English anchor words - MEDIUM CONFIDENCE
  // "order no 123456", "order number 123456"
  // Anchor word REQUIRED
  const englishMatch = message.match(/order\s*(no|number|num)[:\s]+#?(\d{6,12})\b/i);
  if (englishMatch && englishMatch[2]) {
    return normalizeOrderNo(englishMatch[2]);
  }

  // Pattern 4: Hash prefix - MEDIUM CONFIDENCE
  // "#123456789" (common in e-commerce, 8+ digits)
  const hashMatch = message.match(/#(\d{8,12})\b/);
  if (hashMatch) {
    return normalizeOrderNo(hashMatch[1]);
  }

  // NO BARE NUMBER MATCHING - too risky for false positives
  // Examples that would cause false positives:
  // - "2026'da aldığım sipariş" → 2026 is a YEAR, not order number
  // - "5551234567 numaralı telefondan" → PHONE number
  // - "12345 TL ödedim" → PRICE

  return null;
}

/**
 * Normalize order number to consistent format
 * - Trim whitespace
 * - Uppercase
 * - Remove extra spaces
 */
function normalizeOrderNo(orderNo) {
  if (!orderNo) return null;
  return orderNo.toString().trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * Handle incoming message (channel-agnostic)
 *
 * @param {Object} params
 * @param {string} params.channel - 'CHAT' | 'WHATSAPP' | 'PHONE'
 * @param {Object} params.business - Business object with integrations
 * @param {Object} params.assistant - Assistant configuration
 * @param {string} params.channelUserId - Channel-specific user ID (phoneNumber, userId, etc.)
 * @param {string} params.sessionId - OPTIONAL: Universal session ID (if provided, NEVER create new session)
 * @param {string} params.messageId - Unique message ID (for idempotency)
 * @param {string} params.userMessage - User's message text
 * @param {string} params.language - 'TR' | 'EN'
 * @param {string} params.timezone - e.g., 'Europe/Istanbul'
 * @param {Object} params.metadata - Optional metadata (webhook context, etc.)
 *
 * @returns {Promise<Object>} { reply, shouldEndSession, forceEnd, state, metrics, debug }
 */
export async function handleIncomingMessage({
  channel,
  business,
  assistant,
  channelUserId,
  sessionId,
  messageId,
  userMessage,
  language = 'TR',
  timezone = 'Europe/Istanbul',
  metadata = {}
}) {
  const turnStartTime = Date.now();

  // DRY-RUN MODE: Disable all side-effects (for shadow mode)
  const effectsEnabled = !metadata._shadowMode && !metadata._dryRun;

  const metrics = {
    channel,
    businessId: business.id,
    turnStartTime,
    effectsEnabled // Track if this is dry-run
  };

  const prefix = effectsEnabled ? '📨' : '🔍';
  const mode = effectsEnabled ? 'PRODUCTION' : 'DRY-RUN';

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`${prefix} [Orchestrator] ${mode} - Incoming message from ${channel}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  try {
    // ========================================
    // STEP 0: Content Safety (PRE-LLM FILTER)
    // ========================================
    console.log('\n[STEP 0] Content safety check (pre-LLM)...');

    if (containsChildSafetyViolation(userMessage)) {
      console.error('🚨 [CONTENT_SAFETY] Child safety violation detected - BLOCKED');

      // Log violation (WITHOUT logging the actual message content)
      logContentSafetyViolation({
        sessionId: sessionId || 'unknown',
        channel,
        businessId: business.id,
        timestamp: new Date().toISOString()
      });

      // Return safe response WITHOUT calling LLM
      return {
        reply: getBlockedContentMessage(language),
        shouldEndSession: false,
        forceEnd: false,
        locked: false,
        state: null,
        metrics: {
          ...metrics,
          llmCalled: false,
          contentSafetyBlock: true
        },
        inputTokens: 0,
        outputTokens: 0,
        debug: {
          blocked: true,
          reason: 'CHILD_SAFETY_VIOLATION'
        }
      };
    }

    console.log('✅ [CONTENT_SAFETY] Message passed safety check');

    // ========================================
    // STEP 1: Load Context
    // ========================================
    console.log('\n[STEP 1] Loading context...');
    const contextResult = await loadContext({
      channel,
      channelUserId,
      businessId: business.id,
      sessionId, // CRITICAL: Pass sessionId to prevent new session creation
      language,
      metadata
    });

    if (contextResult.terminated) {
      console.log(`⛔ [Orchestrator] Session ${contextResult.locked ? 'LOCKED' : 'terminated'}`);

      // Return lock message if locked, generic message if terminated
      const replyMessage = contextResult.locked
        ? contextResult.lockMessage
        : (language === 'TR' ? 'Bu görüşme sonlandırılmıştır.' : 'This conversation has ended.');

      return {
        reply: replyMessage,
        shouldEndSession: true,
        forceEnd: true,
        locked: contextResult.locked,
        lockReason: contextResult.terminationReason,
        lockUntil: contextResult.lockUntil,
        state: contextResult.state,
        metrics,
        inputTokens: 0,
        outputTokens: 0,
        debug: {
          terminationReason: contextResult.terminationReason,
          locked: contextResult.locked
        }
      };
    }

    const { sessionId: resolvedSessionId, state } = contextResult;
    metrics.sessionId = resolvedSessionId;

    // ========================================
    // STEP 2: Prepare Context
    // ========================================
    console.log('\n[STEP 2] Preparing context...');
    const { systemPrompt, conversationHistory, toolsAll } = await prepareContext({
      business,
      assistant,
      state,
      language,
      timezone,
      prisma,
      sessionId: resolvedSessionId,
      userMessage // V1 MVP: For intelligent KB retrieval
    });

    console.log(`📚 History: ${conversationHistory.length} messages`);
    console.log(`🔧 Available tools: ${toolsAll.length}`);

    // ========================================
    // STEP 3: Classify Message
    // ========================================
    console.log('\n[STEP 3] Classifying message...');
    let classification = null;

    if (isFeatureEnabled('USE_MESSAGE_TYPE_ROUTING')) {
      classification = await classifyMessage({
        state,
        conversationHistory,
        userMessage,
        language,
        channel
      });

      console.log(`📨 Classification: ${classification.type} (${(classification.confidence * 100).toFixed(0)}%)`);
      if (classification.hadClassifierFailure) {
        console.warn(`⚠️ Classifier ${classification.failureType} - Safe mode activated`);
      }

      // CRITICAL: Update state with extractedSlots for argument normalization
      if (classification.extractedSlots) {
        state.extractedSlots = {
          ...state.extractedSlots,
          ...classification.extractedSlots
        };
        console.log('📝 [Classification] Updated extractedSlots:', state.extractedSlots);
      }
    } else {
      // Fallback: assume high confidence if feature disabled
      classification = {
        type: 'UNKNOWN',
        confidence: 0.9,
        reason: 'Feature disabled'
      };
    }

    // ========================================
    // STEP 4: Router Decision
    // ========================================
    console.log('\n[STEP 4] Making routing decision...');
    const routingResult = await makeRoutingDecision({
      classification,
      state,
      userMessage,
      conversationHistory,
      language,
      business
    });

    // Check for direct responses (slot escalation, dispute resolution)
    if (routingResult.directResponse) {
      console.log('↩️ [Orchestrator] Returning direct response (no LLM call)');

      // Save state and metrics (skip if dry-run)
      await persistAndEmitMetrics({
        sessionId: resolvedSessionId,
        state,
        userMessage,
        finalResponse: routingResult.reply,
        classification,
        routing: routingResult,
        turnStartTime,
        inputTokens: 0,
        outputTokens: 0,
        toolsCalled: [],
        hadToolSuccess: false,
        hadToolFailure: false,
        failedTool: null,
        channel,
        businessId: business.id,
        metrics,
        effectsEnabled // DRY-RUN flag
      });

      return {
        reply: routingResult.reply,
        shouldEndSession: false,
        forceEnd: routingResult.forceEnd || false,
        state,
        metrics,
        inputTokens: 0,
        outputTokens: 0,
        debug: {
          directResponse: true,
          metadata: routingResult.metadata
        }
      };
    }

    // ========================================
    // STEP 5: Build LLM Request
    // ========================================
    console.log('\n[STEP 5] Building LLM request...');
    const { chat, gatedTools, hasTools } = await buildLLMRequest({
      systemPrompt,
      conversationHistory,
      userMessage,
      classification,
      routingResult, // Pass routing result for allowToollessResponse handling
      state,
      toolsAll,
      metrics
    });

    console.log(`🔧 Gated tools: ${gatedTools.length}`);

    // ========================================
    // STEP 6: Tool Loop
    // ========================================
    console.log('\n[STEP 6] Executing tool loop...');
    const toolLoopResult = await executeToolLoop({
      chat,
      userMessage,
      conversationHistory, // CRITICAL: Pass for topic generation in create_callback
      gatedTools,
      hasTools,
      state,
      business,
      language,
      channel,
      sessionId: resolvedSessionId,
      messageId,
      metrics,
      effectsEnabled // DRY-RUN flag
    });

    const {
      reply: responseText,
      inputTokens,
      outputTokens,
      hadToolSuccess,
      hadToolFailure,
      failedTool,
      toolsCalled,
      iterations
    } = toolLoopResult;

    console.log(`🔄 Tool loop completed: ${iterations} iterations, ${toolsCalled.length} tools called`);

    // If tool failed, response is already forced template - return immediately
    if (hadToolFailure) {
      console.log('❌ [Orchestrator] Tool failure - returning forced template');

      await persistAndEmitMetrics({
        sessionId: resolvedSessionId,
        state,
        userMessage,
        finalResponse: responseText,
        classification,
        routing: routingResult,
        turnStartTime,
        inputTokens,
        outputTokens,
        toolsCalled,
        hadToolSuccess: false,
        hadToolFailure: true,
        failedTool,
        channel,
        businessId: business.id,
        metrics,
        effectsEnabled // DRY-RUN flag
      });

      return {
        reply: responseText,
        shouldEndSession: false,
        forceEnd: channel === 'PHONE', // Force end on phone if tool failed
        state,
        metrics,
        inputTokens,
        outputTokens,
        debug: {
          toolFailure: true,
          failedTool,
          toolsCalled
        }
      };
    }

    // ========================================
    // STEP 7: Guardrails
    // ========================================
    console.log('\n[STEP 7] Applying guardrails...');

    // Security Gateway için verification bilgilerini hazırla
    const verificationState = state.verification?.status || 'none';
    const verifiedIdentity = verificationState === 'verified' ? {
      customerId: state.verification?.customerId,
      phone: state.verification?.collected?.phone,
      email: state.verification?.collected?.email,
      orderId: state.anchor?.order_number
    } : null;

    // Tool output'larını topla (identity match için)
    const toolOutputs = toolLoopResult.toolResults?.filter(r => r.success)?.map(r => r.output) || [];

    // Intent bilgisini al (tool enforcement için)
    const detectedIntent = routingResult.routing?.routing?.intent || null;

    // ============================================
    // COLLECTED DATA: Zaten bilinen veriler
    // ============================================
    // Leak filter için: Zaten sipariş no veya telefon verildiyse tekrar sorma
    const extractedOrderNo = extractOrderNumberFromMessage(userMessage);
    const collectedData = {
      orderNumber: state.anchor?.order_number || state.collectedSlots?.order_number || extractedOrderNo,
      phone: state.verification?.collected?.phone || state.collectedSlots?.phone,
      last4: state.verification?.collected?.last4,
      name: state.verification?.collected?.name || state.collectedSlots?.name,
      customerName: state.verification?.collected?.customerName
    };

    console.log('📊 [Guardrails] Collected data for leak filter:', {
      hasOrderNumber: !!collectedData.orderNumber,
      hasPhone: !!collectedData.phone,
      hasLast4: !!collectedData.last4,
      hasName: !!collectedData.name
    });

    const guardrailResult = await applyGuardrails({
      responseText,
      hadToolSuccess,
      toolsCalled,
      toolOutputs, // Identity match için
      chat: toolLoopResult.chat,
      language,
      sessionId: resolvedSessionId,
      metrics,
      userMessage,
      verificationState, // Security Gateway için
      verifiedIdentity, // Identity mismatch kontrolü için
      intent: detectedIntent, // Tool enforcement için (HP-07 fix)
      collectedData // Leak filter için - zaten bilinen veriler
    });

    const { finalResponse } = guardrailResult;

    // Security Gateway tarafından block edildiyse logla
    if (guardrailResult.blocked) {
      console.warn(`🚨 [SecurityGateway] Response blocked: ${guardrailResult.blockReason}`);
      metrics.securityGatewayBlock = {
        reason: guardrailResult.blockReason,
        details: guardrailResult.leaks || guardrailResult.mismatchDetails
      };
    }

    // ========================================
    // STEP 8: Persist and Metrics
    // ========================================
    console.log('\n[STEP 8] Persisting state and emitting metrics...');
    const { shouldEndSession, forceEnd, metadata: persistMetadata } = await persistAndEmitMetrics({
      sessionId: resolvedSessionId,
      state,
      userMessage,
      finalResponse,
      classification,
      routing: routingResult,
      turnStartTime,
      inputTokens,
      outputTokens,
      toolsCalled,
      hadToolSuccess,
      hadToolFailure,
      failedTool,
      channel,
      businessId: business.id,
      metrics,
      effectsEnabled // DRY-RUN flag
    });

    console.log(`\n✅ [Orchestrator] Turn completed successfully`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    return {
      reply: finalResponse,
      shouldEndSession,
      forceEnd,
      state,
      metrics,
      inputTokens,
      outputTokens,
      toolsCalled, // Expose toolsCalled for test assertions
      debug: {
        classification: classification.type,
        confidence: classification.confidence,
        routing: routingResult.routing?.action,
        toolsCalled,
        hadToolSuccess,
        ...persistMetadata
      }
    };

  } catch (error) {
    console.error('❌ [Orchestrator] Fatal error:', error);

    // Emit error metrics
    const { emitErrorMetrics } = await import('../metrics/emit.js');
    emitErrorMetrics({
      sessionId: metrics.sessionId || 'unknown',
      channel,
      error,
      stack: error.stack
    });

    // Return safe fallback response
    return {
      reply: language === 'TR'
        ? 'Özür dilerim, bir hata oluştu. Lütfen tekrar deneyin.'
        : 'I apologize, an error occurred. Please try again.',
      shouldEndSession: false,
      forceEnd: false,
      state: null,
      metrics,
      inputTokens: 0,
      outputTokens: 0,
      debug: {
        error: error.message,
        stack: error.stack?.substring(0, 500)
      }
    };
  }
}

export default { handleIncomingMessage };
