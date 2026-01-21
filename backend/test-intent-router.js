/**
 * Test Intent Router
 * Quick manual test for intent detection
 */

import { detectIntent, routeIntent } from './src/services/intent-router.js';

// Test messages
const testMessages = [
  // Order status
  { msg: 'Siparişim nerede?', expected: 'order_status' },
  { msg: 'Kargom ne zaman gelecek?', expected: 'order_status' },
  { msg: 'Where is my order?', expected: 'order_status', lang: 'EN' },

  // Debt inquiry
  { msg: 'Borcum ne kadar?', expected: 'debt_inquiry' },
  { msg: 'SGK borcum var mı?', expected: 'debt_inquiry' },

  // Stock check
  { msg: 'Bu ürün var mı?', expected: 'stock_check' },
  { msg: 'Stokta var mı?', expected: 'stock_check' },

  // Company info
  { msg: 'Çalışma saatleriniz nedir?', expected: 'company_info' },
  { msg: 'Adresiniz nedir?', expected: 'company_info' },

  // Greeting
  { msg: 'Merhaba', expected: 'greeting' },
  { msg: 'Selam', expected: 'greeting' },
  { msg: 'Hello', expected: 'greeting', lang: 'EN' },

  // Off-topic
  { msg: 'Bugün hava nasıl?', expected: 'off_topic' },
  { msg: 'Ne yemek yapsam?', expected: 'off_topic' },
  { msg: 'Galatasaray kaç kaç?', expected: 'off_topic' }
];

async function runTests() {
  console.log('🧪 INTENT ROUTER TEST SUITE\n');
  console.log('='.repeat(60));

  let passed = 0;
  let failed = 0;

  for (const test of testMessages) {
    const lang = test.lang || 'TR';
    const detected = await detectIntent(test.msg, lang);

    const isPassed = detected === test.expected;
    const status = isPassed ? '✅ PASS' : '❌ FAIL';

    if (isPassed) {
      passed++;
    } else {
      failed++;
    }

    console.log(`\n${status}`);
    console.log(`  Message: "${test.msg}"`);
    console.log(`  Expected: ${test.expected}`);
    console.log(`  Detected: ${detected}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 RESULTS: ${passed} passed, ${failed} failed (${testMessages.length} total)\n`);

  // Test routing with session
  console.log('\n🔄 TESTING ROUTING WITH SESSION\n');
  console.log('='.repeat(60));

  const sessionId = 'test-session-123';

  // Test 1: Order status
  console.log('\n🔍 Test 1: Order status query');
  const result1 = await routeIntent('Siparişim nerede?', sessionId, 'TR');
  console.log('Result:', JSON.stringify(result1, null, 2));

  // Test 2: Off-topic (1st time)
  console.log('\n🔍 Test 2: Off-topic (1st strike)');
  const result2 = await routeIntent('Bugün hava nasıl?', sessionId, 'TR');
  console.log('Result:', JSON.stringify(result2, null, 2));

  // Test 3: Off-topic (2nd time)
  console.log('\n🔍 Test 3: Off-topic (2nd strike)');
  const result3 = await routeIntent('Ne yemek yapsam?', sessionId, 'TR');
  console.log('Result:', JSON.stringify(result3, null, 2));

  // Test 4: Off-topic (3rd time - should terminate)
  console.log('\n🔍 Test 4: Off-topic (3rd strike - TERMINATION)');
  const result4 = await routeIntent('Galatasaray kaç kaç?', sessionId, 'TR');
  console.log('Result:', JSON.stringify(result4, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log('\n✅ All tests completed!\n');
}

runTests().catch(console.error);
