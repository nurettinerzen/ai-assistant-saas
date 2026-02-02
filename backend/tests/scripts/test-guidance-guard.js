#!/usr/bin/env node
/**
 * Guidance Guard Unit Test Script
 *
 * Tests that ensurePolicyGuidance() triggers correctly for:
 * 1. Return rejected → guard SHOULD trigger
 * 2. Order verification pending → guard should NOT trigger
 * 3. Out-of-domain question → guard should NOT trigger
 *
 * Usage: VERBOSE=true node test-guidance-guard.js
 */

// Set VERBOSE for detailed logging
process.env.VERBOSE = 'true';

import { ensurePolicyGuidance, isPolicyTopic } from '../../src/services/tool-fail-handler.js';

console.log('🧪 Guidance Guard Unit Test\n');
console.log('='.repeat(60) + '\n');

const testCases = [
  // Case 1: Return rejected - SHOULD trigger
  {
    name: 'Case 1: Return rejected',
    userMessage: 'İade talebim neden reddedildi?',
    response: 'Maalesef iade talebiniz onaylanmadı.',
    expectedTrigger: true,
    description: 'Policy topic (iade), missing guidance → SHOULD add guidance'
  },

  // Case 2: Order verification pending - should NOT trigger
  {
    name: 'Case 2: Order verification pending',
    userMessage: 'Siparişimi görmek istiyorum',
    response: 'Sipariş bilgilerinize erişmek için lütfen telefon numaranızı doğrulayın.',
    expectedTrigger: false,
    description: 'Not a policy topic (verification flow) → should NOT trigger'
  },

  // Case 3: Out-of-domain question - should NOT trigger
  {
    name: 'Case 3: Out-of-domain question',
    userMessage: "Mars'a ne zaman göç edebiliriz?",
    response: 'Bu konuda yardımcı olamıyorum. Size ürünlerimiz hakkında yardımcı olabilirim.',
    expectedTrigger: false,
    description: 'Not a policy topic (OOD) → should NOT trigger'
  },

  // Case 4: Refund with existing guidance - should NOT add more
  {
    name: 'Case 4: Refund with sufficient guidance',
    userMessage: 'Para iadesi istiyorum',
    response: 'Para iadeniz 3-5 iş günü içinde hesabınıza yatacaktır. Müşteri hizmetlerimizi arayabilirsiniz. Sipariş numaranızı hazır bulundurun.',
    expectedTrigger: false,
    description: 'Policy topic but already has 3 guidance components → should NOT add'
  },

  // Case 5: Cancel order with minimal response
  {
    name: 'Case 5: Cancel with minimal response',
    userMessage: 'Siparişimi iptal etmek istiyorum',
    response: 'Siparişiniz iptal edilemez.',
    expectedTrigger: true,
    description: 'Policy topic (iptal), missing guidance → SHOULD add guidance'
  },

  // Case 6: General greeting - should NOT trigger
  {
    name: 'Case 6: General greeting',
    userMessage: 'Merhaba, nasılsınız?',
    response: 'Merhaba! Size nasıl yardımcı olabilirim?',
    expectedTrigger: false,
    description: 'Not a policy topic (greeting) → should NOT trigger'
  }
];

let passed = 0;
let failed = 0;

for (const tc of testCases) {
  console.log(`📋 ${tc.name}`);
  console.log(`   Description: ${tc.description}`);
  console.log(`   userMessage: "${tc.userMessage}"`);
  console.log(`   response: "${tc.response.substring(0, 60)}..."`);
  console.log('');

  // Check isPolicyTopic first
  const isPolicyResult = isPolicyTopic(tc.userMessage, 'TR');
  console.log(`   isPolicyTopic: ${isPolicyResult}`);

  // Run ensurePolicyGuidance
  const result = ensurePolicyGuidance(tc.response, tc.userMessage, 'TR');

  console.log(`   guidanceAdded: ${result.guidanceAdded}`);
  if (result.addedComponents?.length > 0) {
    console.log(`   addedComponents: ${result.addedComponents.join(', ')}`);
  }

  // Verify result
  const actualTrigger = result.guidanceAdded;
  if (actualTrigger === tc.expectedTrigger) {
    console.log(`   ✅ PASS: Expected trigger=${tc.expectedTrigger}, got ${actualTrigger}`);
    passed++;
  } else {
    console.log(`   ❌ FAIL: Expected trigger=${tc.expectedTrigger}, got ${actualTrigger}`);
    failed++;
  }

  // Show before/after if guidance was added
  if (result.guidanceAdded) {
    console.log('');
    console.log('   BEFORE:');
    console.log(`   "${tc.response}"`);
    console.log('');
    console.log('   AFTER:');
    console.log(`   "${result.response}"`);
  }

  console.log('');
  console.log('-'.repeat(60) + '\n');
}

// Summary
console.log('='.repeat(60));
console.log('SUMMARY');
console.log('='.repeat(60));
console.log(`Total tests: ${testCases.length}`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);

if (failed > 0) {
  console.log('\n❌ Some tests failed!');
  process.exit(1);
} else {
  console.log('\n✅ All tests passed!');
  process.exit(0);
}
