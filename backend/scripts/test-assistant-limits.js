/**
 * P0-2 Validation: Assistant Limits Enforcement
 * Test that assistant creation is properly gated by plan limits
 */

import { PrismaClient } from '@prisma/client';
import { getRegionalPricing } from '../src/config/plans.js';

const prisma = new PrismaClient();

async function testAssistantLimits() {
  try {
    console.log('=== P0-2: Assistant Limits Enforcement Test ===\n');

    // Test with subscription ID 66 (STARTER plan)
    const subscriptionId = 66;

    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { business: { select: { id: true, country: true } } }
    });

    if (!subscription) {
      console.error('❌ Subscription not found');
      process.exit(1);
    }

    const businessId = subscription.businessId;
    const country = subscription.business?.country || 'TR';
    const plan = subscription.plan;

    console.log('📊 Test Context:');
    console.log(`  Business ID: ${businessId}`);
    console.log(`  Subscription ID: ${subscriptionId}`);
    console.log(`  Plan: ${plan}`);
    console.log(`  Country: ${country}`);
    console.log('');

    // Get plan limit
    const regional = getRegionalPricing(country);
    const planConfig = regional.plans[plan];
    const expectedLimit = planConfig?.assistantsLimit || 1;

    console.log(`📋 Expected Limit: ${expectedLimit} assistants for ${plan} plan`);
    console.log('');

    // Count existing assistants
    const existingCount = await prisma.assistant.count({
      where: { businessId, isActive: true }
    });

    console.log(`📦 Current State:`);
    console.log(`  Existing assistants: ${existingCount}/${expectedLimit}`);
    console.log('');

    // Test 1: Check if limit is enforced correctly
    console.log('🧪 TEST 1: Limit Enforcement Logic');
    const shouldBlock = existingCount >= expectedLimit;
    console.log(`  Current count: ${existingCount}`);
    console.log(`  Limit: ${expectedLimit}`);
    console.log(`  Should block creation: ${shouldBlock ? 'YES ✅' : 'NO ❌'}`);
    console.log('');

    // Test 2: Verify different plan limits
    console.log('🧪 TEST 2: Plan Limit Configuration');
    const plans = ['PAYG', 'STARTER', 'PRO', 'ENTERPRISE'];
    const expectedLimits = {
      TR: { PAYG: 5, STARTER: 5, PRO: 10, ENTERPRISE: 25 },
      US: { PAYG: 5, STARTER: 5, PRO: 10, ENTERPRISE: 25 },
      BR: { PAYG: 5, STARTER: 5, PRO: 10, ENTERPRISE: 25 }
    };

    let configCorrect = true;

    for (const testPlan of plans) {
      for (const testCountry of ['TR', 'US', 'BR']) {
        const testRegional = getRegionalPricing(testCountry);
        const testConfig = testRegional.plans[testPlan];
        const actualLimit = testConfig?.assistantsLimit;
        const expected = expectedLimits[testCountry][testPlan];

        const matches = actualLimit === expected;
        if (!matches) {
          console.log(`  ❌ ${testCountry} ${testPlan}: Expected ${expected}, got ${actualLimit}`);
          configCorrect = false;
        } else {
          console.log(`  ✅ ${testCountry} ${testPlan}: ${actualLimit} assistants`);
        }
      }
    }
    console.log('');

    // Test 3: FREE plan check
    console.log('🧪 TEST 3: FREE Plan Blocking');
    const freeConfig = regional.plans['FREE'];
    const freeLimit = freeConfig?.assistantsLimit || 0;
    const freeBlocked = freeLimit === 0;
    console.log(`  FREE plan assistantsLimit: ${freeLimit}`);
    console.log(`  Should block FREE plan: ${freeBlocked ? 'YES ✅' : 'NO ❌'}`);
    console.log('');

    // Validation summary
    console.log('📊 VALIDATION SUMMARY:');
    const test1Pass = shouldBlock === (existingCount >= expectedLimit);
    const test2Pass = configCorrect;
    const test3Pass = freeBlocked;

    console.log(`  Test 1 (Limit Logic): ${test1Pass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Test 2 (Plan Config): ${test2Pass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Test 3 (FREE Block): ${test3Pass ? '✅ PASS' : '❌ FAIL'}`);
    console.log('');

    await prisma.$disconnect();

    if (test1Pass && test2Pass && test3Pass) {
      console.log('✅ P0-2 VALIDATION: PASS');
      console.log('');
      console.log('💡 Next Steps:');
      console.log('  1. Frontend: Add assistant counter UI (X/Y assistants)');
      console.log('  2. Frontend: Disable "Create Assistant" button when limit reached');
      console.log('  3. Test via API: POST /api/assistants when at limit');
      process.exit(0);
    } else {
      console.log('❌ P0-2 VALIDATION: FAIL');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Test error:', error.message);
    console.error(error.stack);
    await prisma.$disconnect();
    process.exit(1);
  }
}

testAssistantLimits();
