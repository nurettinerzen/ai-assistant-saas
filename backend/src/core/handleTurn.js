/**
 * Core Turn Handler - Channel-Agnostic Orchestrator
 *
 * This is the SINGLE source of truth for all conversation handling.
 * All channels (chat, WhatsApp, phone) call this function.
 *
 * Responsibilities:
 * 1. Load/save state
 * 2. Message classification (Gemini Flash)
 * 3. Routing decision
 * 4. Tool gating (confidence-based)
 * 5. LLM execution
 * 6. Tool execution with retry + guardrails
 * 7. Action claim validation
 * 8. Metrics emission
 */

import { getState, updateState } from '../services/state-manager.js';
import { classifyMessageType } from '../services/message-type-classifier.js';
import { routeMessage, handleDispute } from '../services/message-router.js';
import { routeIntent } from '../services/intent-router.js';
import { processSlotInput } from '../services/slot-processor.js';
import { getFlow } from '../config/flow-definitions.js';
import { isFeatureEnabled } from '../config/feature-flags.js';

// Policies (guardrails)
import { applyToolGatingPolicy } from '../policies/toolGatingPolicy.js';
import { applyToolFailPolicy } from '../policies/toolFailPolicy.js';
import { applyActionClaimPolicy } from '../policies/actionClaimPolicy.js';
import { applyClassifierPolicy } from '../policies/classifierPolicy.js';

// Metrics
import { emitTurnMetrics } from '../metrics/emit.js';

// Gemini utils
import { getGeminiModel, buildGeminiChatHistory, extractTokenUsage } from '../services/gemini-utils.js';
import { toolRegistry } from '../services/tool-registry.js';
import { executeTool } from '../tools/index.js';
import { executeToolWithRetry } from '../services/tool-fail-handler.js';

/**
 * Handle a single conversation turn (channel-agnostic)
 *
 * @param {Object} params - Turn parameters
 * @param {string} params.sessionId - Universal session ID
 * @param {number} params.businessId - Business ID
 * @param {string} params.userMessage - User's message
 * @param {string} params.systemPrompt - System prompt
 * @param {Array} params.conversationHistory - Message history
 * @param {string} params.language - Language code (TR/EN)
 * @param {Object} params.business - Business object
 * @param {string} params.channel - Channel (CHAT/WHATSAPP/PHONE)
 * @returns {Promise<Object>} { reply, inputTokens, outputTokens, metadata }
 */
export async function handleTurn(params) {
  const {
    sessionId,
    businessId,
    userMessage,
    systemPrompt,
    conversationHistory,
    language,
    business,
    channel,
    metadata = {}
  } = params;

  // DRY-RUN / SHADOW MODE: Skip side-effects
  const effectsEnabled = !metadata._shadowMode;

  console.log(`\n🔄 [HandleTurn] Channel: ${channel}, Session: ${sessionId}${effectsEnabled ? '' : ' (DRY-RUN)'}`);

  const turnStartTime = Date.now();
  const metrics = {
    sessionId,
    channel,
    businessId,
    turnStartTime
  };

  try {
    // ============================================
    // STEP 1: Load State
    // ============================================
    let state = effectsEnabled
      ? await getState(sessionId)
      : { businessId, allowedTools: [], collectedSlots: {}, slotAttempts: {} }; // Minimal state for dry-run

    if (!state.businessId) {
      state.businessId = businessId;
    }

    console.log(`📊 [State] Current:`, {
      activeFlow: state.activeFlow,
      flowStatus: state.flowStatus,
      expectedSlot: state.expectedSlot
    });

    // ============================================
    // STEP 2: Classify Message (with timeout guardrail)
    // ============================================
    const lastAssistantMessage = conversationHistory
      .slice().reverse()
      .find(msg => msg.role === 'assistant')?.content || '';

    let messageClassification = null;

    if (isFeatureEnabled('USE_MESSAGE_TYPE_ROUTING')) {
      // Apply classifier policy (handles timeout, fail-closed)
      messageClassification = await applyClassifierPolicy({
        state,
        lastAssistantMessage,
        userMessage,
        language,
        metrics
      });

      console.log('📨 [Classification]:', {
        type: messageClassification.type,
        confidence: messageClassification.confidence
      });
    }

    // ============================================
    // STEP 3: Routing Decision
    // ============================================
    let messageRouting = null;

    if (messageClassification) {
      messageRouting = await routeMessage(
        userMessage,
        state,
        lastAssistantMessage,
        language,
        business
      );

      // Handle special routing actions
      if (messageRouting.routing.action === 'HANDLE_DISPUTE') {
        const disputeResult = await handleDispute(userMessage, state, language, business);

        if (disputeResult.directResponse) {
          // Return direct response without LLM
          if (effectsEnabled) await updateState(sessionId, state);

          return {
            reply: disputeResult.response,
            inputTokens: 0,
            outputTokens: 0,
            metadata: { routingAction: 'HANDLE_DISPUTE', hadDirectResponse: true }
          };
        }

        // Start complaint flow
        if (disputeResult.shouldStartFlow) {
          state.activeFlow = disputeResult.flowName;
          state.flowStatus = 'in_progress';
          state.allowedTools = disputeResult.tools || [];
        }
      }

      // Handle intent routing
      if (messageRouting.routing.action === 'RUN_INTENT_ROUTER') {
        const intentResult = await routeIntent(userMessage, language, business);

        if (intentResult.intent && intentResult.shouldStartFlow) {
          const flow = getFlow(intentResult.flowName);

          if (flow) {
            state.activeFlow = intentResult.flowName;
            state.flowStatus = 'in_progress';
            state.allowedTools = flow.allowedTools;
            state.expectedSlot = flow.requiredSlots?.[0] || null;
          }
        }
      }

      // Handle slot processing
      if (messageRouting.routing.action === 'PROCESS_SLOT' && state.expectedSlot) {
        const slotResult = processSlotInput(state.expectedSlot, userMessage, state);

        if (slotResult.escalate) {
          state.flowStatus = 'paused';
          state.pauseReason = 'loop_detected';

          if (effectsEnabled) await updateState(sessionId, state);

          return {
            reply: slotResult.hint,
            inputTokens: 0,
            outputTokens: 0,
            metadata: { escalated: true, reason: 'loop_detected' }
          };
        }

        if (slotResult.filled) {
          const slotName = slotResult.slotName || state.expectedSlot;
          state.collectedSlots[slotName] = slotResult.value;
          state.expectedSlot = null;

          // Reset attempts on success
          if (state.slotAttempts[slotName]) {
            delete state.slotAttempts[slotName];
          }
        } else {
          // Track failed attempt
          if (!state.slotAttempts[state.expectedSlot]) {
            state.slotAttempts[state.expectedSlot] = 0;
          }
          state.slotAttempts[state.expectedSlot]++;
        }
      }
    }

    // ============================================
    // STEP 4: Tool Gating Policy (confidence-based)
    // ============================================
    const flow = getFlow(state.activeFlow);
    const originalAllowedTools = state.allowedTools || flow?.allowedTools || [];

    const gatedTools = applyToolGatingPolicy({
      confidence: messageClassification?.confidence || 0.9,
      activeFlow: state.activeFlow,
      allowedTools: originalAllowedTools,
      verificationStatus: state.verification?.status || 'none',
      metrics
    });

    state.allowedTools = gatedTools;

    console.log(`🛡️ [ToolGating] Allowed tools:`, gatedTools);

    // ============================================
    // STEP 5: Call LLM
    // ============================================
    const allowedToolDefs = toolRegistry.pick(state.allowedTools);

    const model = getGeminiModel({
      model: 'gemini-2.5-flash',
      temperature: 0.7,
      tools: allowedToolDefs
    });

    const chatHistory = buildGeminiChatHistory(systemPrompt, conversationHistory, true);
    const chat = model.startChat({ history: chatHistory });

    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    let result = await chat.sendMessage(userMessage);
    let response = result.response;

    const initialTokens = extractTokenUsage(response);
    totalInputTokens += initialTokens.inputTokens;
    totalOutputTokens += initialTokens.outputTokens;

    // ============================================
    // STEP 6: Tool Execution Loop (with guardrails)
    // ============================================
    let iterations = 0;
    const maxIterations = 3;
    const toolsCalled = [];
    let hadToolSuccess = false;

    while (iterations < maxIterations) {
      const functionCalls = response.functionCalls();

      if (!functionCalls || functionCalls.length === 0) {
        break;
      }

      const functionCall = functionCalls[0];
      iterations++;

      // Security gate: Tool must be in allowed list
      if (!state.allowedTools.includes(functionCall.name)) {
        console.warn(`🚫 [Security] Tool ${functionCall.name} NOT in allowedTools`);
        iterations++;
        continue;
      }

      // Execute tool with retry + tool fail policy
      const toolExecutor = async (name, args) => {
        return executeTool(name, args, business, {
          channel,
          sessionId,
          conversationId: sessionId,
          intent: state.activeFlow,
          requiresVerification: flow?.requiresVerification || false
        });
      };

      const startTime = Date.now();
      const toolResult = await executeToolWithRetry(
        toolExecutor,
        functionCall.name,
        functionCall.args,
        1 // Max 1 retry
      );

      const executionTime = Date.now() - startTime;

      console.log('🔧 [Tool] Result:', toolResult.success ? 'SUCCESS' : 'FAILED');

      toolsCalled.push(functionCall.name);

      if (toolResult.success) {
        hadToolSuccess = true;
      }

      // Apply tool fail policy
      const toolFailResponse = applyToolFailPolicy({
        toolResult,
        toolName: functionCall.name,
        language,
        channel,
        sessionId,
        executionTime,
        metrics
      });

      if (toolFailResponse) {
        // Tool failed, return forced template
        if (effectsEnabled) await updateState(sessionId, state);

        // Emit metrics
        emitTurnMetrics({
          ...metrics,
          turnDuration: Date.now() - turnStartTime,
          classification: messageClassification,
          routing: messageRouting,
          hadToolFailure: true,
          failedTool: functionCall.name
        });

        return toolFailResponse;
      }

      // Send tool result to LLM
      result = await chat.sendMessage([{
        functionResponse: {
          name: functionCall.name,
          response: {
            success: toolResult.success,
            data: toolResult.data || null,
            message: toolResult.message || 'Tool executed'
          }
        }
      }]);

      response = result.response;

      const tokens = extractTokenUsage(response);
      totalInputTokens += tokens.inputTokens;
      totalOutputTokens += tokens.outputTokens;

      // Update state if tool succeeded
      if (toolResult.success && isFeatureEnabled('USE_POST_RESULT_STATE')) {
        const truth = toolResult.truth || {};

        state.anchor = {
          ...state.anchor,
          truth: truth,
          lastResultText: toolResult.message?.substring(0, 200)
        };

        state.flowStatus = 'post_result';
        state.postResultTurns = 0;
      }
    }

    // ============================================
    // STEP 7: Get Final Response
    // ============================================
    let text = '';
    try {
      text = response.text() || '';
    } catch (e) {
      console.warn('⚠️ Could not get text from response');
    }

    console.log('📝 [Gemini] Final response:', text.substring(0, 100));

    // ============================================
    // STEP 8: Action Claim Policy (CRITICAL)
    // ============================================
    const finalText = applyActionClaimPolicy({
      responseText: text,
      hadToolSuccess,
      hadToolCalls: iterations > 0,
      language,
      sessionId,
      chat, // For correction if needed
      metrics
    });

    text = finalText;

    // ============================================
    // STEP 9: Update State
    // ============================================
    // Post-result turn increment
    if (state.flowStatus === 'post_result') {
      state.postResultTurns++;

      if (state.postResultTurns >= 3) {
        state.flowStatus = 'idle';
        state.activeFlow = null;
        state.anchor = {};
        state.postResultTurns = 0;
      }
    }

    if (effectsEnabled) await updateState(sessionId, state);

    // ============================================
    // STEP 10: Emit Metrics
    // ============================================
    emitTurnMetrics({
      ...metrics,
      turnDuration: Date.now() - turnStartTime,
      classification: messageClassification,
      routing: messageRouting,
      toolsCalled,
      hadToolSuccess,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens
    });

    // ============================================
    // RETURN
    // ============================================
    return {
      reply: text,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      metadata: {
        classification: messageClassification?.type,
        confidence: messageClassification?.confidence,
        toolsCalled,
        hadToolSuccess
      }
    };

  } catch (error) {
    console.error('❌ [HandleTurn] Fatal error:', error);

    // Emit error metrics
    emitTurnMetrics({
      ...metrics,
      turnDuration: Date.now() - turnStartTime,
      error: error.message
    });

    throw error;
  }
}

export default { handleTurn };
