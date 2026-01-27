/**
 * Staging Validation - Scenario 2: Overage Tracking
 * STARTER plan, balance=0, included exhausted, 10 min call
 */

import { PrismaClient } from '@prisma/client';
import usageService from '../src/services/usageService.js';

const prisma = new PrismaClient();

async function testScenario2() {
  try {
    console.log('=== SCENARIO 2: Overage Tracking (Included Exhausted) ===\n');

    const subscriptionId = 66;

    // Setup: Reset and exhaust included
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        balance: 0,
        includedMinutesUsed: 150, // All included used
        overageMinutes: 0
      }
    });

    const before = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      select: { balance: true, includedMinutesUsed: true, overageMinutes: true }
    });

    console.log('📊 BEFORE:');
    console.log(JSON.stringify(before, null, 2));
    console.log('');

    // Record 10-minute call
    console.log('🔄 Recording 10-minute call (should go to overage)...\n');
    const result = await usageService.recordUsage({
      subscriptionId,
      channel: 'PHONE',
      callId: 'staging-test-scenario-2',
      conversationId: 'conv-test-2',
      durationSeconds: 600,
      assistantId: 'test-assistant',
      metadata: { test: 'scenario-2' }
    });

    console.log('✅ API RESPONSE:');
    console.log(JSON.stringify({
      success: result.success,
      chargeType: result.chargeResult.chargeType,
      totalCharge: result.chargeResult.totalCharge,
      breakdown: result.chargeResult.breakdown
    }, null, 2));
    console.log('');

    const after = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      select: { balance: true, includedMinutesUsed: true, overageMinutes: true }
    });

    console.log('📊 AFTER:');
    console.log(JSON.stringify(after, null, 2));
    console.log('');

    // Validation
    console.log('🧪 VALIDATION:');
    const balanceUnchanged = after.balance === 0;
    const includedUnchanged = after.includedMinutesUsed === 150;
    const overageIncreased = after.overageMinutes === 10;
    const totalChargeZero = result.chargeResult.totalCharge === 0;
    const chargeTypeCorrect = result.chargeResult.chargeType === 'OVERAGE';

    console.log(`Balance: ${before.balance} → ${after.balance} (expected: 0) ${balanceUnchanged ? '✅' : '❌'}`);
    console.log(`Included: ${before.includedMinutesUsed} → ${after.includedMinutesUsed} (expected: 150) ${includedUnchanged ? '✅' : '❌'}`);
    console.log(`Overage: ${before.overageMinutes} → ${after.overageMinutes} (expected: 10) ${overageIncreased ? '✅' : '❌'}`);
    console.log(`TotalCharge: ${result.chargeResult.totalCharge} (expected: 0 - postpaid) ${totalChargeZero ? '✅' : '❌'}`);
    console.log(`ChargeType: ${result.chargeResult.chargeType} (expected: OVERAGE) ${chargeTypeCorrect ? '✅' : '❌'}`);

    await prisma.$disconnect();

    if (balanceUnchanged && includedUnchanged && overageIncreased && totalChargeZero && chargeTypeCorrect) {
      console.log('\n✅ SCENARIO 2: PASS');
      process.exit(0);
    } else {
      console.log('\n❌ SCENARIO 2: FAIL');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Test error:', error.message);
    console.error(error.stack);
    await prisma.$disconnect();
    process.exit(1);
  }
}

testScenario2();
