/**
 * Session Continuity Contract Test
 *
 * Run: node backend/tests/session-continuity-test.js
 */

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const API_URL = process.env.API_URL || 'http://localhost:3001';
const EMBED_KEY = process.env.EMBED_KEY || 'emb_e8e0f9cd48b9a5cd37d83b66c4dbe273';
const SESSION_ID = process.env.TEST_SESSION_ID || 'test_session_continuity_contract_v1';

const VALID_OUTCOMES = new Set([
  'OK',
  'NOT_FOUND',
  'VALIDATION_ERROR',
  'VERIFICATION_REQUIRED',
  'DENIED',
  'INFRA_ERROR'
]);

function isValidStatusTransition(from, to) {
  const graph = {
    none: new Set(['none', 'pending', 'verified']),
    pending: new Set(['pending', 'verified', 'none']),
    verified: new Set(['verified', 'none']),
    failed: new Set(['failed', 'pending', 'none'])
  };

  return (graph[from] || new Set([from])).has(to);
}

async function sendMessage(message, turn) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TURN ${turn}: "${message}"`);
  console.log('='.repeat(60));

  const response = await fetch(`${API_URL}/api/chat-v2/widget`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embedKey: EMBED_KEY,
      sessionId: SESSION_ID,
      message
    })
  });

  const data = await response.json();

  console.log('\n📤 Response:', (data.reply || '').substring(0, 180) + '...');
  console.log('📊 Outcome:', data.outcome || data.metadata?.outcome || 'missing');
  console.log('🔐 Verification Status:', data.verificationStatus || 'none');
  console.log('🆔 Session ID:', data.sessionId);
  console.log('💬 Conversation ID:', data.conversationId);

  return data;
}

async function runTest() {
  console.log('\n🧪 SESSION CONTINUITY CONTRACT TEST');
  console.log(`📍 API: ${API_URL}`);
  console.log(`🔑 Session: ${SESSION_ID}`);

  const turns = [];
  turns.push(await sendMessage('ORD-202665206 siparişim nerede?', 1));
  await new Promise(r => setTimeout(r, 800));

  turns.push(await sendMessage('1234', 2));
  await new Promise(r => setTimeout(r, 800));

  turns.push(await sendMessage('sipariş durumu ne?', 3));

  const allHaveOutcome = turns.every(t => VALID_OUTCOMES.has(t.outcome || t.metadata?.outcome));
  const sessionConsistent = turns.every(t => t.sessionId === SESSION_ID);
  const conversationConsistent = turns.every(t => t.conversationId === turns[0].conversationId);

  const statusFlow = turns.map(t => t.verificationStatus || 'none');
  const statusTransitionsValid = statusFlow.every((status, index) => {
    if (index === 0) return true;
    return isValidStatusTransition(statusFlow[index - 1], status);
  });

  console.log('\n' + '='.repeat(60));
  console.log('📊 CONTRACT CHECKS');
  console.log('='.repeat(60));
  console.log(`✅ Outcome enum valid: ${allHaveOutcome ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Session continuity: ${sessionConsistent ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Conversation continuity: ${conversationConsistent ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Verification transition contract: ${statusTransitionsValid ? 'PASS' : 'FAIL'}`);
  console.log(`📈 Verification flow: ${statusFlow.join(' -> ')}`);

  const success = allHaveOutcome && sessionConsistent && conversationConsistent && statusTransitionsValid;
  console.log('\n' + '='.repeat(60));
  console.log(`🎯 TEST RESULT: ${success ? '✅ PASS' : '❌ FAIL'}`);
  console.log('='.repeat(60));

  if (!success) {
    process.exitCode = 1;
  }
}

runTest().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exitCode = 1;
});
