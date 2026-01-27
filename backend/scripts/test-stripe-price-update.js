/**
 * Test P2: Stripe Enterprise Price Update
 *
 * Tests automatic Stripe subscription item update when enterprise price changes
 *
 * PREREQUISITES:
 * - Requires a subscription with active stripeSubscriptionId
 * - Requires STRIPE_SECRET_KEY in .env
 *
 * Test scenarios:
 * 1. Price change with proration disabled (default)
 * 2. Verify subscription item updated
 * 3. Verify old price archived
 * 4. Verify audit log contains Stripe metadata
 */

import { PrismaClient } from '@prisma/client';
import { updateEnterpriseStripePrice, hasActiveStripeSubscription } from '../src/services/stripeEnterpriseService.js';
import Stripe from 'stripe';

const prisma = new PrismaClient();
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

async function testStripePriceUpdate() {
  console.log('\n🧪 Testing P2: Stripe Enterprise Price Update\n');

  if (!stripe) {
    console.log('❌ STRIPE_SECRET_KEY not configured - skipping test');
    return;
  }

  try {
    // Find a subscription with active Stripe subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        AND: [
          { stripeSubscriptionId: { not: null } },
          { stripePriceId: { not: null } },
          { plan: 'ENTERPRISE' }
        ]
      },
      include: { business: true }
    });

    if (!subscription) {
      console.log('⚠️  No enterprise subscription with active Stripe subscription found');
      console.log('   Please create one via admin panel first');
      console.log('   Steps:');
      console.log('   1. Create enterprise customer via POST /api/admin/enterprise-customers');
      console.log('   2. Generate payment link via POST /api/admin/enterprise-customers/:id/payment-link');
      console.log('   3. Complete payment (or use Stripe test mode)');
      return;
    }

    console.log(`✅ Found enterprise subscription: ${subscription.id}`);
    console.log(`   Business: ${subscription.business?.name || subscription.businessId}`);
    console.log(`   Current price: ${subscription.enterprisePrice} TRY`);
    console.log(`   Stripe subscription: ${subscription.stripeSubscriptionId}`);
    console.log(`   Stripe price: ${subscription.stripePriceId}\n`);

    // Check if has active Stripe subscription
    const hasActive = hasActiveStripeSubscription(subscription);
    console.log(`Has active Stripe subscription: ${hasActive ? '✅ Yes' : '❌ No'}\n`);

    if (!hasActive) {
      console.log('❌ Subscription does not have active Stripe subscription');
      return;
    }

    // Retrieve current Stripe subscription
    console.log('📊 STEP 1: Retrieve current Stripe subscription\n');
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.stripeSubscriptionId
    );

    console.log(`Stripe subscription status: ${stripeSubscription.status}`);
    console.log(`Current price ID: ${stripeSubscription.items.data[0]?.price.id}`);
    console.log(`Current amount: ${stripeSubscription.items.data[0]?.price.unit_amount / 100} TRY\n`);

    // Simulate price change
    const oldPrice = subscription.enterprisePrice;
    const newPrice = oldPrice + 500; // Increase by 500 TRY

    console.log('📊 STEP 2: Update enterprise price (DB + Stripe)\n');
    console.log(`Price change: ${oldPrice} TRY → ${newPrice} TRY`);

    const updateResult = await updateEnterpriseStripePrice(
      subscription,
      newPrice,
      {
        applyProration: false, // Default: no proration
        effectiveAt: 'next_period' // Default: next invoice
      }
    );

    console.log('\n🔍 Update result:');
    console.log(JSON.stringify(updateResult, null, 2));

    if (!updateResult.success) {
      console.log(`\n❌ FAIL: Stripe update failed - ${updateResult.reason}: ${updateResult.message}`);
      return;
    }

    console.log(`\n✅ PASS: Stripe subscription updated successfully`);
    console.log(`   Old price: ${updateResult.oldPriceId} (${updateResult.oldAmount} TRY)`);
    console.log(`   New price: ${updateResult.newPriceId} (${updateResult.newAmount} TRY)`);
    console.log(`   Proration: ${updateResult.proration ? 'Enabled' : 'Disabled'}`);
    console.log(`   Effective: ${updateResult.effectiveAt}`);

    // Verify subscription item updated
    console.log('\n📊 STEP 3: Verify Stripe subscription item updated\n');
    const updatedStripeSubscription = await stripe.subscriptions.retrieve(
      subscription.stripeSubscriptionId
    );

    const currentPriceId = updatedStripeSubscription.items.data[0]?.price.id;
    const currentAmount = updatedStripeSubscription.items.data[0]?.price.unit_amount / 100;

    console.log(`Current price ID: ${currentPriceId}`);
    console.log(`Current amount: ${currentAmount} TRY`);

    if (currentPriceId === updateResult.newPriceId && currentAmount === newPrice) {
      console.log('✅ PASS: Subscription item updated correctly');
    } else {
      console.log(`❌ FAIL: Subscription item not updated`);
      console.log(`   Expected: ${updateResult.newPriceId} @ ${newPrice} TRY`);
      console.log(`   Got: ${currentPriceId} @ ${currentAmount} TRY`);
    }

    // Verify old price archived
    console.log('\n📊 STEP 4: Verify old price archived\n');
    try {
      const oldPriceObj = await stripe.prices.retrieve(updateResult.oldPriceId);
      console.log(`Old price status: ${oldPriceObj.active ? '🟢 Active' : '⚪ Inactive'}`);

      if (!oldPriceObj.active) {
        console.log('✅ PASS: Old price archived (inactive)');
      } else {
        console.log('⚠️  WARNING: Old price still active (should be archived)');
      }
    } catch (error) {
      console.log(`❌ Could not retrieve old price: ${error.message}`);
    }

    // Verify next invoice amount
    console.log('\n📊 STEP 5: Verify upcoming invoice\n');
    try {
      const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
        subscription: subscription.stripeSubscriptionId
      });

      const invoiceAmount = upcomingInvoice.amount_due / 100;
      console.log(`Next invoice amount: ${invoiceAmount} TRY`);
      console.log(`Next invoice date: ${new Date(upcomingInvoice.period_end * 1000).toISOString()}`);

      // If proration disabled, amount should match new price
      if (!updateResult.proration) {
        if (Math.abs(invoiceAmount - newPrice) < 1) { // Allow 1 TRY difference for rounding
          console.log('✅ PASS: No proration applied (amount matches new price)');
        } else {
          console.log(`⚠️  WARNING: Amount mismatch - expected ${newPrice}, got ${invoiceAmount}`);
        }
      }
    } catch (error) {
      console.log(`⚠️  Could not retrieve upcoming invoice: ${error.message}`);
    }

    // Verify DB updated
    console.log('\n📊 STEP 6: Verify database updated\n');
    const updatedSubscription = await prisma.subscription.findUnique({
      where: { id: subscription.id }
    });

    console.log(`DB stripePriceId: ${updatedSubscription.stripePriceId}`);
    if (updatedSubscription.stripePriceId === updateResult.newPriceId) {
      console.log('✅ PASS: Database updated with new price ID');
    } else {
      console.log(`❌ FAIL: Database not updated`);
    }

    // Check audit log
    console.log('\n📊 STEP 7: Check audit log for Stripe metadata\n');
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entityType: 'Subscription',
        entityId: subscription.id.toString()
      },
      orderBy: { createdAt: 'desc' },
      take: 1
    });

    if (auditLogs.length > 0) {
      const log = auditLogs[0];
      const stripeMetadata = log.metadata?.stripeUpdate;

      if (stripeMetadata) {
        console.log('✅ PASS: Audit log contains Stripe update metadata');
        console.log('\nStripe metadata in audit log:');
        console.log(JSON.stringify(stripeMetadata, null, 2));
      } else {
        console.log('⚠️  WARNING: Audit log missing Stripe update metadata');
      }
    } else {
      console.log('⚠️  No recent audit logs found');
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Stripe subscription item updated: ${currentPriceId === updateResult.newPriceId}`);
    console.log(`✅ Old price archived: Check manually`);
    console.log(`✅ Database updated: ${updatedSubscription.stripePriceId === updateResult.newPriceId}`);
    console.log(`✅ No proration applied: ${!updateResult.proration}`);
    console.log(`✅ Effective at next period: ${updateResult.effectiveAt === 'next_period'}`);
    console.log('='.repeat(60));

    console.log('\n⚠️  IMPORTANT: This is a TEST. To revert:');
    console.log(`   - Manually update subscription ${subscription.id} back to ${oldPrice} TRY`);
    console.log(`   - Or let it proceed to next billing cycle`);

  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testStripePriceUpdate();
