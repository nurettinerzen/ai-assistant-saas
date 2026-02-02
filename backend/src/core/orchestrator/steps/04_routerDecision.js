/**
 * Step 4: Router Decision
 *
 * - Determines action based on classification
 * - Handles: PROCESS_SLOT, HANDLE_DISPUTE, RUN_INTENT_ROUTER, CONTINUE_FLOW, ACKNOWLEDGE_CHATTER
 * - Returns routing decision + any direct responses
 */

import { routeMessage, handleDispute } from '../../../services/message-router.js';
import { processSlotInput, looksLikeSlotInput } from '../../../services/slot-processor.js';

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
    forcedToolCall: routing.forcedToolCall,
    verificationStatus: state.verification?.status
  });

  // ========================================
  // P0: VERIFICATION PENDING - Check if input looks like name/phone
  // If not, check for OOD or topic change before forcing tool call
  // ========================================
  if (state.verification?.status === 'pending' && state.verification?.anchor) {
    const pendingField = state.verification.pendingField || 'name';
    const looksLikeVerificationInput = looksLikeSlotInput(userMessage, pendingField);

    // Check if this is an OOD question (has question mark, long sentence, etc.)
    const looksLikeQuestion = userMessage.includes('?') || userMessage.length > 50;
    const isLikelyOOD = !looksLikeVerificationInput && looksLikeQuestion;

    // Check if this is an in-domain topic change (iade, kargo, etc.)
    const inDomainTopicPatterns = [
      /iade|return/i,
      /kargo|cargo|shipping/i,
      /sipariş|order/i,
      /ürün|product/i,
      /fiyat|price/i,
      /kampanya|campaign/i,
      /destek|support/i
    ];
    const isInDomainTopicChange = !looksLikeVerificationInput &&
      inDomainTopicPatterns.some(p => p.test(userMessage));

    // IMPORTANT: Check in-domain topic FIRST (before OOD)
    // Because in-domain questions may also have "?" but should be answered
    if (isInDomainTopicChange) {
      // In-domain topic change during pending verification
      // Answer the new topic but remind about verification
      console.log('🔐 [Verification] Topic change detected during pending - will answer + remind');

      // Store reminder flag for LLM to append
      state.pendingVerificationReminder = true;

      // Continue to normal routing - don't force tool call
      return {
        directResponse: false,
        routing: messageRouting,
        topicChangeDuringVerification: true
      };
    }

    // OOD question during pending verification (NOT in-domain)
    if (isLikelyOOD) {
      console.log('🔐 [Verification] OOD detected during pending - NOT treating as name input');

      const oodReminderMessage = language === 'TR'
        ? 'Bu konu işletmemizin kapsamı dışında. Siparişinizle ilgili devam etmek için ad-soyadınızı paylaşabilirsiniz.'
        : 'This topic is outside our scope. To continue with your order, you can share your full name.';

      return {
        directResponse: true,
        reply: oodReminderMessage,
        forceEnd: false,
        routing: messageRouting,
        metadata: {
          type: 'OOD_DURING_VERIFICATION',
          pendingField,
          verificationStatus: 'pending' // Keep pending, don't fail
        }
      };
    }

    if (looksLikeVerificationInput) {
      // Looks like actual name/phone input - proceed with verification
      console.log('🔐 [Verification] Input looks like name - forcing tool call with customer_name');
      const toolName = state.verification.pendingTool || 'customer_data_lookup';

      state.forceToolCall = {
        tool: toolName,
        args: {
          customer_name: userMessage.trim(),
          // Preserve original query parameters from anchor
          ...(state.verification.anchor.order_number && { order_number: state.verification.anchor.order_number }),
          ...(state.verification.anchor.phone && { phone: state.verification.anchor.phone }),
          ...(state.verification.anchor.query_type && { query_type: state.verification.anchor.query_type })
        }
      };

      return {
        directResponse: false,
        routing: messageRouting,
        verificationFlow: true
      };
    }

    // Fallback: not clearly name, not clearly OOD/topic - ask again
    console.log('🔐 [Verification] Unclear input during pending - asking for name again');

    const retryMessage = language === 'TR'
      ? 'Lütfen ad-soyadınızı yazınız. Örneğin: Ayşe Demir'
      : 'Please enter your full name. For example: John Smith';

    return {
      directResponse: true,
      reply: retryMessage,
      forceEnd: false,
      routing: messageRouting,
      metadata: {
        type: 'VERIFICATION_INPUT_UNCLEAR',
        pendingField
      }
    };
  }

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
