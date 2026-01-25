/**
 * Step 4: Router Decision
 *
 * - Determines action based on classification
 * - Handles: PROCESS_SLOT, HANDLE_DISPUTE, RUN_INTENT_ROUTER, CONTINUE_FLOW, ACKNOWLEDGE_CHATTER
 * - Returns routing decision + any direct responses
 */

import { routeMessage, handleDispute } from '../../../services/message-router.js';
import { processSlotInput } from '../../../services/slot-processor.js';

export async function makeRoutingDecision(params) {
  const { classification, state, userMessage, conversationHistory, language, business } = params;

  // Get last assistant message
  const lastAssistantMessage = conversationHistory
    .slice().reverse()
    .find(msg => msg.role === 'assistant')?.content || '';

  // Route message
  const messageRouting = await routeMessage(
    userMessage,
    state,
    lastAssistantMessage,
    language,
    business
  );

  const { action, routing } = messageRouting;

  console.log('🧭 [RouterDecision]:', {
    action,
    suggestedFlow: routing.suggestedFlow,
    triggerRule: classification.triggerRule
  });

  // Handle different actions
  switch (action) {
    case 'PROCESS_SLOT': {
      // Process slot filling
      const slotResult = await processSlotInput(
        userMessage,
        state,
        classification.extractedSlots || {},
        language,
        business
      );

      if (slotResult.slotFilled) {
        // Slot successfully filled
        state.collectedSlots[slotResult.slotName] = slotResult.slotValue;

        // Check if we have more required slots
        if (slotResult.nextSlot) {
          state.expectedSlot = slotResult.nextSlot;
        } else {
          // All slots collected
          state.expectedSlot = null;
          state.flowStatus = 'ready_for_execution';
        }
      } else if (slotResult.slotAttempts >= 3) {
        // Too many failed attempts - escalate
        return {
          directResponse: true,
          reply: slotResult.escalationMessage || (language === 'TR'
            ? 'Bilgilerinizi almakta sorun yaşıyorum. Sizi müşteri temsilcimize bağlayayım mı?'
            : 'I\'m having trouble collecting your information. Should I connect you to a representative?'),
          forceEnd: false,
          metadata: {
            type: 'SLOT_ESCALATION',
            slotName: state.expectedSlot,
            attempts: slotResult.slotAttempts
          }
        };
      }

      return {
        directResponse: false,
        routing: messageRouting,
        slotProcessed: true
      };
    }

    case 'HANDLE_DISPUTE': {
      // Handle user dispute
      const disputeResult = await handleDispute(
        userMessage,
        state,
        language,
        business
      );

      if (disputeResult.directResponse) {
        return {
          directResponse: true,
          reply: disputeResult.response,
          forceEnd: false,
          metadata: {
            type: 'DISPUTE_HANDLED',
            resolutionType: disputeResult.resolutionType
          }
        };
      }

      return {
        directResponse: false,
        routing: messageRouting,
        disputeHandled: true
      };
    }

    case 'RUN_INTENT_ROUTER': {
      // New intent detected - will be handled by intent router in LLM step
      if (routing.suggestedFlow) {
        state.activeFlow = routing.suggestedFlow;
        state.flowStatus = 'in_progress';
        state.expectedSlot = null;
        state.collectedSlots = {};
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
      // Friendly chatter - low priority, no flow change
      return {
        directResponse: false,
        routing: messageRouting,
        isChatter: true
      };
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
