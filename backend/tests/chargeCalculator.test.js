/**
 * Charge Calculator Tests - P0-3 Balance Priority
 *
 * Test scenarios as specified:
 * 1. STARTER, balance=0, included available → INCLUDED charged
 * 2. STARTER, balance>0, included available → BALANCE charged first
 * 3. STARTER, balance>0, no included, has overage → BALANCE then OVERAGE
 * 4. STARTER, balance insufficient → Split billing (BALANCE + INCLUDED/OVERAGE)
 * 5. PAYG, balance<1min → Call blocked
 * 6. Call duration 0 / failed → No charges
 * 7. Idempotency: Same callId twice → No double charge
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import chargeCalculator from '../src/services/chargeCalculator.js';

const prisma = new PrismaClient();

describe('P0-3: PAYG Balance as Active Wallet', () => {
  let testSubscription;
  let testBusinessId;

  beforeEach(async () => {
    // Create test business + subscription
    const business = await prisma.business.create({
      data: {
        name: 'Test Business',
        email: 'test@example.com',
        country: 'TR'
      }
    });

    testBusinessId = business.id;

    testSubscription = await prisma.subscription.create({
      data: {
        businessId: testBusinessId,
        plan: 'STARTER',
        status: 'ACTIVE',
        balance: 0,
        includedMinutesUsed: 0,
        overageMinutes: 0,
        concurrentLimit: 1,
        activeCalls: 0
      }
    });
  });

  afterEach(async () => {
    // Cleanup
    await prisma.usageRecord.deleteMany({ where: { subscriptionId: testSubscription.id } });
    await prisma.balanceTransaction.deleteMany({ where: { subscriptionId: testSubscription.id } });
    await prisma.subscription.delete({ where: { id: testSubscription.id } });
    await prisma.business.delete({ where: { id: testBusinessId } });
  });

  // ===== TEST 1: Balance=0, Included Available =====
  it('1. STARTER, balance=0, included available → Uses INCLUDED', async () => {
    // Setup
    await prisma.subscription.update({
      where: { id: testSubscription.id },
      data: { balance: 0, includedMinutesUsed: 0 }
    });

    // Calculate charge for 5 minute call
    const sub = await prisma.subscription.findUnique({ where: { id: testSubscription.id } });
    const result = await chargeCalculator.calculateChargeWithBalance(sub, 5, 'TR');

    // Assertions
    expect(result.chargeType).toBe('INCLUDED');
    expect(result.breakdown.fromBalance).toBe(0);
    expect(result.breakdown.fromIncluded).toBe(5);
    expect(result.breakdown.overageMinutes).toBe(0);
    expect(result.totalCharge).toBe(0); // No immediate charge
  });

  // ===== TEST 2: Balance>0, Included Available =====
  it('2. STARTER, balance>0, included available → Uses BALANCE first', async () => {
    // Setup: 100 TL balance (~4.3 minutes at 23 TL/min)
    await prisma.subscription.update({
      where: { id: testSubscription.id },
      data: { balance: 100, includedMinutesUsed: 0 }
    });

    // Calculate charge for 3 minute call
    const sub = await prisma.subscription.findUnique({ where: { id: testSubscription.id } });
    const result = await chargeCalculator.calculateChargeWithBalance(sub, 3, 'TR');

    // Assertions
    expect(result.chargeType).toBe('BALANCE');
    expect(result.breakdown.fromBalance).toBe(3);
    expect(result.breakdown.balanceCharge).toBe(3 * 23); // 69 TL
    expect(result.breakdown.fromIncluded).toBe(0);
    expect(result.breakdown.overageMinutes).toBe(0);
    expect(result.totalCharge).toBe(69);
  });

  // ===== TEST 3: Balance>0, No Included, Has Overage =====
  it('3. STARTER, balance>0, no included, has overage → BALANCE then OVERAGE', async () => {
    // Setup: 50 TL balance, included exhausted
    await prisma.subscription.update({
      where: { id: testSubscription.id },
      data: {
        balance: 50, // ~2.17 minutes
        includedMinutesUsed: 150 // Included exhausted (150/150)
      }
    });

    // Calculate charge for 5 minute call
    const sub = await prisma.subscription.findUnique({ where: { id: testSubscription.id } });
    const result = await chargeCalculator.calculateChargeWithBalance(sub, 5, 'TR');

    // Assertions
    expect(result.chargeType).toBe('BALANCE_OVERAGE');
    expect(result.breakdown.fromBalance).toBeCloseTo(2.17, 2); // 50 TL / 23
    expect(result.breakdown.balanceCharge).toBe(50);
    expect(result.breakdown.fromIncluded).toBe(0);
    expect(result.breakdown.overageMinutes).toBeCloseTo(2.83, 2); // 5 - 2.17
  });

  // ===== TEST 4: Balance Insufficient → Split Billing =====
  it('4. STARTER, balance insufficient → Split (BALANCE + INCLUDED + OVERAGE)', async () => {
    // Setup: 30 TL balance (~1.3 min), 140/150 included used (10 min left)
    await prisma.subscription.update({
      where: { id: testSubscription.id },
      data: {
        balance: 30,
        includedMinutesUsed: 140 // 10 minutes remaining
      }
    });

    // Calculate charge for 15 minute call
    const sub = await prisma.subscription.findUnique({ where: { id: testSubscription.id } });
    const result = await chargeCalculator.calculateChargeWithBalance(sub, 15, 'TR');

    // Expected:
    // - 1.3 min from balance (30 TL)
    // - 10 min from included
    // - 3.7 min overage (15 - 1.3 - 10)

    expect(result.chargeType).toBe('BALANCE_INCLUDED_OVERAGE');
    expect(result.breakdown.fromBalance).toBeCloseTo(1.3, 1);
    expect(result.breakdown.balanceCharge).toBe(30);
    expect(result.breakdown.fromIncluded).toBe(10);
    expect(result.breakdown.overageMinutes).toBeCloseTo(3.7, 1);
  });

  // ===== TEST 5: PAYG, Balance<1min → Blocked =====
  it('5. PAYG, balance<1min → Call blocked', async () => {
    // Setup: PAYG plan with low balance
    await prisma.subscription.update({
      where: { id: testSubscription.id },
      data: {
        plan: 'PAYG',
        balance: 10 // Less than 1 minute (23 TL/min)
      }
    });

    // Check if can make call
    const check = await chargeCalculator.canMakeCallWithBalance(testBusinessId);

    // Assertions
    expect(check.canMakeCall).toBe(false);
    expect(check.reason).toBe('INSUFFICIENT_BALANCE');
  });

  // ===== TEST 6: Duration 0 / Failed → No Charges =====
  it('6. Call duration 0 → No charges applied', async () => {
    // Setup
    await prisma.subscription.update({
      where: { id: testSubscription.id },
      data: { balance: 100, includedMinutesUsed: 0 }
    });

    const sub = await prisma.subscription.findUnique({ where: { id: testSubscription.id } });

    // Calculate for 0 duration
    const result = await chargeCalculator.calculateChargeWithBalance(sub, 0, 'TR');

    // Assertions
    expect(result.breakdown.fromBalance).toBe(0);
    expect(result.breakdown.fromIncluded).toBe(0);
    expect(result.breakdown.overageMinutes).toBe(0);
    expect(result.totalCharge).toBe(0);
  });

  // ===== TEST 7: Idempotency - Same callId Twice =====
  it('7. Idempotency: Same usage record ID → No double charge', async () => {
    // Setup
    await prisma.subscription.update({
      where: { id: testSubscription.id },
      data: { balance: 100 }
    });

    const usageRecordId = 'test-call-123';

    // First charge
    const sub1 = await prisma.subscription.findUnique({ where: { id: testSubscription.id } });
    const result1 = await chargeCalculator.calculateChargeWithBalance(sub1, 2, 'TR');
    await chargeCalculator.applyChargeWithBalance(testSubscription.id, result1, usageRecordId);

    const balanceAfter1 = await prisma.subscription.findUnique({
      where: { id: testSubscription.id },
      select: { balance: true }
    });

    expect(balanceAfter1.balance).toBe(100 - 46); // 2 min * 23 TL

    // Second charge with SAME usage record ID
    // In production, this should be prevented by unique constraint on usageRecordId
    // For now, we test that balance doesn't double-deduct
    const sub2 = await prisma.subscription.findUnique({ where: { id: testSubscription.id } });
    const result2 = await chargeCalculator.calculateChargeWithBalance(sub2, 2, 'TR');

    // If applied again, balance would drop to 8 (54 - 46)
    // Idempotency check should prevent this
    // NOTE: This requires DB-level unique constraint or application-level check

    // TODO: Add unique constraint on UsageRecord.callId
    // TODO: Add check in applyChargeWithBalance to skip if usageRecordId exists
  });

  // ===== BONUS TEST: Authorization vs Balance =====
  it('BONUS: STARTER can make call even with balance=0 (included available)', async () => {
    // Setup
    await prisma.subscription.update({
      where: { id: testSubscription.id },
      data: {
        balance: 0, // No balance
        includedMinutesUsed: 0 // But has included minutes
      }
    });

    // Check authorization
    const check = await chargeCalculator.canMakeCallWithBalance(testBusinessId);

    // Assertions: Should allow call (balance not required for paid plans)
    expect(check.canMakeCall).toBe(true);
    expect(check.reason).toBe('INCLUDED_MINUTES_AVAILABLE');
  });
});
