/**
 * Step 6: Tool Loop
 *
 * - Executes LLM with tool calling loop
 * - Handles tool execution with retry and idempotency
 * - Applies tool fail policy
 * - Returns final response text + metadata
 */

import { applyToolFailPolicy } from '../../../policies/toolFailPolicy.js';
import { executeToolWithRetry } from '../../../services/tool-fail-handler.js';
import { executeTool } from '../../../tools/index.js';
import { getToolExecutionResult, setToolExecutionResult } from '../../../services/tool-idempotency-db.js';
import { isSessionLocked, getLockMessage, checkEnumerationAttempt } from '../../../services/session-lock.js';
import { GENERIC_ERROR_MESSAGES, ToolOutcome, normalizeOutcome } from '../../../tools/toolResult.js';
import {
  deriveOutcomeEvents,
  applyOutcomeEventsToState,
  shouldAskVerification,
  shouldTerminate,
  OutcomeEventType
} from '../../../security/outcomePolicy.js';
import { tryAutoverify } from '../../../security/autoverify.js';

const MAX_ITERATIONS = 3;

export async function executeToolLoop(params) {
  const {
    chat,
    userMessage,
    conversationHistory, // For topic generation in tools
    gatedTools,
    hasTools,
    state,
    business,
    language,
    channel,
    channelUserId,       // Channel identity signal (phone for WA, email for Email, null for Chat)
    sessionId,
    messageId,
    metrics,
    effectsEnabled = true // DRY-RUN flag (default: true for backward compat)
  } = params;

  // Check lock state once more before tool execution (defensive).
  const lockStatus = await isSessionLocked(sessionId);
  if (lockStatus.locked && lockStatus.reason === 'ENUMERATION') {
    console.log(`🚫 [ToolLoop] Session blocked due to enumeration policy: ${sessionId}`);
    return {
      reply: getLockMessage('ENUMERATION', language, sessionId),
      inputTokens: 0,
      outputTokens: 0,
      hadToolSuccess: false,
      hadToolFailure: true,
      failedTool: null,
      toolsCalled: [],
      toolResults: [],
      iterations: 0,
      chat: null,
      _blocked: 'ENUMERATION'
    };
  }

  // DRY-RUN MODE: Stub all tools (no side-effects)
  if (!effectsEnabled) {
    console.log('🔍 [ToolLoop] DRY-RUN mode - stubbing all tools');

    return {
      reply: language === 'TR'
        ? 'Talebinizi kontrol ediyorum...' // Generic response
        : 'Checking your request...',
      inputTokens: 100, // Estimated
      outputTokens: 50,
      hadToolSuccess: true,
      hadToolFailure: false,
      failedTool: null,
      toolsCalled: gatedTools, // Would have called these
      iterations: 1,
      chat: null,
      _dryRun: true
    };
  }

  let iterations = 0;
  let hadToolSuccess = false;
  let hadToolFailure = false;
  let failedTool = null;
  const toolsCalled = [];
  const toolResults = []; // Collect all tool results for guardrails

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  let result;
  let responseText = '';

  // ========================================
  // ARCHITECTURE CHANGE: forceToolCall REMOVED
  // ========================================
  // Previously, backend would skip LLM and call tools directly (forceToolCall).
  // This meant LLM never saw the conversation and couldn't produce natural responses.
  // Now ALL tool calls go through LLM's function calling mechanism.
  // LLM sees context → decides to call tool → gets result → writes natural response.
  //
  // If state.forceToolCall exists from old code paths, log warning and ignore.
  if (state.forceToolCall) {
    console.warn('⚠️ [ToolLoop] DEPRECATED: state.forceToolCall detected but IGNORED. LLM handles tool calls now.');
    delete state.forceToolCall;
  }

  // Send initial message to LLM
  result = await chat.sendMessage(userMessage);

  totalInputTokens += result.response.usageMetadata?.promptTokenCount || 0;
  totalOutputTokens += result.response.usageMetadata?.candidatesTokenCount || 0;

  // DEBUG: Log raw response
  console.log('🔍 [ToolLoop] Raw response:', {
    hasText: !!result.response.text(),
    textPreview: result.response.text()?.substring(0, 100) || '(empty)',
    hasFunctionCalls: !!(result.response.functionCalls()?.length),
    functionCallCount: result.response.functionCalls()?.length || 0,
    candidates: result.response.candidates?.length || 0,
    finishReason: result.response.candidates?.[0]?.finishReason || 'unknown'
  });

  // Tool calling loop
  while (iterations < MAX_ITERATIONS) {
    const functionCalls = result.response.functionCalls();

    if (!functionCalls || functionCalls.length === 0) {
      // No more tool calls - LLM returned text response
      responseText = result.response.text() || '';
      break;
    }

    // After each iteration, also capture any text response (for final turn after tool results)
    const iterationText = result.response.text();
    if (iterationText) {
      responseText = iterationText;
    }

    iterations++;
    console.log(`🔄 [ToolLoop] Iteration ${iterations}/${MAX_ITERATIONS}`);

    // Execute all function calls in this iteration
    const functionResponses = [];

    for (const functionCall of functionCalls) {
      const toolName = functionCall.name;
      const toolArgs = functionCall.args;

      console.log(`🔧 [ToolLoop] Calling tool: ${toolName}`);
      toolsCalled.push(toolName);

      const toolStartTime = Date.now();

      // IDEMPOTENCY CHECK: Has this tool already been executed for this messageId?
      const idempotencyKey = {
        businessId: business.id,
        channel,
        messageId,
        toolName
      };

      const cachedResult = await getToolExecutionResult(idempotencyKey);

      let toolResult;

      // ════════════════════════════════════════════════════════════════════
      // TEST_MOCK_TOOLS HOOK (test-only, zero production impact)
      // ════════════════════════════════════════════════════════════════════
      // When TEST_MOCK_TOOLS=1 and state._mockToolOutputs has a fixture
      // for this tool, return the fixture instead of calling the real tool.
      // This enables deterministic golden suite testing without side-effects.
      // ════════════════════════════════════════════════════════════════════
      if (
        process.env.TEST_MOCK_TOOLS === '1' &&
        state._mockToolOutputs &&
        state._mockToolOutputs[toolName]
      ) {
        toolResult = { ...state._mockToolOutputs[toolName] };
        console.log(`🧪 [ToolLoop] TEST_MOCK_TOOLS: Using mock fixture for ${toolName} (outcome=${toolResult.outcome})`);
      } else if (cachedResult) {
        // Use cached result (prevents duplicate operations)
        console.log(`♻️ [ToolLoop] Using cached result for ${toolName} (duplicate messageId)`);
        toolResult = cachedResult;
      } else {
        // Execute tool with retry
        toolResult = await executeToolWithRetry(
          async (name, args) => {
            // executeTool signature: (toolName, args, business, context)
            return await executeTool(name, args, business, {
              state,
              language,
              sessionId,
              messageId, // For tool-level idempotency
              channel,
              channelUserId,  // Channel identity signal for identity proof
              conversationHistory, // For topic generation in create_callback
              extractedSlots: state.extractedSlots || {} // Pass extractedSlots for argument normalization
            });
          },
          toolName,
          toolArgs,
          1 // maxRetries (1 retry = 2 total attempts)
        );

        // CACHE RESULT: Store for future duplicate requests
        if (toolResult.success) {
          await setToolExecutionResult(idempotencyKey, toolResult);
        }
      }

      const toolExecutionTime = Date.now() - toolStartTime;

      // Apply tool fail policy
      const failPolicyResult = applyToolFailPolicy({
        toolResult,
        toolName,
        language,
        channel,
        sessionId,
        executionTime: toolExecutionTime,
        metrics
      });

      if (failPolicyResult) {
        // Tool failed - return forced template immediately
        console.error(`❌ [ToolLoop] Tool ${toolName} failed, returning forced response`);

        hadToolFailure = true;
        failedTool = toolName;

        return {
          reply: failPolicyResult.reply,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          hadToolSuccess: false,
          hadToolFailure: true,
          failedTool: toolName,
          toolsCalled,
          metadata: failPolicyResult.metadata
        };
      }

      // Tool succeeded
      hadToolSuccess = true;

      // Collect tool result for guardrails (for NOT_FOUND detection etc.)
      // P1-FIX: Standardized format - always use explicit null instead of fallbacks
      toolResults.push({
        name: toolName,
        success: toolResult.success ?? false,
        output: toolResult.data ?? null, // Don't fallback to full toolResult - keep clean
        outcome: toolResult.outcome ?? null,
        message: toolResult.message ?? null,
        stateEvents: toolResult.stateEvents ?? []
      });

      console.log(`📊 [ToolLoop] Tool result collected:`, {
        name: toolName,
        outcome: toolResult.outcome,
        success: toolResult.success,
        hasData: !!toolResult.data
      });

      // Store tool result for state updates
      if (toolResult.data) {
        // Update anchor with tool truth
        if (toolName === 'customer_data_lookup') {
          state.anchor = {
            truth: toolResult.data,
            timestamp: new Date().toISOString()
          };
        }

        // Stock tool results → write to anchor so classifier knows context
        if (toolName === 'check_stock_crm' || toolName === 'get_product_stock') {
          const matchType = toolResult.data.match_type; // EXACT_SKU | MULTIPLE_CANDIDATES
          state.anchor = {
            type: 'STOCK',
            stock: {
              matchType,
              productName: toolResult.data.product_name || toolResult.data.title || toolResult.data.search_term,
              availability: toolResult.data.availability || null,
              disambiguationRequired: !!toolResult.data.disambiguation_required
            },
            timestamp: new Date().toISOString()
          };
          state.activeFlow = 'STOCK_CHECK';
          state.flowStatus = matchType === 'EXACT_SKU' ? 'post_result' : 'in_progress';

          // Stock flows NEVER need PII verification — clear any stale verification state
          if (state.verification?.status === 'pending') {
            console.log('🧹 [ToolLoop] Clearing stale verification — stock flow does not require PII');
            state.verification = { status: 'none' };
          }

          console.log(`📦 [ToolLoop] Stock anchor set: matchType=${matchType}, flow=STOCK_CHECK`);
        }

        // Store callback ID for tracking
        if (toolName === 'create_callback' && toolResult.data.callbackId) {
          state.lastCallbackId = toolResult.data.callbackId;
        }
      }

      // ════════════════════════════════════════════════════════════════════
      // CHANNEL IDENTITY PROOF AUTOVERIFY (Shared Helper)
      // ════════════════════════════════════════════════════════════════════
      const autoverifyResult = await tryAutoverify({
        toolResult, toolName, business, state, language, metrics
      });

      if (autoverifyResult.applied) {
        // Update the collected toolResult in toolResults array
        const lastToolResult = toolResults[toolResults.length - 1];
        if (lastToolResult && lastToolResult.name === toolName) {
          lastToolResult.outcome = ToolOutcome.OK;
          lastToolResult.output = toolResult.data;
          lastToolResult.message = toolResult.message;
          lastToolResult.stateEvents = toolResult.stateEvents;
        }

        // Update anchor with verified tool truth
        if (toolName === 'customer_data_lookup') {
          state.anchor = {
            truth: toolResult.data,
            timestamp: new Date().toISOString()
          };
        }
      }

      // Apply centralized outcome -> state events (single writer: orchestrator)
      // Controlled by USE_STATE_EVENTS flag. Set FEATURE_USE_STATE_EVENTS=false to revert.
      const useStateEvents = process.env.FEATURE_USE_STATE_EVENTS !== 'false';
      if (useStateEvents) {
        const outcomeEvents = deriveOutcomeEvents({ toolName, toolResult });
        if (outcomeEvents.length > 0) {
          applyOutcomeEventsToState(state, outcomeEvents);
          console.log('🧭 [ToolLoop] Applied outcome events:', outcomeEvents.map(e => e.type));
        }
      } else {
        console.log('🚩 [ToolLoop] USE_STATE_EVENTS=false, skipping centralized event pipeline');
      }

      const outcome = normalizeOutcome(toolResult.outcome);

      if (shouldAskVerification(outcome)) {
        console.log('🔐 [ToolLoop] Verification required outcome received');
      }

      // Terminal outcomes are decided by centralized outcome policy.
      if (shouldTerminate(outcome)) {
        if (outcome === ToolOutcome.NOT_FOUND) {
          console.log(`📭 [ToolLoop] NOT_FOUND terminal state - stopping loop, NOT sending to LLM`);

          // Count NOT_FOUND only when probing signal is suspicious (rapid/sequential).
          const enumerationResult = await checkEnumerationAttempt(sessionId, {
            mode: 'not_found',
            signal: {
              userMessage,
              toolName
            }
          });
          if (enumerationResult.shouldBlock) {
            console.log('🚨 [ToolLoop] Session blocked after suspicious NOT_FOUND pattern');
          }

          responseText = toolResult.message || GENERIC_ERROR_MESSAGES[language] || GENERIC_ERROR_MESSAGES.TR;

          return {
            reply: responseText,
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            hadToolSuccess: true,
            hadToolFailure: false,
            failedTool: null,
            toolsCalled,
            toolResults,
            iterations,
            chat: null,
            _terminalState: ToolOutcome.NOT_FOUND,
            _enumerationCount: enumerationResult.attempts,
            _enumerationCounted: enumerationResult.counted
          };
        }

        console.log(`⚠️ [ToolLoop] ${outcome || toolResult.outcome} terminal state - stopping loop`);
        responseText = toolResult.message || GENERIC_ERROR_MESSAGES[language] || GENERIC_ERROR_MESSAGES.TR;

        return {
          reply: responseText,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          hadToolSuccess: true,
          hadToolFailure: false,
          failedTool: null,
          toolsCalled,
          toolResults,
          iterations,
          chat: null,
          _terminalState: outcome || 'TERMINAL'
        };
      }

      // P0-2 FIX: Strip internal flags from LLM response
      // SECURITY: outcome, success, notFound flags are internal - LLM shouldn't see them
      // Only send: message (for context) and data (if verified)
      const responseData = {
        message: toolResult.message || null
      };

      // Only include data if outcome is OK (verified data)
      // VERIFICATION_REQUIRED: Don't leak anchor data to LLM
      if (outcome === ToolOutcome.OK && toolResult.data) {
        responseData.data = toolResult.data;
      }

      // Log payload for debugging (show what's stripped)
      console.log(`📤 [ToolLoop] functionResponse for ${toolName}:`, {
        originalOutcome: toolResult.outcome,
        strippedFields: ['outcome', 'success', 'notFound', 'verificationRequired'],
        sentToLLM: JSON.stringify(responseData)
      });

      functionResponses.push({
        functionResponse: {
          name: toolName,
          response: responseData
        }
      });
    }

    // Send function responses back to LLM
    result = await chat.sendMessage(functionResponses);

    totalInputTokens += result.response.usageMetadata?.promptTokenCount || 0;
    totalOutputTokens += result.response.usageMetadata?.candidatesTokenCount || 0;
  }

  // Check if we hit max iterations
  if (iterations >= MAX_ITERATIONS) {
    console.warn(`⚠️ [ToolLoop] Hit max iterations (${MAX_ITERATIONS})`);
    responseText = result.response.text() || '';
  }

  // EMPTY-REPLY GUARD: If responseText is still empty after tool loop, get final text from last result
  if (!responseText && result) {
    responseText = result.response.text() || '';
    console.warn(`⚠️ [ToolLoop] Empty response after tool loop, extracted: "${responseText.substring(0, 50)}..."`);
  }

  // FINAL FALLBACK: If still empty, return a user-friendly message
  // NOTE: This should never happen — if it does, it's a bug to investigate
  if (!responseText) {
    console.error('❌ [ToolLoop] CRITICAL: No response text after all attempts');
    responseText = language === 'TR'
      ? 'Bir sorun oluştu. Lütfen tekrar deneyin veya farklı bir şekilde sorunuzu iletin.'
      : 'Something went wrong. Please try again or rephrase your question.';
  }

  return {
    reply: responseText,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    hadToolSuccess,
    hadToolFailure,
    failedTool,
    toolsCalled,
    toolResults, // For guardrails (NOT_FOUND detection etc.)
    iterations,
    chat // Return chat session for potential correction
  };
}

export default { executeToolLoop };
