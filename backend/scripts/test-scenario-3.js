/**
 * Staging Validation - Scenario 3: Idempotency (Duplicate callId)
 * Same callId sent twice - should return 200 + idempotent flag, no double charge
 */

import { PrismaClient } from '@prisma/client';
import usageService from '../src/services/usageService.js';

const prisma = new PrismaClient();

async function testScenario3() {
  try {
    console.log('=== SCENARIO 3: Idempotency (Duplicate callId) ===\n');

    const subscriptionId = 66;

    // Setup: Reset to clean state
    await prisma.usageRecord.deleteMany({ where: { callId: 'staging-test-scenario-3' } });
    await prisma.balanceTransaction.deleteMany({ where: { subscriptionId: 66 } });
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        balance: 100,
        includedMinutesUsed: 0,
        overageMinutes: 0
      }
    });

    const before = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      select: { balance: true, includedMinutesUsed: true }
    });

    console.log('📊 BEFORE (fresh state):');
    console.log(JSON.stringify(before, null, 2));
    console.log('');

    // FIRST REQUEST
    console.log('🔄 First request (callId: staging-test-scenario-3)...\n');
    const result1 = await usageService.recordUsage({
      subscriptionId,
      channel: 'PHONE',
      callId: 'staging-test-scenario-3',
      conversationId: 'conv-test-3',
      durationSeconds: 300, // 5 minutes
      assistantId: 'test-assistant',
      metadata: { test: 'scenario-3-first' }
    });

    console.log('✅ First Response:');
    console.log(JSON.stringify({
      success: result1.success,
      idempotent: result1.idempotent,
      chargeType: result1.chargeResult.chargeType,
      totalCharge: result1.chargeResult.totalCharge
    }, null, 2));
    console.log('');

    const afterFirst = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      select: { balance: true, includedMinutesUsed: true }
    });

    console.log('📊 AFTER FIRST:');
    console.log(JSON.stringify(afterFirst, null, 2));
    console.log('');

    // SECOND REQUEST (DUPLICATE)
    console.log('🔄 Second request (SAME callId)...\n');
    const result2 = await usageService.recordUsage({
      subscriptionId,
      channel: 'PHONE',
      callId: 'staging-test-scenario-3', // SAME callId
      conversationId: 'conv-test-3',
      durationSeconds: 300,
      assistantId: 'test-assistant',
      metadata: { test: 'scenario-3-duplicate' }
    });

    console.log('✅ Second Response:');
    console.log(JSON.stringify({
      success: result2.success,
      idempotent: result2.idempotent, // Should be true
      chargeType: result2.chargeResult.chargeType,
      totalCharge: result2.chargeResult.totalCharge
    }, null, 2));
    console.log('');

    const afterSecond = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      select: { balance: true, includedMinutesUsed: true }
    });

    console.log('📊 AFTER SECOND:');
    console.log(JSON.stringify(afterSecond, null, 2));
    console.log('');

    // Count UsageRecords
    const recordCount = await prisma.usageRecord.count({
      where: { callId: 'staging-test-scenario-3' }
    });

    // Validation
    console.log('🧪 VALIDATION:');
    const firstSucceeded = result1.success && !result1.idempotent;
    const secondIdempotent = result2.success && result2.idempotent === true;
    const balanceUnchanged = afterFirst.balance === afterSecond.balance;
    const includedUnchanged = afterFirst.includedMinutesUsed === afterSecond.includedMinutesUsed;
    const onlyOneRecord = recordCount === 1;

    console.log(`First request: success=${result1.success}, idempotent=${result1.idempotent} (expected: success, not idempotent) ${firstSucceeded ? '✅' : '❌'}`);
    console.log(`Second request: success=${result2.success}, idempotent=${result2.idempotent} (expected: success + idempotent=true) ${secondIdempotent ? '✅' : '❌'}`);
    console.log(`Balance unchanged: ${afterFirst.balance} === ${afterSecond.balance} ${balanceUnchanged ? '✅' : '❌'}`);
    console.log(`Included unchanged: ${afterFirst.includedMinutesUsed.toFixed(2)} === ${afterSecond.includedMinutesUsed.toFixed(2)} ${includedUnchanged ? '✅' : '❌'}`);
    console.log(`UsageRecord count: ${recordCount} (expected: 1) ${onlyOneRecord ? '✅' : '❌'}`);

    await prisma.$disconnect();

    if (firstSucceeded && secondIdempotent && balanceUnchanged && includedUnchanged && onlyOneRecord) {
      console.log('\n✅ SCENARIO 3: PASS');
      process.exit(0);
    } else {
      console.log('\n❌ SCENARIO 3: FAIL');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Test error:', error.message);
    console.error(error.stack);
    await prisma.$disconnect();
    process.exit(1);
  }
}

testScenario3();
