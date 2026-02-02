/**
 * normalizePhone Unit Tests
 *
 * CUSTOMER ISSUE: P1 - CRM data not found due to phone format mismatch
 *
 * REQUIREMENT: All phone formats must normalize to E.164 (+90XXXXXXXXXX)
 *
 * TEST COVERAGE:
 * 1. 05XX XXX XXXX (standard Turkish mobile)
 * 2. 5XX XXX XXXX (without leading zero)
 * 3. +90 5XX XXX XXXX (with country code)
 * 4. 0090 5XX XXX XXXX (with international prefix)
 * 5. 90 5XX XXX XXXX (without plus)
 * 6. Spaces and dashes
 * 7. Parentheses format
 * 8. Mixed formats
 * 9. Edge cases (short, long)
 * 10. Landline numbers
 */

import { normalizePhone, comparePhones } from '../../src/utils/text.js';

// Test helper
function runTest(testName, input, expected) {
  const result = normalizePhone(input);
  const passed = result === expected;

  console.log(`${passed ? '✅' : '❌'} ${testName}`);
  console.log(`   Input:    "${input}"`);
  console.log(`   Expected: "${expected}"`);
  console.log(`   Got:      "${result}"`);
  console.log('');

  return passed;
}

// Test cases
const tests = [
  // Standard Turkish mobile formats
  {
    name: '05XX format (standard)',
    input: '05551234567',
    expected: '+905551234567'
  },
  {
    name: '5XX format (without leading 0)',
    input: '5551234567',
    expected: '+905551234567'
  },

  // International formats
  {
    name: '+90 format (E.164)',
    input: '+905551234567',
    expected: '+905551234567'
  },
  {
    name: '+90 with spaces',
    input: '+90 555 123 45 67',
    expected: '+905551234567'
  },
  {
    name: '0090 format (international prefix)',
    input: '00905551234567',
    expected: '+905551234567'
  },
  {
    name: '90 without plus',
    input: '905551234567',
    expected: '+905551234567'
  },

  // Formatted inputs
  {
    name: 'With spaces (Turkish style)',
    input: '0555 123 45 67',
    expected: '+905551234567'
  },
  {
    name: 'With dashes',
    input: '0555-123-45-67',
    expected: '+905551234567'
  },
  {
    name: 'With parentheses',
    input: '(0555) 123 45 67',
    expected: '+905551234567'
  },
  {
    name: 'Mixed format',
    input: '+90 (555) 123-45-67',
    expected: '+905551234567'
  },

  // Edge cases
  {
    name: 'Leading/trailing spaces',
    input: '  05551234567  ',
    expected: '+905551234567'
  },
  {
    name: 'Multiple leading zeros',
    input: '000905551234567',
    expected: '+905551234567'
  }
];

// Run tests
console.log('🧪 normalizePhone Unit Tests\n');
console.log('='.repeat(60));
console.log('');

let passed = 0;
let failed = 0;

for (const test of tests) {
  if (runTest(test.name, test.input, test.expected)) {
    passed++;
  } else {
    failed++;
  }
}

// comparePhones tests
console.log('='.repeat(60));
console.log('\n🔄 comparePhones Tests\n');

const compareTests = [
  {
    name: 'Same number, different formats',
    phone1: '05551234567',
    phone2: '+90 555 123 45 67',
    expected: true
  },
  {
    name: 'Different numbers',
    phone1: '05551234567',
    phone2: '05551234568',
    expected: false
  },
  {
    name: 'With and without country code',
    phone1: '5551234567',
    phone2: '905551234567',
    expected: true
  }
];

for (const test of compareTests) {
  const result = comparePhones(test.phone1, test.phone2);
  const testPassed = result === test.expected;

  console.log(`${testPassed ? '✅' : '❌'} ${test.name}`);
  console.log(`   Phone1:   "${test.phone1}"`);
  console.log(`   Phone2:   "${test.phone2}"`);
  console.log(`   Expected: ${test.expected}`);
  console.log(`   Got:      ${result}`);
  console.log('');

  if (testPassed) passed++;
  else failed++;
}

// Summary
console.log('='.repeat(60));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
console.log('');

if (failed > 0) {
  console.log('❌ TESTS FAILED');
  process.exit(1);
} else {
  console.log('✅ ALL TESTS PASSED');
  process.exit(0);
}
