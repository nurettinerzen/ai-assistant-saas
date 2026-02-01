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

  // Route message first (needed for routing info)
  const messageRouting = await routeMessage(
    userMessage,
    state,
    lastAssistantMessage,
    language,
    business
  );

  const { routing } = messageRouting;
  const action = routing.action;

  console.log('🧭 [RouterDecision]:', {
    action,
    suggestedFlow: routing.suggestedFlow,
    triggerRule: classification.triggerRule,
    forcedToolCall: routing.forcedToolCall
  });

  // ========================================
  // P1.1: DETERMINISTIC PATTERN DETECTED
  // Force tool call with extracted pattern data
  // ========================================
  if (routing.forcedToolCall && routing.patternData) {
    console.log('🎯 [DETERMINISTIC] Forcing tool call with pattern data:', routing.patternData);
    const toolName = routing.tools?.[0] || 'customer_data_lookup';

    state.forceToolCall = {
      tool: toolName,
      args: routing.patternData
    };

    return {
      directResponse: false,
      routing: messageRouting,
      deterministicRoute: true
    };
  }

  // ========================================
  // SPECIAL HANDLER: CALLBACK_REQUEST
  // Backend-controlled slot collection + force tool call
  // ========================================
  if (classification.type === 'CALLBACK_REQUEST') {
    const extractedSlots = state.extractedSlots || {};
    const requiredSlots = ['customer_name', 'phone'];
    const missing = requiredSlots.filter(slot => !extractedSlots[slot]);

    if (missing.length > 0) {
      // Ask for missing slot (only one question)
      const missingSlot = missing[0];
      const question = missingSlot === 'customer_name'
        ? (language === 'TR' ? 'Adınız ve soyadınız nedir?' : 'What is your full name?')
        : (language === 'TR' ? 'Telefon numaranız nedir?' : 'What is your phone number?');

      console.log(`📞 [CALLBACK] Missing slot: ${missingSlot}, asking user`);

      return {
        directResponse: true,
        reply: question,
        forceEnd: false,
        routing: messageRouting,
        metadata: {
          type: 'CALLBACK_SLOT_COLLECTION',
          missingSlot,
          remainingSlots: missing
        }
      };
    } else {
      // All slots ready - FORCE TOOL CALL
      console.log('📞 [CALLBACK] All slots ready, forcing tool call');
      state.forceToolCall = {
        tool: 'create_callback',
        args: {} // Args will be filled by argumentNormalizer from extractedSlots
      };
      // Continue to LLM with forced tool call instruction
    }
  }

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
          routing: messageRouting,
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
          routing: messageRouting,
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
