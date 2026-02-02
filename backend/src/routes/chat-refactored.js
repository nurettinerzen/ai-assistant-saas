/**
 * Chat Widget API - REFACTORED WITH STATE MACHINE
 *
 * New architecture:
 * - State-based conversation flow
 * - Session mapping (no PII in sessionId)
 * - Flow-based tool permissions
 * - Session-based verification
 * - Turn-based atomic state writes
 */

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { getDateTimeContext } from '../utils/dateTime.js';
import { buildAssistantPrompt, getActiveTools as getPromptBuilderTools } from '../services/promptBuilder.js';
import { isFreePlanExpired } from '../middleware/checkPlanExpiry.js';
import { calculateTokenCost, hasFreeChat } from '../config/plans.js';
import callAnalysis from '../services/callAnalysis.js';

// NEW: State machine services
import { getOrCreateSession } from '../services/session-mapper.js';
import { getState, updateState } from '../services/state-manager.js';
import { shouldRunIntentRouter } from '../services/router-decision.js';
import { processSlotInput } from '../services/slot-processor.js';
import { routeIntent } from '../services/intent-router.js';
import { routeMessage, handleDispute } from '../services/message-router.js';
import { isFeatureEnabled } from '../config/feature-flags.js';
import { validateActionClaim } from '../services/action-claim-validator.js';
import { validateComplaintResolution, forceCallbackCreation } from '../services/complaint-enforcer.js';
import { logClassification, logRoutingDecision, logViolation, logToolExecution } from '../services/routing-metrics.js';
import { getFlow, getAllowedTools as getFlowAllowedTools } from '../config/flow-definitions.js';
import { toolRegistry } from '../services/tool-registry.js';
import { executeTool } from '../tools/index.js';
import { ToolOutcome } from '../tools/toolResult.js';
import {
  needsVerification,
  isVerified,
  startVerification,
  processVerificationInput
} from '../services/verification-handler.js';

// NEW: Production guardrails
import { getToolFailResponse, validateResponseAfterToolFail, executeToolWithRetry } from '../services/tool-fail-handler.js';
import { getGatedTools, canExecuteTool } from '../services/tool-gating.js';

// SECURITY (P0): Response firewall
import { sanitizeResponse, logFirewallViolation } from '../utils/response-firewall.js';

// CORE: Channel-agnostic orchestrator (step-by-step)
import { handleIncomingMessage } from '../core/handleIncomingMessage.js';

// Gemini utils
import {
  getGeminiModel,
  buildGeminiChatHistory,
  extractTokenUsage
} from '../services/gemini-utils.js';

// Session lock & risk detection
import { isSessionLocked, getLockMessage, lockSession } from '../services/session-lock.js';
import { detectUserRisks, getPIIWarningMessages } from '../services/user-risk-detector.js';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * Main message handler with state machine
 * NOW USES CORE ORCHESTRATOR (step-by-step pipeline)
 */
async function handleMessage(sessionId, businessId, userMessage, systemPrompt, conversationHistory, language, business, assistant, timezone, clientSessionId) {
  console.log(`\n📨 [Chat Adapter] Delegating to core orchestrator with sessionId: ${sessionId}`);

  // Call core orchestrator (step-by-step pipeline)
  // CRITICAL: Pass sessionId to prevent orchestrator from creating new session
  const result = await handleIncomingMessage({
    channel: 'CHAT',
    business,
    assistant,
    channelUserId: clientSessionId || `temp_${Date.now()}`,
    sessionId, // CRITICAL: Prevent bypass by passing existing sessionId
    messageId: `chat_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    userMessage,
    language,
    timezone: timezone || 'Europe/Istanbul',
    metadata: {
      businessId
    }
  });

  return {
    reply: result.reply,
    locked: result.locked,
    lockReason: result.lockReason,
    lockUntil: result.lockUntil,
    inputTokens: result.inputTokens || 0,
    outputTokens: result.outputTokens || 0,
    toolsCalled: result.toolsCalled || []
  };
}

/**
 * LEGACY: Old handleMessage implementation (kept for reference, delete after validation)
 */
async function handleMessageLEGACY(sessionId, businessId, userMessage, systemPrompt, conversationHistory, language, business) {
  console.log(`\n📨 [HandleMessage] Session: ${sessionId}, Message: "${userMessage.substring(0, 50)}..."`);

  // 1. Get current state
  let state = await getState(sessionId);
  console.log(`📊 [State] Current:`, {
    activeFlow: state.activeFlow,
    flowStatus: state.flowStatus,
    expectedSlot: state.expectedSlot,
    verification: state.verification?.status
  });

  // Store businessId in state if not present
  if (!state.businessId) {
    state.businessId = businessId;
  }

  // 2. DECISION: Should we run intent router?
  // NEW: Use message-router for intelligent routing (feature flag)
  let runRouter = false;
  let routedThisTurn = false; // Track if router just started/changed flow this turn
  let messageRouting = null;

  if (isFeatureEnabled('USE_MESSAGE_TYPE_ROUTING')) {
    console.log('🚩 [Feature] Message-type routing ENABLED');

    // Get last assistant message from history
    const lastAssistantMessage = conversationHistory
      .slice()
      .reverse()
      .find(msg => msg.role === 'assistant')?.content || '';

    // Use new message router
    messageRouting = await routeMessage(userMessage, state, lastAssistantMessage, language, business);

    // Log classification metrics
    logClassification({
      sessionId,
      messageType: messageRouting.messageType,
      state,
      userMessage,
      lastAssistantMessage
    });

    // Handle different routing decisions
    if (messageRouting.routing.action === 'HANDLE_DISPUTE') {
      console.log('⚠️ [Router] DISPUTE detected - converting to COMPLAINT flow');

      // User disputes result - convert to complaint
      const disputeResult = await handleDispute(userMessage, state, language, business);

      // Start complaint flow with context
      const flow = getFlow('COMPLAINT');
      state.activeFlow = flow.name;
      state.flowStatus = 'in_progress';
      state.collectedSlots = {};
      state.allowedTools = flow.allowedTools;
      state.expectedSlot = flow.requiredSlots[0];

      // Preserve anchor if requested
      if (messageRouting.routing.preserveAnchor !== false) {
        // Keep anchor data
      } else {
        // Clear anchor
        state.anchor = {
          order_number: null,
          customer_id: null,
          phone: null,
          lastFlowType: null,
          lastResult: null
        };
      }

      routedThisTurn = true;
      console.log(`✅ [Flow] Started COMPLAINT (from dispute), Expected slot: ${state.expectedSlot}`);

      // Log routing decision
      logRoutingDecision({
        sessionId,
        routing: messageRouting.routing,
        triggerRule: messageRouting.messageType.triggerRule,
        state: { activeFlow: state.activeFlow, flowStatus: state.flowStatus },
        newFlow: 'COMPLAINT',
        newFlowStatus: 'in_progress'
      });

    } else if (messageRouting.routing.action === 'RUN_INTENT_ROUTER') {
      runRouter = true;

    } else if (messageRouting.routing.action === 'ACKNOWLEDGE_CHATTER') {
      console.log('💬 [Router] CHATTER detected - letting Gemini handle naturally');
      // Don't run router, don't process slot - just let Gemini respond
      runRouter = false;

    } else if (messageRouting.routing.action === 'PROCESS_SLOT') {
      // Will be handled in slot processing section
      runRouter = false;
    }

  } else {
    // Old behavior: use shouldRunIntentRouter
    console.log('🚩 [Feature] Message-type routing DISABLED (legacy mode)');
    runRouter = shouldRunIntentRouter(state, userMessage);
  }

  if (runRouter) {
    console.log('🎯 [Router] Running intent detection');

    // Run intent router
    const intentResult = await routeIntent(userMessage, conversationHistory, language);
    console.log('🎯 [Router] Result:', intentResult.intent, 'Confidence:', intentResult.confidence);

    // Get flow definition
    let flow = getFlow(intentResult.intent);
    if (!flow) {
      console.warn(`⚠️ [Router] Unknown intent: ${intentResult.intent}, defaulting to GENERAL`);
      flow = getFlow('GENERAL');
    }

    // Start new flow
    state.activeFlow = flow.name;
    state.flowStatus = 'in_progress';
    state.collectedSlots = {};
    state.allowedTools = flow.allowedTools;

    // Set expected slot if flow has required slots
    if (flow.requiredSlots && flow.requiredSlots.length > 0) {
      state.expectedSlot = flow.requiredSlots[0];
    } else {
      state.expectedSlot = null;
    }

    routedThisTurn = true; // Mark that we just started a flow
    console.log(`✅ [Flow] Started: ${flow.name}, Expected slot: ${state.expectedSlot}`);
  } else if (!messageRouting || messageRouting.routing.action !== 'HANDLE_DISPUTE') {
    console.log('⏭️ [Router] Skipping (flow in progress or slot expected)');
  }

  // 3. Slot filling (if expected AND router didn't just run)
  let shouldProcessSlot = state.expectedSlot && !routedThisTurn;

  // NEW: Feature flag - only process if message type is SLOT_ANSWER
  if (isFeatureEnabled('USE_MESSAGE_TYPE_ROUTING') && shouldProcessSlot) {
    if (messageRouting && messageRouting.messageType.type !== 'SLOT_ANSWER') {
      console.log(`⏭️ [Slot] Skipping - message type is ${messageRouting.messageType.type}, not SLOT_ANSWER`);
      shouldProcessSlot = false;
    }
  }

  if (routedThisTurn) {
    console.log(`⏭️ [Slot] Skipping slot processing (flow just started this turn)`);
  }

  if (shouldProcessSlot) {
    console.log(`🎰 [Slot] Processing input for: ${state.expectedSlot}`);

    // Pass state for loop guard
    const slotResult = processSlotInput(state.expectedSlot, userMessage, state);

    // Check for loop escalation
    if (slotResult.escalate) {
      console.error('🚫 [Loop Guard] Escalating to human handoff');

      // Clear expected slot to break loop
      state.expectedSlot = null;
      state.flowStatus = 'paused';
      state.pauseReason = 'loop_detected';

      await updateState(sessionId, state);

      return {
        reply: slotResult.hint,
        inputTokens: 0,
        outputTokens: 0
      };
    }

    if (slotResult.filled) {
      // Slot filled successfully
      console.log(`✅ [Slot] Filled: ${slotResult.slot} = ${slotResult.value}`);
      state.collectedSlots[slotResult.slot] = slotResult.value;
      state.expectedSlot = null;

      // Reset attempt counter on success
      if (state.slotAttempts[state.expectedSlot]) {
        delete state.slotAttempts[state.expectedSlot];
      }

      // Check if more required slots needed
      const flow = getFlow(state.activeFlow);
      const remainingSlots = flow.requiredSlots.filter(
        slot => !Object.keys(state.collectedSlots).some(k =>
          k.toLowerCase() === slot.toLowerCase().replace(/_/g, '')
        )
      );

      if (remainingSlots.length > 0) {
        state.expectedSlot = remainingSlots[0];
        console.log(`🎰 [Slot] Next required slot: ${state.expectedSlot}`);

        // Generate slot request message
        const slotMessages = {
          order_number: language === 'TR' ? 'Sipariş numaranızı öğrenebilir miyim?' : 'May I have your order number?',
          ticket_number: language === 'TR' ? 'Arıza/servis numaranızı alabilir miyim?' : 'May I have your ticket number?',
          name: language === 'TR' ? 'İsminizi ve soyisminizi alabilir miyim?' : 'May I have your full name?',
          phone: language === 'TR' ? 'Telefon numaranızı alabilir miyim?' : 'May I have your phone number?',
          complaint_details: language === 'TR' ? 'Şikayetinizi detaylı anlatır mısınız?' : 'Please describe your complaint in detail.',
        };

        const slotMessage = slotMessages[state.expectedSlot] || (language === 'TR' ? 'Lütfen bilgi verin.' : 'Please provide information.');

        // Update state and return slot request
        await updateState(sessionId, state);

        return {
          reply: slotMessage,
          inputTokens: 0,
          outputTokens: 0,
        };
      }
    } else {
      // Slot not filled - provide hint
      console.log(`❌ [Slot] Not filled: ${slotResult.error}`);

      // Increment attempt counter for loop guard
      if (!state.slotAttempts[state.expectedSlot]) {
        state.slotAttempts[state.expectedSlot] = 0;
      }
      state.slotAttempts[state.expectedSlot]++;
      console.log(`🔁 [Loop Guard] Slot "${state.expectedSlot}" attempt: ${state.slotAttempts[state.expectedSlot]}`);

      // Update state (increment message count + attempt)
      await updateState(sessionId, state);

      return {
        reply: slotResult.hint,
        inputTokens: 0,
        outputTokens: 0,
      };
    }
  }

  // 4. Verification will be handled at TOOL EXECUTION time (not at flow start)
  // Tools like customer_data_lookup will check verification when actually accessing data
  const flow = getFlow(state.activeFlow);

  // 4.5 GUARDRAIL: Confidence-based tool gating
  const classifierConfidence = messageRouting?.messageType?.confidence || 0.9;
  const originalAllowedTools = state.allowedTools || [];

  // Apply gating based on classifier confidence
  const gatedTools = getGatedTools(classifierConfidence, state.activeFlow, originalAllowedTools);

  console.log(`🛡️ [ToolGating] Confidence: ${classifierConfidence.toFixed(2)} → Gated tools:`, gatedTools);

  // Update state with gated tools
  state.allowedTools = gatedTools;

  // 5. All slots collected → Call Gemini
  console.log('🤖 [Gemini] Preparing request with allowed tools:', state.allowedTools);

  // Get allowed tool definitions
  const allowedToolDefs = toolRegistry.pick(state.allowedTools);
  console.log('🔧 [Tools] Allowed tool definitions:', allowedToolDefs.map(t => t.function.name));

  // Get Gemini model with allowed tools
  const model = getGeminiModel({
    model: 'gemini-2.5-flash',
    temperature: 0.7,
    maxOutputTokens: 1500,
    tools: allowedToolDefs.length > 0 ? allowedToolDefs : null
  });

  // Build conversation history
  const chatHistory = buildGeminiChatHistory(systemPrompt, conversationHistory, true);

  // Start chat
  const chat = model.startChat({ history: chatHistory });

  // Token tracking
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // Send user message
  let result = await chat.sendMessage(userMessage);
  let response = result.response;

  // Track tokens
  const initialTokens = extractTokenUsage(response);
  totalInputTokens += initialTokens.inputTokens;
  totalOutputTokens += initialTokens.outputTokens;

  // Handle function calls
  let iterations = 0;
  const maxIterations = 3;
  const toolsCalled = []; // Track which tools were called (for complaint enforcement)
  let hadToolSuccess = false; // Track if ANY tool succeeded (for action claim validation)

  while (iterations < maxIterations) {
    const functionCalls = response.functionCalls();

    if (!functionCalls || functionCalls.length === 0) {
      break;
    }

    const functionCall = functionCalls[0];
    // SECURITY: Don't log full args (may contain PII)
    console.log('🔧 [Gemini] Function call:', functionCall.name, 'argCount:', Object.keys(functionCall.args || {}).length);

    // SECURITY GATE 1: Tool must be in allowedTools
    if (!state.allowedTools.includes(functionCall.name)) {
      console.warn(`🚫 [Security] Tool ${functionCall.name} NOT in allowedTools:`, state.allowedTools);

      // Send error back to Gemini
      result = await chat.sendMessage([{
        functionResponse: {
          name: functionCall.name,
          response: {
            success: false,
            error: 'TOOL_NOT_ALLOWED',
            message: language === 'TR'
              ? 'Bu işlem şu anda kullanılamıyor.'
              : 'This operation is not available right now.'
          }
        }
      }]);
      response = result.response;

      const tokens = extractTokenUsage(response);
      totalInputTokens += tokens.inputTokens;
      totalOutputTokens += tokens.outputTokens;

      iterations++;
      continue;
    }

    // SECURITY GATE 2: Removed - Verification now handled inside tool handler
    // Tool (e.g. customer_data_lookup) will check verification when accessing data

    // GUARDRAIL: Runtime tool gating check
    const toolGateCheck = canExecuteTool(functionCall.name, {
      confidence: messageRouting?.messageType?.confidence || 0.9,
      activeFlow: state.activeFlow,
      verificationStatus: state.verification?.status || 'none'
    });

    if (!toolGateCheck.allowed) {
      console.error('🚫 [ToolGate] Tool blocked:', toolGateCheck.reason);

      // Return forced template (don't let LLM decide)
      const forcedResponse = getToolFailResponse(functionCall.name, language, 'CHAT');
      await updateState(sessionId, state);

      return {
        reply: forcedResponse.reply,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        hadToolFailure: true
      };
    }

    // Execute tool with retry + metrics
    const startTime = Date.now();
    const toolExecutor = async (name, args) => {
      return executeTool(name, args, business, {
        channel: 'CHAT',
        sessionId: sessionId,
        conversationId: sessionId,
        intent: state.activeFlow,
        requiresVerification: flow?.requiresVerification || false
      });
    };

    const toolResult = await executeToolWithRetry(
      toolExecutor,
      functionCall.name,
      functionCall.args,
      1 // Max 1 retry for critical tools
    );

    const executionTime = Date.now() - startTime;

    console.log('🔧 [Tool] Result:', toolResult.success ? 'SUCCESS' : 'FAILED');

    // Log tool execution metrics
    logToolExecution({
      sessionId,
      toolName: functionCall.name,
      success: toolResult.success,
      attempts: toolResult.attempts || 1,
      errorType: toolResult.error || null,
      executionTime
    });

    // Track tool call (for complaint enforcement)
    toolsCalled.push(functionCall.name);
    if (toolResult.success) {
      hadToolSuccess = true; // Track at least one success
    }

    // GUARDRAIL: If tool failed, return forced template (DON'T let LLM make up response)
    if (!toolResult.success) {
      console.error('❌ [Tool] Failed, returning forced template');

      // Log violation
      logViolation('TOOL_FAILURE', {
        sessionId,
        details: {
          tool: functionCall.name,
          error: toolResult.error,
          attempts: toolResult.attempts
        }
      });

      const forcedResponse = getToolFailResponse(functionCall.name, language, 'CHAT');
      await updateState(sessionId, state);

      return {
        reply: forcedResponse.reply,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        hadToolFailure: true
      };
    }

    // HANDLE VERIFICATION_REQUIRED OUTCOME FROM TOOL
    if (toolResult.outcome === ToolOutcome.VERIFICATION_REQUIRED) {
      console.log('🔐 [Tool] Verification required, starting verification flow');
      console.log('🔐 [Tool] AskFor:', toolResult.data?.askFor);

      // Update state to start verification
      state.verification.status = 'pending';
      state.verification.pendingField = toolResult.data?.askFor || 'name';
      state.verification.attempts = 0;
      state.verification.anchor = toolResult.data?.anchor;

      console.log('🔐 [Verification] State updated to pending, field:', toolResult.data?.askFor);

      // Generate verification request message
      const verificationMessages = {
        name: language === 'TR'
          ? 'Kimlik doğrulaması için adınızı ve soyadınızı alabilir miyim?'
          : 'For verification, may I have your full name?',
        phone: language === 'TR'
          ? 'Kimlik doğrulaması için telefon numaranızı alabilir miyim?'
          : 'For verification, may I have your phone number?',
        email: language === 'TR'
          ? 'Kimlik doğrulaması için e-posta adresinizi alabilir miyim?'
          : 'For verification, may I have your email?'
      };

      const verificationMessage = verificationMessages[toolResult.data?.askFor] || toolResult.message;

      // Update state and return verification request
      await updateState(sessionId, state);

      return {
        reply: verificationMessage,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens
      };
    }

    // Send result back to Gemini
    result = await chat.sendMessage([{
      functionResponse: {
        name: functionCall.name,
        response: {
          success: toolResult.success,
          data: toolResult.data || null,
          message: toolResult.message || toolResult.error || 'Tool executed',
          context: toolResult.context || null
        }
      }
    }]);
    response = result.response;

    // Track tokens
    const tokens = extractTokenUsage(response);
    totalInputTokens += tokens.inputTokens;
    totalOutputTokens += tokens.outputTokens;

    // If tool executed successfully, mark flow as resolved
    if (toolResult.success) {
      state.flowStatus = 'resolved';
      console.log('✅ [Flow] Marked as resolved');

      // NEW: Set anchor data for follow-up/dispute handling
      if (isFeatureEnabled('USE_POST_RESULT_STATE')) {
        // CRITICAL: Use structured truth from tool, NOT LLM text!
        const truth = toolResult.truth || {};

        state.anchor = {
          order_number: state.collectedSlots.order_number || state.collectedSlots.orderNumber || truth.order?.orderNumber || null,
          customer_id: state.verification?.customerId || null,
          phone: state.collectedSlots.phone || state.verification?.collected?.phone || truth.phone || null,
          lastFlowType: state.activeFlow,
          // Store structured truth (for contradiction detection)
          truth: truth,
          // Store LLM text separately (for context only, NOT for routing!)
          lastResultText: text?.substring(0, 200) || null
        };
        state.flowStatus = 'post_result'; // Enter post-result grace period
        state.postResultTurns = 0;
        console.log('📍 [Flow] Anchor set with truth:', {
          flowType: state.anchor.lastFlowType,
          dataType: truth.dataType,
          orderStatus: truth.order?.status
        });
      }
    }

    iterations++;
  }

  // ============================================
  // COMPLAINT FLOW ENFORCEMENT
  // ============================================
  // Ensure COMPLAINT flow called create_callback
  if (isFeatureEnabled('ENFORCE_COMPLAINT_CALLBACK')) {
    const complaintValidation = validateComplaintResolution(
      state.activeFlow,
      state.flowStatus === 'resolved' || state.flowStatus === 'post_result',
      toolsCalled
    );

    if (!complaintValidation.valid) {
      console.error('🚫 [Enforcer] COMPLAINT VIOLATION:', complaintValidation.error);
      console.log('🔧 [Enforcer] Forcing create_callback...');

      // Log violation
      logViolation('COMPLAINT_NO_CALLBACK', {
        sessionId,
        details: {
          flow: state.activeFlow,
          toolsCalled: toolsCalled.join(', '),
          error: complaintValidation.error
        },
        resolved: false
      });

      // Force callback creation
      const forcedCallbackResult = await forceCallbackCreation(state, business, executeTool);

      if (forcedCallbackResult.success) {
        console.log('✅ [Enforcer] Callback created successfully');
        // Mark that we called the tool
        toolsCalled.push('create_callback');

        // Log as resolved
        logViolation('COMPLAINT_NO_CALLBACK', {
          sessionId,
          details: { forced: true, callbackRef: forcedCallbackResult.data?.reference },
          resolved: true
        });
      } else {
        console.error('❌ [Enforcer] Failed to create callback');

        // Log as unresolved
        logViolation('COMPLAINT_NO_CALLBACK', {
          sessionId,
          details: { forced: false, error: forcedCallbackResult.error },
          resolved: false
        });
      }
    }
  }

  // Get final text
  let text = '';
  try {
    text = response.text() || '';
  } catch (e) {
    console.warn('⚠️ Could not get text from response');
  }

  console.log('📝 [Gemini] Final response:', text.substring(0, 100));

  // 5.5 GUARDRAIL: Tool fail validation (CRITICAL - runs BEFORE action claim check)
  const toolFailValidation = validateResponseAfterToolFail(text, hadToolSuccess, language);

  if (!toolFailValidation.valid) {
    console.error('🚨 [CRITICAL] LLM made action claim after tool failure!');

    // Log critical violation
    logViolation('ACTION_CLAIM_AFTER_TOOL_FAIL', {
      sessionId,
      details: {
        originalText: text?.substring(0, 200),
        violationType: toolFailValidation.violationType,
        hadToolSuccess
      }
    });

    // HARD BLOCK: Use forced response
    text = toolFailValidation.forcedResponse;
  }

  // 5.6 ACTION CLAIM VALIDATION (if enabled)
  if (isFeatureEnabled('ENFORCE_ACTION_CLAIMS')) {
    const hadToolCalls = iterations > 0; // If we had function call iterations
    const actionValidation = validateActionClaim(text, hadToolCalls, language);

    if (!actionValidation.valid) {
      console.warn('⚠️ [Validation] ACTION CLAIM VIOLATION:', actionValidation.error);
      console.log('🔧 [Validation] Forcing AI to correct response...');

      // Log violation
      logViolation('ACTION_CLAIM', {
        sessionId,
        details: {
          originalText: text?.substring(0, 200),
          error: actionValidation.error,
          claimedAction: actionValidation.claimedAction
        },
        resolved: false // Will update after correction
      });

      // Send correction prompt
      try {
        const correctionResult = await chat.sendMessage(actionValidation.correctionPrompt);
        const correctedText = correctionResult.response.text();

        // Track tokens
        const correctionTokens = extractTokenUsage(correctionResult.response);
        totalInputTokens += correctionTokens.inputTokens;
        totalOutputTokens += correctionTokens.outputTokens;

        text = correctedText;
        console.log('✅ [Validation] Response corrected:', correctedText.substring(0, 100));

        // Log as resolved
        logViolation('ACTION_CLAIM', {
          sessionId,
          details: { correctedText: correctedText.substring(0, 200) },
          resolved: true
        });
      } catch (correctionError) {
        console.error('❌ [Validation] Correction failed:', correctionError.message);
        text = language === 'TR'
          ? 'Üzgünüm, bu konuda müşteri hizmetlerimize başvurmanız gerekiyor.'
          : 'I apologize, for this you need to contact our customer service.';

        // Log as unresolved
        logViolation('ACTION_CLAIM', {
          sessionId,
          details: { correctionFailed: true, error: correctionError.message },
          resolved: false
        });
      }
    }
  }

  // 6. Post-result turn management
  if (state.flowStatus === 'post_result') {
    state.postResultTurns++;
    console.log(`🔄 [Post-result] Turn ${state.postResultTurns}/3`);

    // After 3 turns, exit post-result grace period
    if (state.postResultTurns >= 3) {
      console.log('✅ [Post-result] Grace period ended - resetting to idle');
      state.flowStatus = 'idle';
      state.activeFlow = null;
      state.anchor = {
        order_number: null,
        customer_id: null,
        phone: null,
        lastFlowType: null,
        truth: null,
        lastResultText: null
      };
      state.postResultTurns = 0;
    }
  }

  // 7. Update state (turn-based atomic write)
  await updateState(sessionId, state);

  console.log('💾 [State] Updated and saved');

  return {
    reply: text,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens
  };
}

/**
 * POST /api/chat/widget - Main chat endpoint
 */
router.post('/widget', async (req, res) => {
  console.log('\n\n🆕 ========== NEW CHAT REQUEST ==========');
  console.log('📨 Request body:', req.body);

  try {
    const { embedKey, assistantId, sessionId: clientSessionId, message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    if (!embedKey && !assistantId) {
      return res.status(400).json({ error: 'embedKey or assistantId is required' });
    }

    // Get assistant and business
    let assistant;

    if (embedKey) {
      const business = await prisma.business.findUnique({
        where: { chatEmbedKey: embedKey },
        include: {
          assistants: {
            where: { isActive: true, callDirection: 'inbound' },
            orderBy: { createdAt: 'desc' },
            take: 1
          },
          integrations: { where: { isActive: true } },
          crmWebhook: true  // Required for CRM tool gating
        }
      });

      if (!business) {
        return res.status(404).json({ error: 'Invalid embed key' });
      }

      if (!business.chatWidgetEnabled) {
        return res.status(403).json({ error: 'Chat widget is disabled' });
      }

      if (!business.assistants || business.assistants.length === 0) {
        return res.status(404).json({ error: 'No active assistant found' });
      }

      assistant = { ...business.assistants[0], business };
    } else {
      assistant = await prisma.assistant.findFirst({
        where: { id: assistantId },
        include: {
          business: {
            include: {
              integrations: { where: { isActive: true } },
              crmWebhook: true  // Required for CRM tool gating
            }
          }
        }
      });
    }

    if (!assistant) {
      return res.status(404).json({ error: 'Assistant not found' });
    }

    const business = assistant.business;
    const language = business?.language || 'TR';
    const timezone = business?.timezone || 'Europe/Istanbul';

    // Check subscription
    const subscription = await prisma.subscription.findUnique({
      where: { businessId: business.id },
      include: { business: true }
    });

    if (subscription && isFreePlanExpired(subscription)) {
      console.log('🚫 Trial expired');
      return res.status(403).json({
        error: language === 'TR'
          ? 'Deneme süreniz doldu. Lütfen bir plan seçin.'
          : 'Your trial has expired. Please choose a plan.',
        expired: true
      });
    }

    // NEW: Get or create universal session ID
    const sessionId = await getOrCreateSession(business.id, 'CHAT', clientSessionId || `temp_${Date.now()}`);
    console.log(`🔑 [Session] Universal ID: ${sessionId}, Client ID: ${clientSessionId}`);

    // ===== ROUTE-LEVEL GUARD: CHECK SESSION LOCK =====

    // GUARD 1: Check if session is locked
    const lockStatus = await isSessionLocked(sessionId);
    if (lockStatus.locked) {
      console.log(`🔒 [Chat Guard] Session ${sessionId} is LOCKED (${lockStatus.reason})`);

      const lockMsg = getLockMessage(lockStatus.reason, language);
      return res.json({
        reply: lockMsg,
        locked: true,
        lockReason: lockStatus.reason,
        lockUntil: lockStatus.until
      });
    }

    // GUARD 2: Detect user input risks (abuse, threats, spam, PII)
    const state = await getState(sessionId);
    const riskDetection = detectUserRisks(message, language, state);

    // Persist state if abuse counter was updated
    if (riskDetection.warnings.some(w => w.type === 'PROFANITY')) {
      await updateState(sessionId, state);
      console.log(`[Chat Guard] State updated - abuse counter: ${state.abuseCounter}`);
    }

    // If critical risk detected → lock session immediately
    if (riskDetection.shouldLock) {
      console.log(`🚨 [Chat Guard] RISK DETECTED: ${riskDetection.reason}`);

      // Lock the session
      await lockSession(sessionId, riskDetection.reason);

      // Return lock message
      const lockMsg = getLockMessage(riskDetection.reason, language);
      return res.json({
        reply: lockMsg,
        locked: true,
        lockReason: riskDetection.reason
      });
    }

    // If PII warnings (but not locked yet), we'll prepend warnings to response later
    const piiWarnings = getPIIWarningMessages(riskDetection.warnings);
    const hasPIIWarnings = piiWarnings.length > 0;

    // ===== SESSION OK - CONTINUE NORMAL PROCESSING =====

    // Get date/time context
    const dateTimeContext = getDateTimeContext(timezone, language);

    // Get knowledge base
    const knowledgeItems = await prisma.knowledgeBase.findMany({
      where: { businessId: business.id, status: 'ACTIVE' }
    });

    let knowledgeContext = '';
    if (knowledgeItems && knowledgeItems.length > 0) {
      const kbByType = { URL: [], DOCUMENT: [], FAQ: [] };

      for (const item of knowledgeItems) {
        if (item.type === 'FAQ' && item.question && item.answer) {
          kbByType.FAQ.push(`S: ${item.question}\nC: ${item.answer}`);
        } else if (item.content) {
          kbByType[item.type]?.push(`[${item.title}]: ${item.content.substring(0, 100000)}`);
        }
      }

      if (kbByType.FAQ.length > 0) {
        knowledgeContext += '\n\n## SIK SORULAN SORULAR\n' + kbByType.FAQ.join('\n\n');
      }
      if (kbByType.URL.length > 0) {
        knowledgeContext += '\n\n## WEB SAYFASI İÇERİĞİ\n' + kbByType.URL.join('\n\n');
      }
      if (kbByType.DOCUMENT.length > 0) {
        knowledgeContext += '\n\n## DÖKÜMANLAR\n' + kbByType.DOCUMENT.join('\n\n');
      }
    }

    // SECURITY: KB Empty Hard Fallback
    // If KB is empty AND no CRM tools available, return fallback (prevent hallucination)
    const activeToolsList = getPromptBuilderTools(business, business.integrations || []);
    const hasCRMTools = activeToolsList.some(t =>
      t === 'customer_data_lookup' || t === 'check_order_status'
    );

    const isKBEmpty = !knowledgeContext || knowledgeContext.trim().length === 0;

    // Check if message looks like KB query (not CRM lookup)
    const looksLikeCRMQuery = /sipariş|order|müşteri|customer|takip|tracking|\d{5,}/i.test(message);

    if (isKBEmpty && !hasCRMTools && !looksLikeCRMQuery) {
      console.log('⚠️ KB_EMPTY_FALLBACK: No KB content, no CRM tools, returning hard fallback');

      const fallbackMessage = language === 'TR'
        ? `Üzgünüm, şu anda bilgi bankamızda bu konuda bilgi bulunmuyor. Size daha iyi yardımcı olabilmemiz için lütfen ${business.contactEmail || business.phone || 'müşteri hizmetleri'} üzerinden bizimle iletişime geçin.`
        : `Sorry, we don't have information about this in our knowledge base yet. For better assistance, please contact us at ${business.contactEmail || business.phone || 'customer service'}.`;

      return res.json({
        reply: fallbackMessage,
        kbEmptyFallback: true
      });
    }

    // Build system prompt
    const systemPromptBase = buildAssistantPrompt(assistant, business, activeToolsList);

    const kbInstruction = knowledgeContext ? (language === 'TR'
      ? '\n\n## BİLGİ BANKASI: Aşağıdaki bilgileri aktif kullan.'
      : '\n\n## KNOWLEDGE BASE: Use the information below actively.')
      : '';

    const fullSystemPrompt = `${dateTimeContext}\n\n${systemPromptBase}${kbInstruction}${knowledgeContext}`;

    // Get conversation history (simplified for now - using ChatLog)
    const chatLog = await prisma.chatLog.findUnique({
      where: { sessionId },
      select: { messages: true }
    });

    const conversationHistory = chatLog?.messages || [];

    // Handle message with state machine (using core orchestrator)
    // Widget timeout: Generous to avoid premature timeouts
    const WIDGET_TOTAL_TIMEOUT_MS = 15000; // 15s max total (includes classifier + LLM)

    const handleMessagePromise = handleMessage(
      sessionId,
      business.id,
      message,
      fullSystemPrompt,
      conversationHistory,
      language,
      business,
      assistant,
      timezone,
      clientSessionId
    );

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Widget request timeout')), WIDGET_TOTAL_TIMEOUT_MS)
    );

    let result;
    try {
      result = await Promise.race([handleMessagePromise, timeoutPromise]);
    } catch (timeoutError) {
      if (timeoutError.message === 'Widget request timeout') {
        console.error('⏱️  [Widget] Request timeout - returning fast ACK');

        // Fast ACK response
        result = {
          reply: language === 'TR'
            ? 'Mesajınız alındı, yanıt hazırlanıyor... Lütfen birkaç saniye bekleyin.'
            : 'Message received, preparing response... Please wait a moment.',
          inputTokens: 0,
          outputTokens: 0
        };

        // Return 503 Service Unavailable with Retry-After
        return res.status(503).set('Retry-After', '2').json({
          success: false,
          code: 'REQUEST_TIMEOUT',
          message: result.reply,
          requestId: `req_${Date.now()}`,
          retryAfterMs: 2000
        });
      }
      throw timeoutError; // Re-throw if not timeout
    }

    // Calculate costs
    const planName = subscription?.plan || 'FREE';
    const countryCode = business?.country || 'TR';
    const isFree = hasFreeChat(planName);

    let tokenCost = { inputCost: 0, outputCost: 0, totalCost: 0 };
    if (!isFree) {
      tokenCost = calculateTokenCost(
        result.inputTokens,
        result.outputTokens,
        planName,
        countryCode
      );
    }

    console.log(`💰 Cost: ${tokenCost.totalCost.toFixed(6)} TL`);

    // Update chat log
    const updatedMessages = [
      ...conversationHistory,
      {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
      },
      {
        role: 'assistant',
        content: result.reply,
        timestamp: new Date().toISOString(),
        ...(result.toolsCalled?.length > 0 && { toolCalls: result.toolsCalled })
      }
    ];

    const existingLog = await prisma.chatLog.findUnique({
      where: { sessionId },
      select: { inputTokens: true, outputTokens: true, totalCost: true }
    });

    const accumulatedInputTokens = (existingLog?.inputTokens || 0) + result.inputTokens;
    const accumulatedOutputTokens = (existingLog?.outputTokens || 0) + result.outputTokens;
    const accumulatedCost = (existingLog?.totalCost || 0) + tokenCost.totalCost;

    await prisma.chatLog.upsert({
      where: { sessionId },
      create: {
        sessionId,
        businessId: business.id,
        assistantId: assistant.id,
        channel: 'CHAT',
        messageCount: updatedMessages.length,
        messages: updatedMessages,
        status: 'active',
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        totalCost: tokenCost.totalCost
      },
      update: {
        messageCount: updatedMessages.length,
        messages: updatedMessages,
        inputTokens: accumulatedInputTokens,
        outputTokens: accumulatedOutputTokens,
        totalCost: accumulatedCost,
        updatedAt: new Date()
      }
    });

    // Deduct from balance if needed
    if (!isFree && tokenCost.totalCost > 0 && subscription) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          balance: {
            decrement: planName === 'PAYG' ? tokenCost.totalCost : 0
          }
        }
      });

      await prisma.usageRecord.create({
        data: {
          subscriptionId: subscription.id,
          channel: 'CHAT',
          conversationId: sessionId,
          durationSeconds: 0,
          durationMinutes: 0,
          chargeType: planName === 'PAYG' ? 'BALANCE' : 'INCLUDED',
          totalCharge: tokenCost.totalCost,
          assistantId: assistant.id,
          metadata: {
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens
          }
        }
      });
    }

    // SECURITY (P0): Apply response firewall BEFORE sending to user
    const firewallResult = sanitizeResponse(result.reply, language);

    if (!firewallResult.safe) {
      // Log violation for monitoring
      logFirewallViolation({
        violations: firewallResult.violations,
        original: firewallResult.original,
        businessId: business.id,
        sessionId
      });
    }

    // If PII warnings exist, prepend them to response
    let finalReply = firewallResult.sanitized;
    if (hasPIIWarnings) {
      const warningText = piiWarnings.join('\n');
      finalReply = `${warningText}\n\n${firewallResult.sanitized}`;
    }

    // P0: Reload state to get updated verification status after tool execution
    const updatedState = await getState(sessionId);

    // Return response
    res.json({
      success: true,
      reply: finalReply,
      conversationId: sessionId, // P0: conversationId is required for audit/correlation
      sessionId: sessionId, // Keep for backward compatibility
      assistantName: assistant.name,
      history: updatedMessages,
      verificationStatus: updatedState.verification?.status || 'none', // P0: Gate requirement for verification tests
      warnings: hasPIIWarnings ? piiWarnings : undefined,
      toolsCalled: result.toolsCalled || [], // For test assertions (deprecated, use toolCalls)
      toolCalls: result.toolsCalled || [] // P0: Test expects 'toolCalls' not 'toolsCalled'
    });

  } catch (error) {
    console.error('❌ Chat error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code
    });

    // Standardized error format (P0)
    res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Failed to process message',
      requestId: req.requestId || `req_${Date.now()}`,
      retryAfterMs: null, // No retry for internal errors
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/chat-v2/widget/status/:assistantId - Check if widget should be active
 */
router.get('/widget/status/:assistantId', async (req, res) => {
  try {
    const { assistantId } = req.params;

    const assistant = await prisma.assistant.findFirst({
      where: { id: assistantId },
      include: {
        business: true
      }
    });

    if (!assistant) {
      return res.json({ active: false, reason: 'not_found' });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { businessId: assistant.business.id },
      include: { business: true }
    });

    if (!subscription) {
      return res.json({ active: false, reason: 'no_subscription' });
    }

    if (isFreePlanExpired(subscription)) {
      return res.json({ active: false, reason: 'trial_expired' });
    }

    res.json({
      active: true,
      assistantName: assistant.name,
      businessName: assistant.business?.name
    });

  } catch (error) {
    console.error('Widget status error:', error);
    res.json({ active: false, reason: 'error' });
  }
});

/**
 * GET /api/chat-v2/widget/status/embed/:embedKey - Check if widget should be active by embed key
 */
router.get('/widget/status/embed/:embedKey', async (req, res) => {
  try {
    const { embedKey } = req.params;

    const business = await prisma.business.findUnique({
      where: { chatEmbedKey: embedKey },
      include: {
        assistants: {
          where: {
            isActive: true,
            callDirection: 'inbound'
          },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!business) {
      return res.json({ active: false, reason: 'invalid_embed_key' });
    }

    if (!business.chatWidgetEnabled) {
      return res.json({ active: false, reason: 'widget_disabled' });
    }

    if (!business.assistants || business.assistants.length === 0) {
      return res.json({ active: false, reason: 'no_assistant' });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { businessId: business.id }
    });

    if (!subscription) {
      return res.json({ active: false, reason: 'no_subscription' });
    }

    if (isFreePlanExpired(subscription)) {
      return res.json({ active: false, reason: 'trial_expired' });
    }

    res.json({
      active: true,
      assistantName: business.assistants[0].name,
      businessName: business.name
    });

  } catch (error) {
    console.error('Widget status by embed key error:', error);
    res.json({ active: false, reason: 'error' });
  }
});

// Export handleMessage for testing
export { handleMessage };

export default router;
