/**
 * Message Router
 *
 * Decides what to do with incoming message based on:
 * 1. Message type (SLOT_ANSWER | FOLLOWUP_DISPUTE | NEW_INTENT | CHATTER)
 * 2. Current state (activeFlow, flowStatus, expectedSlot)
 *
 * This prevents common issues:
 * - Running intent router when expecting slot answer
 * - Treating dispute/complaint as new order_status flow
 * - Starting new flow for emotional chatter
 */

import { classifyMessageType } from './message-type-classifier.js';
import { routeIntent } from './intent-router.js';
// REMOVED: processSlotInput — LLM handles slot processing now (LLM Authority Refactor)
import { getFlow } from '../config/flow-definitions.js';

/**
 * Route incoming message to appropriate handler
 *
 * @param {string} userMessage - User's message
 * @param {Object} state - Current conversation state
 * @param {string} lastAssistantMessage - Last assistant message
 * @param {string} language - Language code
 * @param {Object} business - Business object
 * @returns {Promise<Object>} Routing decision
 */
export async function routeMessage(userMessage, state, lastAssistantMessage, language, business, existingClassification = null) {
  // Step 1: Use existing classification from Step 3 if available (avoid double Gemini call)
  const messageType = existingClassification || await classifyMessageType(state, lastAssistantMessage, userMessage, language);

  if (existingClassification) {
    console.log('📨 Message classification (REUSED from Step 3):', {
      type: messageType.type,
      confidence: messageType.confidence
    });
  } else {
    console.log('📨 Message classification:', {
      type: messageType.type,
      confidence: messageType.confidence,
      reason: messageType.reason
    });
  }

  // Step 2: Route based on message type + state
  const routing = decideRouting(messageType, state, business);

  console.log('🔀 Routing decision:', routing);

  return {
    messageType,
    routing,
    // Helper flags for backwards compatibility
    shouldRunIntentRouter: routing.action === 'RUN_INTENT_ROUTER',
    shouldProcessSlot: routing.action === 'PROCESS_SLOT',
    shouldHandleDispute: routing.action === 'HANDLE_DISPUTE',
    shouldAcknowledge: routing.action === 'ACKNOWLEDGE_CHATTER'
  };
}

/**
 * Decide routing action based on message type and state
 *
 * @param {Object} messageType - Classification result
 * @param {Object} state - Current state
 * @param {Object} business - Business object
 * @returns {Object} Routing decision
 */
function decideRouting(messageType, state, business) {
  const { type, confidence } = messageType;
  const { activeFlow, flowStatus, expectedSlot, anchor, postResultTurns } = state;

  // ============================================
  // CONFIDENCE THRESHOLD CHECK (Priority)
  // ============================================
  // If confidence too low, let Gemini handle naturally
  if (confidence < 0.7) {
    return {
      action: 'ACKNOWLEDGE_CHATTER',
      reason: `Low confidence (${confidence.toFixed(2)}) - letting Gemini handle naturally`,
      nextAction: 'gemini-freeform',
      suggestedFlow: 'GENERAL',
      allowToollessResponse: true,
      skipRouter: true,
      skipSlotProcessing: true,
      confidence
    };
  }

  // High/Medium confidence (>= 0.7): Process based on type
  // NOTE: Don't return early based on confidence - let type-specific logic decide!

  // ============================================
  // CASE 1: SLOT_ANSWER
  // ============================================
  if (type === 'SLOT_ANSWER' && expectedSlot) {
    return {
      action: 'PROCESS_SLOT',
      reason: `User providing expected slot: ${expectedSlot}`,
      nextAction: 'slot-processor',
      confidence
    };
  }

  // ============================================
  // CASE 2: FOLLOWUP_DISPUTE (after resolved flow)
  // ============================================
  if (type === 'FOLLOWUP_DISPUTE' && (flowStatus === 'resolved' || flowStatus === 'post_result')) {
    // User disputes assistant's response (e.g., "no it didn't arrive")
    // This should trigger complaint/escalation, NOT restart the same flow

    return {
      action: 'HANDLE_DISPUTE',
      reason: 'User disputes result from completed flow',
      nextAction: 'complaint-handler',
      suggestedFlow: 'COMPLAINT',
      context: {
        originalFlow: anchor.lastFlowType,
        anchorData: anchor
      },
      confidence
    };
  }

  // ============================================
  // CASE 3: CHATTER (emotional/acknowledgment)
  // ============================================
  if (type === 'CHATTER') {
    return {
      action: 'ACKNOWLEDGE_CHATTER',
      reason: 'Message is emotional response without actionable intent',
      nextAction: 'gemini-freeform', // Let Gemini respond naturally
      suggestedFlow: 'GENERAL',
      allowToollessResponse: true,
      skipRouter: true,
      skipSlotProcessing: true,
      confidence
    };
  }

  // ============================================
  // CASE 4: NEW_INTENT (topic switch or new conversation)
  // ============================================
  if (type === 'NEW_INTENT') {
    // Check if we're in post_result mode (grace period after flow)
    if (flowStatus === 'post_result' && postResultTurns < 3) {
      // Still in grace period - might be related follow-up
      // Run router but preserve anchor data
      return {
        action: 'RUN_INTENT_ROUTER',
        reason: 'New intent during post-result grace period',
        nextAction: 'intent-router',
        preserveAnchor: true,
        confidence
      };
    }

    // Clean new intent - run router (safe mode if medium confidence)
    return {
      action: 'RUN_INTENT_ROUTER',
      reason: 'User expressing new intent/topic',
      nextAction: 'intent-router',
      preserveAnchor: false,
      safeMode: confidence >= 0.7 && confidence < 0.85, // Safe mode for medium confidence
      confidence
    };
  }

  // ============================================
  // FALLBACK: Default to intent router
  // ============================================
  return {
    action: 'RUN_INTENT_ROUTER',
    reason: 'No clear pattern, defaulting to intent detection',
    nextAction: 'intent-router',
    safeMode: true, // Always safe mode for fallback
    confidence: 0.5
  };
}

/**
 * Handle FOLLOWUP_DISPUTE routing
 *
 * ARCHITECTURE CHANGE: No more directResponse templates.
 * LLM sees the anchor/truth data in conversation context and responds naturally.
 * Backend only provides routing metadata.
 *
 * @param {string} userMessage
 * @param {Object} state
 * @param {string} language
 * @param {Object} business
 * @returns {Promise<Object>}
 */
export async function handleDispute(userMessage, state, language, business) {
  console.log('⚠️ Handling dispute/contradiction after resolved flow');

  const truth = state.anchor?.truth;
  const hasTrackingInfo = truth?.order?.trackingNumber && truth?.order?.carrier;
  const hasOrderNumber = truth?.order?.orderNumber || state.anchor?.order_number;

  // CASE 1: Order dispute with tracking info — LLM will use anchor data
  if (truth?.dataType === 'order' && hasTrackingInfo) {
    console.log('📦 [Dispute] Has tracking info — LLM will present naturally');

    return {
      intent: 'tracking_info',
      shouldStartFlow: false,
      directResponse: false, // CHANGED: LLM responds with anchor context
      suggestCallback: true,
      preserveAnchor: true
    };
  }

  // CASE 2: Order dispute but can lookup tracking
  if (truth?.dataType === 'order' && hasOrderNumber && !hasTrackingInfo) {
    console.log('🔍 [Dispute] No tracking — LLM will suggest lookup');

    return {
      intent: 'order_status',
      shouldStartFlow: true,
      flowName: 'ORDER_STATUS',
      context: {
        orderNumber: hasOrderNumber,
        isDispute: true
      },
      tools: ['customer_data_lookup'],
      requiresVerification: false,
      preserveAnchor: true
    };
  }

  // CASE 3: Default — Complaint/Callback, LLM handles conversation
  console.log('📞 [Dispute] No tracking info — LLM routes to complaint/callback');

  return {
    intent: 'complaint',
    shouldStartFlow: true,
    flowName: 'COMPLAINT',
    context: {
      originalFlow: state.anchor?.lastFlowType,
      orderNumber: hasOrderNumber,
      customerId: state.anchor?.customer_id,
      disputeReason: userMessage
    },
    tools: ['create_callback', 'customer_data_lookup'],
    requiresVerification: true,
    preserveAnchor: true
  };
}

/**
 * Check if we should run intent router
 * (Wrapper for backwards compatibility)
 *
 * @param {Object} routingDecision
 * @returns {boolean}
 */
export function shouldRunIntentRouter(routingDecision) {
  return routingDecision.routing.action === 'RUN_INTENT_ROUTER';
}

/**
 * Check if we should process slot
 * (Wrapper for backwards compatibility)
 *
 * @param {Object} routingDecision
 * @returns {boolean}
 */
export function shouldProcessSlot(routingDecision) {
  return routingDecision.routing.action === 'PROCESS_SLOT';
}

export default {
  routeMessage,
  handleDispute,
  shouldRunIntentRouter,
  shouldProcessSlot
};
