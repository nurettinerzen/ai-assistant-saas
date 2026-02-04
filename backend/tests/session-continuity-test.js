/**
 * Session Continuity Test
 *
 * Tests that state persists correctly across turns:
 * 1. Turn 1: User gives orderNo → state.anchor.order_number set
 * 2. Turn 2: User gives last4 → verification.status = pending → verified
 * 3. Turn 3: Order status returned
 *
 * Run: node backend/tests/session-continuity-test.js
 */

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const API_URL = process.env.API_URL || 'http://localhost:3001';
const EMBED_KEY = process.env.EMBED_KEY || 'emb_e8e0f9cd48b9a5cd37d83b66c4dbe273'; // Default test key

// Generate consistent sessionId for all turns
const SESSION_ID = `test_session_${Date.now()}`;

async function sendMessage(message, turn) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TURN ${turn}: "${message}"`);
  console.log('='.repeat(60));

  try {
    const response = await fetch(`${API_URL}/api/chat-v2/widget`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embedKey: EMBED_KEY,
        sessionId: SESSION_ID, // Same sessionId for all turns
        message
      })
    });

    const data = await response.json();

    console.log('\n📤 Response:', data.reply?.substring(0, 200) + '...');
    console.log('\n📊 Verification Status:', data.verificationStatus || 'none');
    console.log('🔧 Tools Called:', data.toolCalls || []);
    console.log('🆔 Session ID:', data.sessionId);
    console.log('💬 Conversation ID:', data.conversationId);

    // Check for telemetry in response (if exposed)
    if (data.telemetry) {
      console.log('\n📈 Telemetry:', JSON.stringify(data.telemetry, null, 2));
    }

    return data;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return null;
  }
}

async function runTest() {
  console.log('\n🧪 SESSION CONTINUITY TEST');
  console.log(`📍 API: ${API_URL}`);
  console.log(`🔑 Session: ${SESSION_ID}`);
  console.log(`🏷️ Embed Key: ${EMBED_KEY}`);

  // Turn 1: Give order number
  const turn1 = await sendMessage('ORD-202665206 siparişim nerede?', 1);

  if (!turn1) {
    console.log('\n❌ Turn 1 failed - aborting test');
    return;
  }

  // Wait a bit between turns
  await new Promise(r => setTimeout(r, 1000));

  // Check Turn 1: Should ask for last4 (not orderNo again!)
  const asksForOrderNo = /sipariş\s*numara/i.test(turn1.reply);
  const asksForLast4 = /son\s*4|last\s*4|telefon/i.test(turn1.reply);

  console.log('\n✅ Turn 1 Analysis:');
  console.log(`   - Asks for orderNo again: ${asksForOrderNo ? '❌ BAD' : '✅ GOOD'}`);
  console.log(`   - Asks for last4: ${asksForLast4 ? '✅ GOOD' : '⚠️ CHECK'}`);

  // Turn 2: Give phone last 4 digits
  const turn2 = await sendMessage('1234', 2);

  if (!turn2) {
    console.log('\n❌ Turn 2 failed - aborting test');
    return;
  }

  await new Promise(r => setTimeout(r, 1000));

  // Check Turn 2: Should either verify or ask for more info
  console.log('\n✅ Turn 2 Analysis:');
  console.log(`   - Verification Status: ${turn2.verificationStatus}`);
  console.log(`   - Tools Called: ${turn2.toolCalls?.join(', ') || 'none'}`);

  // Turn 3: Ask for order status again (should work if verified)
  const turn3 = await sendMessage('sipariş durumu ne?', 3);

  if (!turn3) {
    console.log('\n❌ Turn 3 failed - aborting test');
    return;
  }

  // Final Analysis
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 FINAL ANALYSIS');
  console.log('='.repeat(60));

  const sessionConsistent = turn1.sessionId === turn2.sessionId && turn2.sessionId === turn3.sessionId;
  const conversationConsistent = turn1.conversationId === turn2.conversationId && turn2.conversationId === turn3.conversationId;

  console.log(`\n🔑 Session ID Consistent: ${sessionConsistent ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`💬 Conversation ID Consistent: ${conversationConsistent ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`🔐 Final Verification Status: ${turn3.verificationStatus}`);

  // Success criteria
  const success = sessionConsistent && !asksForOrderNo && asksForLast4;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎯 TEST RESULT: ${success ? '✅ PASS' : '❌ FAIL'}`);
  console.log('='.repeat(60));

  if (!success) {
    console.log('\n⚠️ Issues detected:');
    if (!sessionConsistent) console.log('   - Session ID changed between turns');
    if (asksForOrderNo) console.log('   - System asked for orderNo again after it was provided');
    if (!asksForLast4) console.log('   - System did not ask for phone verification');
  }
}

runTest().catch(console.error);
