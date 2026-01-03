/**
 * Cron Jobs Service - YENİ FİYATLANDIRMA SİSTEMİ
 *
 * Scheduled tasks:
 * 1. resetIncludedMinutes: Her ay başında STARTER/PRO planlarının dahil dakikalarını sıfırla
 * 2. lowBalanceWarning: Düşük bakiye uyarısı gönder (SADECE PAYG için)
 * 3. autoReloadCheck: Otomatik yükleme kontrolü (SADECE PAYG için)
 * 4. trialExpiredCheck: Deneme süresi dolmuş kullanıcıları kontrol et
 * 5. billOverageUsage: POSTPAID aşım faturalandırması (ay sonu - paket planları için)
 */

import { PrismaClient } from '@prisma/client';
import { getFixedOveragePrice } from '../config/plans.js';

const prisma = new PrismaClient();

// Email service import (if available)
let emailService = null;
try {
  const module = await import('./emailService.js');
  emailService = module.default;
} catch (e) {
  console.log('📧 Email service not available for cron jobs');
}

/**
 * Reset included minutes for STARTER/PRO plans at the start of each billing period
 * Should be triggered by Stripe/iyzico webhook on subscription renewal
 * Or called manually via cron at month start
 */
export async function resetIncludedMinutes() {
  console.log('🔄 Starting monthly included minutes reset...');

  try {
    const now = new Date();

    // Find all active subscriptions that need reset
    // Check if currentPeriodEnd has passed and needs reset
    const subscriptionsToReset = await prisma.subscription.findMany({
      where: {
        status: 'active',
        plan: { in: ['STARTER', 'PRO', 'ENTERPRISE', 'BASIC', 'PROFESSIONAL'] },
        currentPeriodEnd: { lte: now },
        includedMinutesUsed: { gt: 0 }
      },
      include: {
        business: {
          select: { id: true, name: true }
        }
      }
    });

    console.log(`📊 Found ${subscriptionsToReset.length} subscriptions to reset`);

    let resetCount = 0;
    for (const subscription of subscriptionsToReset) {
      try {
        // Reset included minutes
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            includedMinutesUsed: 0,
            // Update period dates (this should normally be done by payment webhook)
            currentPeriodStart: now,
            currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // +30 days
            updatedAt: now
          }
        });

        resetCount++;
        console.log(`✅ Reset minutes for business: ${subscription.business?.name}`);
      } catch (err) {
        console.error(`❌ Failed to reset for subscription ${subscription.id}:`, err.message);
      }
    }

    console.log(`🔄 Monthly reset complete: ${resetCount}/${subscriptionsToReset.length} subscriptions reset`);
    return { success: true, resetCount, total: subscriptionsToReset.length };
  } catch (error) {
    console.error('❌ Monthly reset error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check for low balance and send warnings
 * Run every hour
 * NOT: Sadece PAYG planı için geçerli (prepaid model)
 * Paket planları postpaid aşım kullandığından bakiye kontrolü YAPILMAZ
 */
export async function checkLowBalance() {
  console.log('💰 Checking for low balance warnings (PAYG only)...');

  try {
    // SADECE PAYG kullanıcıları için düşük bakiye kontrolü (prepaid model)
    const lowBalanceSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'active',
        plan: 'PAYG', // Sadece PAYG
        balance: { lt: 100 }, // Less than 100 TL
        // Don't warn if already warned in last 24 hours
        OR: [
          { lowBalanceWarnedAt: null },
          { lowBalanceWarnedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
        ]
      },
      include: {
        business: {
          include: {
            users: {
              where: { role: 'OWNER' },
              select: { email: true, name: true }
            }
          }
        }
      }
    });

    console.log(`📊 Found ${lowBalanceSubscriptions.length} subscriptions with low balance`);

    let warnedCount = 0;
    for (const subscription of lowBalanceSubscriptions) {
      const ownerEmail = subscription.business?.users?.[0]?.email;

      if (ownerEmail && emailService) {
        try {
          // Send low balance email
          await emailService.sendLowBalanceWarning({
            to: ownerEmail,
            businessName: subscription.business.name,
            currentBalance: subscription.balance,
            plan: subscription.plan
          });

          // Update warned timestamp
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: { lowBalanceWarnedAt: new Date() }
          });

          warnedCount++;
          console.log(`📧 Low balance warning sent to: ${ownerEmail}`);
        } catch (err) {
          console.error(`❌ Failed to send warning to ${ownerEmail}:`, err.message);
        }
      }
    }

    console.log(`💰 Low balance check complete: ${warnedCount} warnings sent`);
    return { success: true, warnedCount, total: lowBalanceSubscriptions.length };
  } catch (error) {
    console.error('❌ Low balance check error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Process auto-reload for subscriptions that need it
 * Run every 15 minutes
 */
export async function processAutoReload() {
  console.log('🔄 Processing auto-reload...');

  try {
    // Find subscriptions with auto-reload enabled and balance below threshold
    const autoReloadSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'active',
        autoReloadEnabled: true,
        autoReloadThreshold: { gt: 0 },
        autoReloadAmount: { gt: 0 }
      },
      include: {
        business: {
          select: { id: true, name: true, stripeCustomerId: true }
        }
      }
    });

    // Filter those below threshold
    const needReload = autoReloadSubscriptions.filter(
      sub => sub.balance < sub.autoReloadThreshold
    );

    console.log(`📊 Found ${needReload.length} subscriptions needing auto-reload`);

    let reloadedCount = 0;
    for (const subscription of needReload) {
      try {
        // Check if has payment method
        if (!subscription.business?.stripeCustomerId) {
          console.log(`⚠️ No payment method for ${subscription.business?.name}, skipping`);
          continue;
        }

        // Import balance service dynamically
        const balanceService = (await import('./balanceService.js')).default;

        // Process reload
        const result = await balanceService.processAutoReload(subscription.id);

        if (result.success) {
          reloadedCount++;
          console.log(`✅ Auto-reloaded ${subscription.autoReloadAmount} TL for ${subscription.business?.name}`);
        } else {
          console.log(`⚠️ Auto-reload failed for ${subscription.business?.name}: ${result.error}`);
        }
      } catch (err) {
        console.error(`❌ Auto-reload error for ${subscription.id}:`, err.message);
      }
    }

    console.log(`🔄 Auto-reload complete: ${reloadedCount}/${needReload.length} processed`);
    return { success: true, reloadedCount, total: needReload.length };
  } catch (error) {
    console.error('❌ Auto-reload error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check for expired trials and send upgrade prompts
 * Run daily
 */
export async function checkTrialExpired() {
  console.log('⏰ Checking for expired trials...');

  try {
    const now = new Date();

    // Find TRIAL subscriptions where trial has expired
    const expiredTrials = await prisma.subscription.findMany({
      where: {
        status: 'active',
        plan: 'TRIAL',
        OR: [
          // Phone trial expired (15 minutes used)
          { trialMinutesUsed: { gte: 15 } },
          // Chat trial expired (7 days)
          { trialChatExpiry: { lte: now } }
        ]
      },
      include: {
        business: {
          include: {
            users: {
              where: { role: 'OWNER' },
              select: { email: true, name: true }
            }
          }
        }
      }
    });

    console.log(`📊 Found ${expiredTrials.length} expired trials`);

    let notifiedCount = 0;
    for (const subscription of expiredTrials) {
      const ownerEmail = subscription.business?.users?.[0]?.email;

      // Mark trial as expired if not already
      if (subscription.status === 'active') {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            trialUsed: true,
            status: 'trial_expired',
            updatedAt: now
          }
        });
      }

      // Send email notification
      if (ownerEmail && emailService) {
        try {
          await emailService.sendTrialExpiredNotification({
            to: ownerEmail,
            businessName: subscription.business.name,
            phoneMinutesUsed: subscription.trialMinutesUsed || 0
          });

          notifiedCount++;
          console.log(`📧 Trial expired notification sent to: ${ownerEmail}`);
        } catch (err) {
          console.error(`❌ Failed to send notification to ${ownerEmail}:`, err.message);
        }
      }
    }

    console.log(`⏰ Trial check complete: ${notifiedCount} notifications sent`);
    return { success: true, notifiedCount, total: expiredTrials.length };
  } catch (error) {
    console.error('❌ Trial check error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Clean up old usage records (older than 1 year)
 * Run weekly
 */
export async function cleanupOldRecords() {
  console.log('🧹 Cleaning up old usage records...');

  try {
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

    // Delete old usage records
    const deletedUsage = await prisma.usageRecord.deleteMany({
      where: {
        createdAt: { lt: oneYearAgo }
      }
    });

    // Delete old balance transactions
    const deletedTransactions = await prisma.balanceTransaction.deleteMany({
      where: {
        createdAt: { lt: oneYearAgo }
      }
    });

    console.log(`🧹 Cleanup complete: ${deletedUsage.count} usage records, ${deletedTransactions.count} transactions deleted`);
    return {
      success: true,
      deletedUsage: deletedUsage.count,
      deletedTransactions: deletedTransactions.count
    };
  } catch (error) {
    console.error('❌ Cleanup error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Bill overage usage for POSTPAID plans
 * Run at the end of each billing period (triggered by Stripe webhook or cron)
 * Paket planları için aşım faturalandırması
 */
export async function billOverageUsage() {
  console.log('💳 Processing postpaid overage billing...');

  try {
    const now = new Date();

    // Find subscriptions with overage that need billing
    // These are STARTER/PRO/ENTERPRISE plans whose billing period has ended
    const subscriptionsWithOverage = await prisma.subscription.findMany({
      where: {
        status: 'active',
        plan: { in: ['STARTER', 'PRO', 'ENTERPRISE', 'BASIC', 'PROFESSIONAL'] },
        overageMinutes: { gt: 0 },
        currentPeriodEnd: { lte: now },
        // Don't bill if already billed for this period
        OR: [
          { overageBilledAt: null },
          { overageBilledAt: { lt: prisma.subscription.fields.currentPeriodStart } }
        ]
      },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            country: true,
            stripeCustomerId: true,
            users: {
              where: { role: 'OWNER' },
              select: { email: true, name: true }
            }
          }
        }
      }
    });

    console.log(`📊 Found ${subscriptionsWithOverage.length} subscriptions with overage to bill`);

    let billedCount = 0;
    let totalAmount = 0;

    for (const subscription of subscriptionsWithOverage) {
      try {
        const country = subscription.business?.country || 'TR';
        const overageRate = getFixedOveragePrice(country);
        const overageAmount = subscription.overageMinutes * overageRate;

        console.log(`📊 Billing ${subscription.business?.name}: ${subscription.overageMinutes} dk × ${overageRate} = ${overageAmount} TL`);

        // Check if has payment method (Stripe customer) and create invoice
        let stripeInvoiceResult = null;
        if (subscription.business?.stripeCustomerId) {
          try {
            const stripeService = (await import('./stripe.js')).default;
            const currency = country === 'TR' ? 'TRY' : country === 'BR' ? 'BRL' : 'USD';

            stripeInvoiceResult = await stripeService.createOverageInvoice({
              customerId: subscription.business.stripeCustomerId,
              overageMinutes: subscription.overageMinutes,
              overageRate,
              totalAmount: overageAmount,
              currency,
              countryCode: country,
              businessName: subscription.business.name,
              periodStart: subscription.currentPeriodStart,
              periodEnd: subscription.currentPeriodEnd
            });

            console.log(`💳 Stripe invoice created: ${stripeInvoiceResult.invoiceId} for ${subscription.business?.name}`);
          } catch (stripeErr) {
            console.error(`❌ Stripe invoice creation failed for ${subscription.business?.name}:`, stripeErr.message);
            // Continue with database recording even if Stripe fails
          }
        } else {
          console.log(`⚠️ No Stripe customer for ${subscription.business?.name}, skipping invoice creation`);
        }

        // Record the billing in database
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            overageBilledAt: now,
            overageMinutes: 0, // Reset for next period
            updatedAt: now
          }
        });

        // Create a balance transaction record for tracking
        await prisma.balanceTransaction.create({
          data: {
            subscriptionId: subscription.id,
            type: 'OVERAGE_BILL',
            amount: -overageAmount, // Negative = charge
            description: `Aşım faturası: ${subscription.overageMinutes} dk (${overageAmount} TL)`,
            metadata: {
              overageMinutes: subscription.overageMinutes,
              overageRate,
              periodStart: subscription.currentPeriodStart,
              periodEnd: subscription.currentPeriodEnd,
              stripeInvoiceId: stripeInvoiceResult?.invoiceId || null,
              stripeInvoiceStatus: stripeInvoiceResult?.status || null
            }
          }
        });

        // Send email notification
        const ownerEmail = subscription.business?.users?.[0]?.email;
        if (ownerEmail && emailService) {
          try {
            await emailService.sendOverageBillNotification({
              to: ownerEmail,
              businessName: subscription.business.name,
              overageMinutes: subscription.overageMinutes,
              overageAmount,
              overageRate,
              periodEnd: subscription.currentPeriodEnd
            });
            console.log(`📧 Overage bill notification sent to: ${ownerEmail}`);
          } catch (emailErr) {
            console.error(`❌ Failed to send overage email to ${ownerEmail}:`, emailErr.message);
          }
        }

        billedCount++;
        totalAmount += overageAmount;
        console.log(`✅ Overage billed for ${subscription.business?.name}: ${overageAmount} TL`);

      } catch (err) {
        console.error(`❌ Failed to bill overage for subscription ${subscription.id}:`, err.message);
      }
    }

    console.log(`💳 Overage billing complete: ${billedCount}/${subscriptionsWithOverage.length} billed, total: ${totalAmount} TL`);
    return {
      success: true,
      billedCount,
      total: subscriptionsWithOverage.length,
      totalAmount
    };
  } catch (error) {
    console.error('❌ Overage billing error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Run all cron jobs - can be called by a scheduler or manually
 */
export async function runAllJobs() {
  console.log('🕐 Running all cron jobs...');

  const results = {
    resetIncludedMinutes: await resetIncludedMinutes(),
    checkLowBalance: await checkLowBalance(),
    processAutoReload: await processAutoReload(),
    checkTrialExpired: await checkTrialExpired(),
    billOverageUsage: await billOverageUsage()
  };

  console.log('🕐 All cron jobs complete:', results);
  return results;
}

export default {
  resetIncludedMinutes,
  checkLowBalance,
  processAutoReload,
  checkTrialExpired,
  cleanupOldRecords,
  billOverageUsage,
  runAllJobs
};
