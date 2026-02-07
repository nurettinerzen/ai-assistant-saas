import assert from 'assert';
import { buildChatterResponse } from '../../src/services/chatter-response.js';
import { makeRoutingDecision } from '../../src/core/orchestrator/steps/04_routerDecision.js';

function run() {
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

  assert(replies[0] !== replies[1], 'First and second greeting should not be identical');
  assert(replies[1] !== replies[2], 'Second and third greeting should not be identical');
  assert(replies[0] !== replies[2], 'First and third greeting should not be identical in short window');

  console.log('✅ Chatter variation proof');
  console.log('Turn1:', replies[0]);
  console.log('Turn2:', replies[1]);
  console.log('Turn3:', replies[2]);
}

async function runRoutingRegression() {
  // Regression: idle mode skips classifier and forces NEW_INTENT.
  // Pure greetings must still bypass LLM with direct response.
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

  assert(idleResult.directResponse === true, 'Idle greeting should return direct response');
  assert(idleResult.isChatter === true, 'Idle greeting should be tagged as chatter');
  assert(idleResult.routing?.routing?.action === 'ACKNOWLEDGE_CHATTER', 'Idle greeting should route as ACKNOWLEDGE_CHATTER');

  // Guardrail: active flow inputs should not be hijacked by early chatter logic.
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

  console.log('✅ Chatter routing regression proof');
}

run();
await runRoutingRegression();
process.exit(0);
