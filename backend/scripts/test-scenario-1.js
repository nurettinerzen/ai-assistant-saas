/**
 * Staging Validation - Scenario 1: Split Billing
 * STARTER plan, balance=100 TL, 10 min call
 */

import { PrismaClient } from '@prisma/client';
import usageService from '../src/services/usageService.js';

const prisma = new PrismaClient();

async function testScenario1() {
  try {
    console.log('=== SCENARIO 1: Split Billing (Balance + Included) ===\n');

    const subscriptionId = 66;

    // Get initial state
    const before = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      select: { balance: true, includedMinutesUsed: true, overageMinutes: true }
    });

    console.log('📊 BEFORE:');
    console.log(JSON.stringify(before, null, 2));
    console.log('');

    // Record 10-minute call
    console.log('🔄 Recording 10-minute call...\n');
    const result = await usageService.recordUsage({
      subscriptionId,
      channel: 'PHONE',
      callId: 'staging-test-scenario-1',
      conversationId: 'conv-test-1',
      durationSeconds: 600, // 10 minutes
      assistantId: 'test-assistant',
      metadata: { test: 'scenario-1' }
    });

    console.log('✅ API RESPONSE:');
    console.log(JSON.stringify({
      success: result.success,
      chargeType: result.chargeResult.chargeType,
      totalCharge: result.chargeResult.totalCharge,
      breakdown: result.chargeResult.breakdown,
      idempotent: result.idempotent
    }, null, 2));
    console.log('');

    // Get final state
    const after = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      select: { balance: true, includedMinutesUsed: true, overageMinutes: true }
    });

    console.log('📊 AFTER:');
    console.log(JSON.stringify(after, null, 2));
    console.log('');

    // Validation
    console.log('🧪 VALIDATION:');
    const expectedBalanceChange = 100; // All balance used
    const expectedIncludedUsed = 10 - (100 / 23); // ~5.65 minutes

    const balanceMatch = Math.abs(after.balance - 0) < 0.01;
    const includedMatch = Math.abs(after.includedMinutesUsed - expectedIncludedUsed) < 0.1;
    const overageUnchanged = after.overageMinutes === 0;

    console.log(`Balance: ${before.balance} → ${after.balance} (expected: 0) ${balanceMatch ? '✅' : '❌'}`);
    console.log(`Included: ${before.includedMinutesUsed} → ${after.includedMinutesUsed.toFixed(2)} (expected: ~${expectedIncludedUsed.toFixed(2)}) ${includedMatch ? '✅' : '❌'}`);
    console.log(`Overage: ${after.overageMinutes} (expected: 0) ${overageUnchanged ? '✅' : '❌'}`);
    console.log(`ChargeType: ${result.chargeResult.chargeType} (expected: BALANCE_INCLUDED) ${result.chargeResult.chargeType === 'BALANCE_INCLUDED' ? '✅' : '❌'}`);

    await prisma.$disconnect();

    if (balanceMatch && includedMatch && overageUnchanged && result.chargeResult.chargeType === 'BALANCE_INCLUDED') {
      console.log('\n✅ SCENARIO 1: PASS');
      process.exit(0);
    } else {
      console.log('\n❌ SCENARIO 1: FAIL');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Test error:', error.message);
    console.error(error.stack);
    await prisma.$disconnect();
    process.exit(1);
  }
}

testScenario1();
