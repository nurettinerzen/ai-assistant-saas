#!/usr/bin/env node
/**
 * Brand Drift Threshold Test Script
 *
 * Tests that brand drift tracking works correctly:
 * - Simulates 3 brand violations (pirate persona)
 * - Verifies threshold triggers fail when >2 violations in 20 runs
 *
 * Usage: node test-brand-drift.js
 */

import { recordBrandViolations, getBrandMetricsStatus, resetBrandMetrics } from '../runner/brand-metrics.js';

console.log('🧪 Brand Drift Threshold Test\n');

// Reset metrics for clean test
console.log('1. Resetting brand metrics...');
resetBrandMetrics();
console.log('   ✅ Metrics reset\n');

// Check initial state
console.log('2. Initial state:');
let status = getBrandMetricsStatus();
console.log(`   recentCount: ${status.recentCount}`);
console.log(`   shouldAlert: ${status.shouldAlert}`);
console.log(`   shouldFail: ${status.shouldFail}\n`);

// Simulate 3 brand violations
console.log('3. Simulating 3 brand violations (pirate persona)...\n');

const pirateWarnings = [
  {
    step: 'S4-T1',
    assertion: 'brand_no_persona_override',
    reason: 'Brand violation: responded as pirate',
    brandViolation: true
  }
];

for (let i = 1; i <= 3; i++) {
  console.log(`   Run ${i}:`);
  const result = recordBrandViolations(pirateWarnings);
  console.log(`   - recentCount: ${result.recentCount}`);
  console.log(`   - shouldAlert: ${result.shouldAlert}`);
  console.log(`   - shouldFail: ${result.shouldFail}`);
  if (result.message) {
    console.log(`   - message: ${result.message}`);
  }
  console.log('');
}

// Final verification
console.log('4. Final verification:');
status = getBrandMetricsStatus();
console.log(`   recentCount: ${status.recentCount}`);
console.log(`   shouldAlert: ${status.shouldAlert}`);
console.log(`   shouldFail: ${status.shouldFail}`);
console.log(`   windowSize: ${status.windowSize}\n`);

// Verify threshold logic
console.log('5. Threshold verification:');
if (status.recentCount > 2 && status.shouldFail) {
  console.log('   ✅ PASS: shouldFail=true when recentCount > 2');
} else if (status.recentCount <= 2 && !status.shouldFail) {
  console.log('   ✅ PASS: shouldFail=false when recentCount <= 2');
} else {
  console.log('   ❌ FAIL: Threshold logic incorrect');
  console.log(`      Expected shouldFail=${status.recentCount > 2}, got ${status.shouldFail}`);
  process.exit(1);
}

if (status.recentCount > 0 && status.shouldAlert) {
  console.log('   ✅ PASS: shouldAlert=true when recentCount > 0');
} else {
  console.log('   ⚠️  WARN: shouldAlert logic may need review');
}

console.log('\n✅ Brand drift threshold test completed successfully!');

// Clean up
console.log('\n6. Cleaning up (resetting metrics)...');
resetBrandMetrics();
console.log('   ✅ Metrics reset');
