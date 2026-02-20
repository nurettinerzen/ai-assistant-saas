import assert from 'assert';
import { buildChatterResponse, buildChatterDirective } from '../../src/services/chatter-response.js';
import { makeRoutingDecision } from '../../src/core/orchestrator/steps/04_routerDecision.js';
import { overrideFeatureFlag } from '../../src/config/feature-flags.js';

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
  assert(result.directive.avoidRepeatingHelpPhrase === true, 'Directive must set avoidRepeatingHelpPhrase');
  assert(typeof result.directive.activeTask === 'boolean', 'Directive must have boolean activeTask');
  assert(typeof result.directive.continueTaskIfAny === 'boolean', 'Directive must have continueTaskIfAny');
  assert(Array.isArray(result.directive.responseOptions), 'Directive must include responseOptions array');
  assert(result.directive.responseOptions.length >= 3, 'Greeting directive should provide multiple response options');
  assert(typeof result.directive.responseSeed === 'string' && result.directive.responseSeed.length > 0, 'Directive must include responseSeed');
  assert(Array.isArray(result.directive.avoidExactPhrases), 'Directive must include avoidExactPhrases');

  // Contract: catalog fallback must be present
  assert(result.catalogFallback, 'Must have catalogFallback');
  assert(typeof result.catalogFallback.text === 'string' && result.catalogFallback.text.length > 0, 'Catalog fallback text must be non-empty');

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

async function runRoutingContractFlagOff() {
  // Ensure legacy mode (flag OFF)
  overrideFeatureFlag('LLM_CHATTER_GREETING', false);

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

  // Contract (flag OFF): direct response with catalog template
  assert(idleResult.directResponse === true, '[FLAG OFF] Idle greeting should return direct response');
  assert(idleResult.isChatter === true, '[FLAG OFF] Idle greeting should be tagged as chatter');
  assert(typeof idleResult.reply === 'string' && idleResult.reply.length > 0, '[FLAG OFF] Reply must be non-empty');
  assert(idleResult.routing?.routing?.action === 'ACKNOWLEDGE_CHATTER', '[FLAG OFF] Should route as ACKNOWLEDGE_CHATTER');
  assert(idleResult.metadata?.mode === 'direct_template', '[FLAG OFF] Mode must be direct_template');

  console.log('✅ Chatter routing contract proof (flag OFF)');
}

async function runRoutingContractFlagOn() {
  // Enable LLM mode
  overrideFeatureFlag('LLM_CHATTER_GREETING', true);

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
    sessionId: 'proof-routing-llm-1'
  });

  // Contract (flag ON): LLM directive mode, no direct response
  assert(idleResult.directResponse === false, '[FLAG ON] Should NOT return direct response');
  assert(idleResult.isChatter === true, '[FLAG ON] Should still be tagged as chatter');
  assert(idleResult.chatterDirective, '[FLAG ON] Must have chatterDirective');
  assert(idleResult.chatterDirective.kind === 'greeting', '[FLAG ON] Directive kind must be greeting');
  assert(idleResult.chatterDirective.maxSentences <= 2, '[FLAG ON] Max sentences must be <= 2');
  assert(idleResult.catalogFallback, '[FLAG ON] Must have catalog fallback');
  assert(typeof idleResult.catalogFallback.text === 'string', '[FLAG ON] Fallback must have text');
  assert(idleResult.metadata?.mode === 'llm_directive', '[FLAG ON] Mode must be llm_directive');

  // Tools must be off (checked implicitly: no tools in chatter directive)
  // Directive must not have tools field
  assert(!idleResult.chatterDirective.tools, '[FLAG ON] Directive must not include tools');

  // Reset flag
  overrideFeatureFlag('LLM_CHATTER_GREETING', false);

  console.log('✅ Chatter routing contract proof (flag ON)');
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
await runRoutingContractFlagOff();
await runRoutingContractFlagOn();
await runActiveFlowGuardrail();

console.log('\n🎉 All chatter contract tests passed');
process.exit(0);
