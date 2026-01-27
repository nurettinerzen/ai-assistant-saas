/**
 * P0-B PROOF: Downgrade doesn't block calls - overage continues
 *
 * Test scenario:
 * 1. Enterprise customer with 5000 included minutes (custom)
 * 2. Used 2500 minutes
 * 3. Downgrade to PRO (500 included)
 * 4. Expected: canMakeCall = true, reason = OVERAGE_POSTPAID, remainingIncluded = 0
 * 5. Continue using until overageLimit reached
 * 6. Then: canMakeCall = false, reason = OVERAGE_LIMIT_REACHED
 */

import { PrismaClient } from '@prisma/client';
import chargeCalculator from '../src/services/chargeCalculator.js';

const prisma = new PrismaClient();

async function testDowngradeOverage() {
  console.log('\n🧪 P0-B Test: Enterprise → Pro Downgrade + Overage\n');

  try {
    // Use first available business or create a minimal test setup
    let business = await prisma.business.findFirst({
      include: { subscription: true }
    });

    if (!business) {
      console.log('❌ No business found in DB. Please run app first to create test data.');
      return;
    }

    console.log(`Using business: ${business.name} (ID: ${business.id})`);

    // STEP 1: Create Enterprise subscription with custom 5000 minutes
    console.log('📊 STEP 1: Create Enterprise with 5000 included minutes');
    const enterpriseSub = await prisma.subscription.upsert({
      where: { businessId: business.id },
      create: {
        businessId: business.id,
        plan: 'ENTERPRISE',
        status: 'ACTIVE',
        enterpriseMinutes: 5000,  // Custom enterprise config
        enterprisePrice: 10000,
        enterprisePaymentStatus: 'paid',
        includedMinutesUsed: 0,
        overageMinutes: 0,
        overageLimit: 200,
        activeCalls: 0
      },
      update: {
        plan: 'ENTERPRISE',
        status: 'ACTIVE',
        enterpriseMinutes: 5000,
        enterprisePrice: 10000,
        enterprisePaymentStatus: 'paid',
        includedMinutesUsed: 0,
        overageMinutes: 0,
        overageLimit: 200
      },
      include: { business: true }
    });

    console.log(`✅ Enterprise created: ${enterpriseSub.id}`);
    console.log(`   - Plan: ${enterpriseSub.plan}`);
    console.log(`   - enterpriseMinutes: ${enterpriseSub.enterpriseMinutes}`);
    console.log(`   - includedMinutesUsed: ${enterpriseSub.includedMinutesUsed}`);

    // STEP 2: Use 2500 minutes
    console.log('\n📊 STEP 2: Use 2500 minutes');
    await prisma.subscription.update({
      where: { id: enterpriseSub.id },
      data: { includedMinutesUsed: 2500 }
    });

    const afterUsage = await prisma.subscription.findUnique({
      where: { id: enterpriseSub.id },
      include: { business: true }
    });

    console.log(`✅ Usage updated: ${afterUsage.includedMinutesUsed} / ${afterUsage.enterpriseMinutes}`);

    // Check canMakeCall before downgrade
    const beforeDowngrade = await chargeCalculator.canMakeCallWithBalance(afterUsage.businessId);
    console.log(`   - canMakeCall: ${beforeDowngrade.canMakeCall}`);
    console.log(`   - reason: ${beforeDowngrade.reason}`);
    console.log(`   - estimatedMinutesRemaining: ${beforeDowngrade.estimatedMinutesRemaining}`);

    // STEP 3: Downgrade to PRO (500 included)
    console.log('\n📊 STEP 3: Downgrade to PRO (500 included)');
    const downgraded = await prisma.subscription.update({
      where: { id: enterpriseSub.id },
      data: {
        plan: 'PRO',
        enterpriseMinutes: null,  // Remove enterprise override
        enterprisePrice: null,
        enterprisePaymentStatus: null
      },
      include: { business: true }
    });

    console.log(`✅ Downgraded to: ${downgraded.plan}`);
    console.log(`   - enterpriseMinutes: ${downgraded.enterpriseMinutes} (should be null)`);
    console.log(`   - includedMinutesUsed: ${downgraded.includedMinutesUsed} (unchanged at 2500)`);

    // STEP 4: THE CRITICAL TEST - Can make call after downgrade?
    console.log('\n🔥 STEP 4: CRITICAL TEST - canMakeCall after downgrade?');
    const afterDowngrade = await chargeCalculator.canMakeCallWithBalance(downgraded.businessId);

    console.log(`   - canMakeCall: ${afterDowngrade.canMakeCall}`);
    console.log(`   - reason: ${afterDowngrade.reason}`);
    console.log(`   - estimatedMinutesRemaining: ${afterDowngrade.estimatedMinutesRemaining}`);

    // Calculate remainingIncluded manually
    const proIncluded = 500; // PRO plan default
    const used = downgraded.includedMinutesUsed;
    const remainingIncluded = Math.max(0, proIncluded - used);

    console.log(`\n📐 Manual calculation:`);
    console.log(`   - PRO includedMinutes: ${proIncluded}`);
    console.log(`   - includedMinutesUsed: ${used}`);
    console.log(`   - remainingIncluded: max(0, ${proIncluded} - ${used}) = ${remainingIncluded}`);
    console.log(`   - overageUsed: ${downgraded.overageMinutes}`);
    console.log(`   - overageLimit: ${downgraded.overageLimit}`);

    // ASSERTION 1: Should allow calls via overage
    if (afterDowngrade.canMakeCall === true && afterDowngrade.reason === 'OVERAGE_POSTPAID') {
      console.log(`\n✅ PASS: Downgrade doesn't block - overage continues`);
    } else {
      console.log(`\n❌ FAIL: Expected canMakeCall=true, reason=OVERAGE_POSTPAID`);
      console.log(`   Got: canMakeCall=${afterDowngrade.canMakeCall}, reason=${afterDowngrade.reason}`);
    }

    // STEP 5: Use overage until limit
    console.log('\n📊 STEP 5: Use overage until limit');
    await prisma.subscription.update({
      where: { id: enterpriseSub.id },
      data: { overageMinutes: 200 }  // Hit overage limit
    });

    const overageFull = await prisma.subscription.findUnique({
      where: { id: enterpriseSub.id },
      include: { business: true }
    });

    const afterOverageFull = await chargeCalculator.canMakeCallWithBalance(overageFull.businessId);

    console.log(`   - overageUsed: ${overageFull.overageMinutes} / ${overageFull.overageLimit}`);
    console.log(`   - canMakeCall: ${afterOverageFull.canMakeCall}`);
    console.log(`   - reason: ${afterOverageFull.reason}`);

    // ASSERTION 2: Should block when overage limit reached
    if (afterOverageFull.canMakeCall === false && afterOverageFull.reason === 'OVERAGE_LIMIT_REACHED') {
      console.log(`\n✅ PASS: Overage limit blocks correctly`);
    } else {
      console.log(`\n❌ FAIL: Expected canMakeCall=false, reason=OVERAGE_LIMIT_REACHED`);
      console.log(`   Got: canMakeCall=${afterOverageFull.canMakeCall}, reason=${afterOverageFull.reason}`);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 P0-B TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Test 1: Downgrade allows overage: ${afterDowngrade.canMakeCall === true && afterDowngrade.reason === 'OVERAGE_POSTPAID' ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Test 2: Overage limit blocks: ${afterOverageFull.canMakeCall === false && afterOverageFull.reason === 'OVERAGE_LIMIT_REACHED' ? '✅ PASS' : '❌ FAIL'}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDowngradeOverage();
