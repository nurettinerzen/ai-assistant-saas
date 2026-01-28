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
      sessionId: resolvedSessionId
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
    const { finalResponse } = await applyGuardrails({
      responseText,
      hadToolSuccess,
      toolsCalled,
      chat: toolLoopResult.chat,
      language,
      sessionId: resolvedSessionId,
      metrics
    });

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
