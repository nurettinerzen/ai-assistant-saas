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
    sessionId,
    messageId,
    metrics,
    effectsEnabled = true // DRY-RUN flag (default: true for backward compat)
  } = params;

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

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  let result;
  let responseText = '';

  // ========================================
  // FORCE TOOL CALL: Skip LLM, call tool directly
  // ========================================
  if (state.forceToolCall) {
    const { tool: toolName, args: forcedArgs } = state.forceToolCall;
    console.log(`🔧 [ToolLoop] FORCE TOOL CALL: ${toolName}`);

    toolsCalled.push(toolName);

    // Execute tool
    const toolResult = await executeTool(toolName, forcedArgs, business, {
      state,
      language,
      sessionId,
      messageId,
      channel,
      conversationHistory,
      extractedSlots: state.extractedSlots || {}
    });

    // Clear force flag
    delete state.forceToolCall;

    // P0: Handle verification required outcome
    if (toolResult.outcome === 'VERIFICATION_REQUIRED') {
      console.log('🔐 [ToolLoop-Force] Verification required, updating state');
      state.verification = state.verification || { status: 'none', attempts: 0 };
      state.verification.status = 'pending';
      state.verification.pendingField = toolResult.data?.askFor || 'name';
      state.verification.anchor = toolResult.data?.anchor;
      state.verification.attempts = 0;
      hadToolSuccess = true;
      responseText = toolResult.message;
      console.log('🔐 [ToolLoop-Force] Verification state updated');
    } else if (toolResult.outcome === 'OK') {
      hadToolSuccess = true;
      responseText = toolResult.message || (language === 'TR'
        ? 'Talebiniz alındı, en kısa sürede size dönüş yapacağız.'
        : 'Your request has been received, we will get back to you shortly.');
    } else {
      hadToolFailure = true;
      failedTool = toolName;
      responseText = toolResult.message || (language === 'TR'
        ? 'İşlem sırasında bir sorun oluştu.'
        : 'An error occurred during processing.');
    }

    return {
      reply: responseText,
      inputTokens: 0, // No LLM call
      outputTokens: 0,
      hadToolSuccess,
      hadToolFailure,
      failedTool,
      toolsCalled,
      iterations: 1,
      chat: null
    };
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

      if (cachedResult) {
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

      // Store tool result for state updates
      if (toolResult.data) {
        // Update anchor with tool truth
        if (toolName === 'customer_data_lookup') {
          state.anchor = {
            truth: toolResult.data,
            timestamp: new Date().toISOString()
          };
        }

        // Store callback ID for tracking
        if (toolName === 'create_callback' && toolResult.data.callbackId) {
          state.lastCallbackId = toolResult.data.callbackId;
        }
      }

      // P0: Handle verification required outcome
      if (toolResult.outcome === 'VERIFICATION_REQUIRED') {
        console.log('🔐 [ToolLoop] Verification required, updating state');
        state.verification = state.verification || { status: 'none', attempts: 0 };
        state.verification.status = 'pending';
        state.verification.pendingField = toolResult.data?.askFor || 'name';
        state.verification.anchor = toolResult.data?.anchor;
        state.verification.attempts = 0;
        console.log('🔐 [ToolLoop] Verification state updated:', {
          status: state.verification.status,
          pendingField: state.verification.pendingField
        });
      }

      // Build function response for LLM (Gemini format)
      // ALWAYS include message + outcome so AI has complete context
      const responseData = {
        ...(toolResult.data || {}),
        outcome: toolResult.outcome || 'OK',
        message: toolResult.message || null
      };

      // Log payload for debugging
      console.log(`📤 [ToolLoop] functionResponse for ${toolName}:`, JSON.stringify(responseData, null, 2));

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

  // FINAL FALLBACK: If still empty, return a safe message
  if (!responseText) {
    console.error('❌ [ToolLoop] CRITICAL: No response text after all attempts');
    responseText = language === 'TR'
      ? 'Talebinizi işledim ama bir cevap oluşturamadım. Lütfen tekrar deneyin.'
      : 'I processed your request but could not generate a response. Please try again.';
  }

  return {
    reply: responseText,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    hadToolSuccess,
    hadToolFailure,
    failedTool,
    toolsCalled,
    iterations,
    chat // Return chat session for potential correction
  };
}

export default { executeToolLoop };
