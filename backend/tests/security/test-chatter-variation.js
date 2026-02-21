import assert from 'assert';
import { buildChatterResponse, buildChatterDirective } from '../../src/services/chatter-response.js';
import { makeRoutingDecision } from '../../src/core/orchestrator/steps/04_routerDecision.js';

// ===================================================================
// Contract-based chatter tests
// These tests validate routing contracts and directive presence,
// NOT exact sentence text. This prevents tests from locking behavior
// to specific catalog templates.
// ===================================================================

function runVariationContract() {
  const sessionId = 'proof-session-1';
  const state = { flowStatus: 'idle' };

  const turns = ['selam', 'merhaba', 'selamlar'];
  const replies = [];

  for (const message of turns) {
    const variant = buildChatterResponse({
      userMessage: message,
      state,
      language: 'TR',
      sessionId
    });

    // Contract: variant must return structured result
    assert(typeof variant.text === 'string' && variant.text.length > 0, 'Variant text must be non-empty string');
    assert(typeof variant.messageKey === 'string', 'Variant must have messageKey');
    assert(Number.isInteger(variant.variantIndex), 'Variant must have integer variantIndex');

    replies.push(variant.text);
    state.chatter = {
      lastMessageKey: variant.messageKey,
      lastVariantIndex: variant.variantIndex,
      recent: [
        ...(Array.isArray(state?.chatter?.recent) ? state.chatter.recent : []),
        { messageKey: variant.messageKey, variantIndex: variant.variantIndex }
      ].slice(-2)
    };
  }

  // Contract: consecutive replies must differ (anti-repeat)
  assert(replies[0] !== replies[1], 'First and second greeting should not be identical');
  assert(replies[1] !== replies[2], 'Second and third greeting should not be identical');

  console.log('✅ Chatter variation contract proof');
}

function runDirectiveContract() {
  const sessionId = 'proof-directive-1';
  const state = { flowStatus: 'idle' };

  const result = buildChatterDirective({
    userMessage: 'merhaba',
    state,
    language: 'TR',
    sessionId
  });

  // Contract: directive must have required fields
  assert(result.directive, 'Must have directive object');
  assert(['greeting', 'thanks', 'generic'].includes(result.directive.kind), 'Directive kind must be greeting/thanks/generic');
  assert(typeof result.directive.maxSentences === 'number', 'Directive must have maxSentences');
  assert(result.directive.maxSentences === 1, 'Directive must enforce one sentence');
  assert(result.directive.avoidRepeatingHelpPhrase === true, 'Directive must set avoidRepeatingHelpPhrase');
  assert(typeof result.directive.activeTask === 'boolean', 'Directive must have boolean activeTask');
  assert(typeof result.directive.continueTaskIfAny === 'boolean', 'Directive must have continueTaskIfAny');
  assert(typeof result.directive.responseSeed === 'string' && result.directive.responseSeed.length > 0, 'Directive must include responseSeed');
  assert(result.directive.brevity === 'ONE_SENTENCE_SHORT_NO_REPEAT', 'Directive must include one-sentence brevity mode');

  // Active task directive
  const activeState = { flowStatus: 'in_progress', activeFlow: 'ORDER_STATUS', verification: { status: 'pending' } };
  const activeResult = buildChatterDirective({
    userMessage: 'selam',
    state: activeState,
    language: 'TR',
    sessionId
  });

  assert(activeResult.directive.activeTask === true, 'Active state must set activeTask=true');
  assert(activeResult.directive.continueTaskIfAny === true, 'Active state must set continueTaskIfAny=true');
  assert(activeResult.directive.verificationPending === true, 'Pending verification must be flagged');

  console.log('✅ Chatter directive contract proof');
}

async function runRoutingContractAlwaysLLM() {
  const idleResult = await makeRoutingDecision({
    classification: {
      type: 'NEW_INTENT',
      confidence: 0.9,
      triggerRule: 'classifier_skipped_idle'
    },
    state: { flowStatus: 'idle' },
    userMessage: 'selam',
    conversationHistory: [{ role: 'user', content: 'selam' }],
    language: 'TR',
    business: { id: 'test-business' },
    sessionId: 'proof-routing-1'
  });

  // Contract: LLM directive mode, no direct response (flag-independent)
  assert(idleResult.directResponse === false, 'Idle greeting should NOT return direct response');
  assert(idleResult.isChatter === true, 'Idle greeting should be tagged as chatter');
  assert(idleResult.chatterDirective, 'Must have chatterDirective');
  assert(idleResult.chatterDirective.kind === 'greeting', 'Directive kind must be greeting');
  assert(idleResult.chatterDirective.maxSentences === 1, 'Max sentences must be 1');
  assert(idleResult.metadata?.mode === 'llm_directive', 'Mode must be llm_directive');

  console.log('✅ Chatter routing contract proof (always LLM)');
}

async function runActiveFlowGuardrail() {
  // Guardrail: active flow inputs should not be hijacked by early chatter logic
  const activeFlowResult = await makeRoutingDecision({
    classification: {
      type: 'SLOT_ANSWER',
      confidence: 0.92,
      triggerRule: 'slot'
    },
    state: {
      flowStatus: 'in_progress',
      activeFlow: 'ORDER_STATUS',
      expectedSlot: 'order_number'
    },
    userMessage: 'tamam',
    conversationHistory: [
      { role: 'assistant', content: 'Sipariş numaranızı paylaşır mısınız?' },
      { role: 'user', content: 'tamam' }
    ],
    language: 'TR',
    business: { id: 'test-business' },
    sessionId: 'proof-routing-2'
  });

  assert(activeFlowResult.directResponse === false, 'Active flow response should continue normal pipeline');
  assert(activeFlowResult.routing?.routing?.action === 'PROCESS_SLOT', 'Active flow should preserve PROCESS_SLOT action');

  console.log('✅ Active flow guardrail proof');
}

// ── Run all contract tests ──
runVariationContract();
runDirectiveContract();
await runRoutingContractAlwaysLLM();
await runActiveFlowGuardrail();

console.log('\n🎉 All chatter contract tests passed');
process.exit(0);
