/**
 * Step 4: Router Decision
 *
 * ARCHITECTURE CHANGE (LLM Authority Refactor):
 * - Backend NO LONGER classifies user input (no regex, no looksLikeSlotInput)
 * - Backend NO LONGER returns directResponse templates
 * - Backend NO LONGER uses forceToolCall
 * - LLM handles: intent detection, entity extraction, natural conversation
 * - Backend handles: state tracking, security, tool gating
 *
 * Determines action based on classification:
 * - RUN_INTENT_ROUTER: New intent → LLM handles with tools
 * - HANDLE_DISPUTE: User disputes result → LLM handles with context
 * - ACKNOWLEDGE_CHATTER: Emotional/greeting → LLM responds naturally
 * - PROCESS_SLOT: (SIMPLIFIED) Only format validation, not input classification
 */

import { routeMessage, handleDispute } from '../../../services/message-router.js';
import { buildChatterResponse, buildChatterDirective, isPureChatter } from '../../../services/chatter-response.js';
import { isFeatureEnabled } from '../../../config/feature-flags.js';

/**
 * Unified chatter handler.
 * Called from both the early regex path and the ACKNOWLEDGE_CHATTER action path.
 * When LLM_CHATTER_GREETING flag is ON: returns directResponse=false with directive for LLM.
 * When flag is OFF (default): returns directResponse=true with catalog template (legacy).
 */
function handleChatter({ userMessage, state, language, sessionId, messageRouting, detectedBy }) {
  const useLLM = isFeatureEnabled('LLM_CHATTER_GREETING');
  const flagRawValue = process.env.FEATURE_LLM_CHATTER_GREETING;

  console.log(`🔍 [ChatterFlag] LLM_CHATTER_GREETING: flagValue=${useLLM}, envRaw="${flagRawValue}", branch=${detectedBy}`);

  if (useLLM) {
    // ── LLM directive mode ──
    const chatterDirective = buildChatterDirective({ userMessage, state, language, sessionId });

    // Update chatter state for anti-repeat tracking
    const previousRecent = Array.isArray(state?.chatter?.recent) ? state.chatter.recent : [];
    const nextRecent = [
      ...previousRecent,
      { messageKey: chatterDirective.messageKey, variantIndex: chatterDirective.variantIndex }
    ].slice(-2);

    state.chatter = {
      lastMessageKey: chatterDirective.messageKey,
      lastVariantIndex: chatterDirective.variantIndex,
      lastAt: new Date().toISOString(),
      recent: nextRecent
    };

    const chatterRouting = {
      ...messageRouting,
      routing: {
        ...messageRouting.routing,
        action: 'ACKNOWLEDGE_CHATTER',
        reason: `Chatter detected (${detectedBy}) — LLM directive mode`,
        nextAction: 'llm-directive'
      }
    };

    console.log(`💬 [RouterDecision] Chatter (${detectedBy}) — LLM directive mode, directResponse=false`);

    return {
      directResponse: false,
      isChatter: true,
      routing: chatterRouting,
      chatterDirective: chatterDirective.directive,
      catalogFallback: chatterDirective.catalogFallback,
      metadata: {
        messageKey: chatterDirective.messageKey,
        variantIndex: chatterDirective.variantIndex,
        detectedBy,
        mode: 'llm_directive'
      }
    };
  }

  // ── Legacy catalog template mode (flag OFF) ──
  const chatterVariant = buildChatterResponse({ userMessage, state, language, sessionId });

  const previousRecent = Array.isArray(state?.chatter?.recent) ? state.chatter.recent : [];
  const nextRecent = [
    ...previousRecent,
    { messageKey: chatterVariant.messageKey, variantIndex: chatterVariant.variantIndex }
  ].slice(-2);

  state.chatter = {
    lastMessageKey: chatterVariant.messageKey,
    lastVariantIndex: chatterVariant.variantIndex,
    lastAt: new Date().toISOString(),
    recent: nextRecent
  };

  const chatterRouting = {
    ...messageRouting,
    routing: {
      ...messageRouting.routing,
      action: 'ACKNOWLEDGE_CHATTER',
      reason: `Chatter detected (${detectedBy}) — direct template`,
      nextAction: 'direct-response'
    }
  };

  console.log(`💬 [RouterDecision] Chatter (${detectedBy}) — direct template mode, directResponse=true`);

  return {
    directResponse: true,
    reply: chatterVariant.text,
    routing: chatterRouting,
    isChatter: true,
    metadata: {
      messageKey: chatterVariant.messageKey,
      variantIndex: chatterVariant.variantIndex,
      detectedBy,
      mode: 'direct_template'
    }
  };
}

export async function makeRoutingDecision(params) {
  const { classification, state, userMessage, conversationHistory, language, business, sessionId = '' } = params;

  // Get last assistant message
  const lastAssistantMessage = conversationHistory
    .slice().reverse()
    .find(msg => msg.role === 'assistant')?.content || '';

  // Route message — pass Step 3 classification to AVOID double Gemini call
  const messageRouting = await routeMessage(
    userMessage,
    state,
    lastAssistantMessage,
    language,
    business,
    classification  // ← Reuse Step 3 classifier result
  );

  const { routing } = messageRouting;
  const action = routing.action;

  console.log('🧭 [RouterDecision]:', {
    action,
    suggestedFlow: routing.suggestedFlow,
    triggerRule: classification.triggerRule,
    verificationStatus: state.verification?.status
  });

  // ========================================
  // EARLY CHATTER DETECTION (classifier-independent)
  // ========================================
  // Pure chatter bypasses LLM only in idle state (or goes to LLM with directive if flag ON).
  // During active tasks (flow/verification), user input can carry task data.
  const hasActiveTask =
    state.verification?.status === 'pending' ||
    state.flowStatus === 'in_progress' ||
    state.flowStatus === 'post_result' ||
    Boolean(state.activeFlow);

  if (!hasActiveTask && isPureChatter(userMessage)) {
    return handleChatter({ userMessage, state, language, sessionId, messageRouting, detectedBy: 'regex_early' });
  }

  // ========================================
  // VERIFICATION PENDING: Pass context to LLM, don't classify input
  // ========================================
  // ARCHITECTURE CHANGE: When verification is pending, we add context to state
  // so the LLM knows it needs verification, but we DON'T:
  //   ❌ Use regex to decide if input is name/phone/OOD
  //   ❌ Return directResponse templates
  //   ❌ Force tool calls
  // LLM sees the conversation history and understands what the user is providing.
  if (state.verification?.status === 'pending' && state.verification?.anchor) {
    console.log('🔐 [Verification] Pending verification — LLM will handle input interpretation');

    // Add verification context for LLM's system prompt
    state.verificationContext = {
      status: 'pending',
      pendingField: state.verification.pendingField || 'name',
      attempts: state.verification.attempts || 0,
      anchorType: state.verification.anchor.type,
      // SECURITY: Don't leak anchor details to LLM — just the context
    };

    // Let LLM handle — it will call customer_data_lookup with verification_input
    return {
      directResponse: false,
      routing: messageRouting,
      verificationPending: true
    };
  }

  // ========================================
  // CALLBACK_REQUEST: Let LLM collect info naturally
  // ========================================
  // ARCHITECTURE CHANGE: No more backend-driven slot collection templates.
  // LLM knows from conversation what info is needed for callbacks.
  if (classification.type === 'CALLBACK_REQUEST') {
    console.log('📞 [CALLBACK] Detected — LLM will handle slot collection naturally');

    // Just flag the intent, let LLM manage the conversation
    return {
      directResponse: false,
      routing: messageRouting,
      callbackRequest: true
    };
  }

  // Handle different actions
  switch (action) {
    case 'PROCESS_SLOT': {
      // ARCHITECTURE CHANGE: Simplified.
      // Backend no longer validates slot content — LLM extracted slots in Step 3.
      // We just pass through to LLM with the routing context.
      console.log('📝 [RouterDecision] Slot processing — LLM handles interpretation');

      return {
        directResponse: false,
        routing: messageRouting,
        slotProcessed: true
      };
    }

    case 'HANDLE_DISPUTE': {
      // Handle user dispute — let LLM respond with anchor context
      // ARCHITECTURE CHANGE: No more directResponse templates for disputes.
      // LLM sees anchor data (last tool result) and generates natural response.
      console.log('⚠️ [RouterDecision] Dispute detected — LLM will handle with anchor context');

      // Add dispute context for LLM
      if (state.anchor?.truth) {
        state.disputeContext = {
          originalFlow: state.anchor.lastFlowType,
          hasTrackingInfo: !!(state.anchor.truth?.order?.trackingNumber),
          lastResult: state.anchor.truth
        };
      }

      return {
        directResponse: false,
        routing: messageRouting,
        disputeHandled: true
      };
    }

    case 'RUN_INTENT_ROUTER': {
      // New intent detected — will be handled by LLM with tools
      if (routing.suggestedFlow) {
        state.activeFlow = routing.suggestedFlow;
        state.flowStatus = 'in_progress';
      }

      return {
        directResponse: false,
        routing: messageRouting,
        newIntentDetected: true
      };
    }

    case 'CONTINUE_FLOW': {
      // Continue with current flow
      return {
        directResponse: false,
        routing: messageRouting,
        continueFlow: true
      };
    }

    case 'ACKNOWLEDGE_CHATTER': {
      return handleChatter({ userMessage, state, language, sessionId, messageRouting, detectedBy: 'action_route' });
    }

    default: {
      console.warn(`⚠️ [RouterDecision] Unknown action: ${action}`);
      return {
        directResponse: false,
        routing: messageRouting
      };
    }
  }
}

export default { makeRoutingDecision };
