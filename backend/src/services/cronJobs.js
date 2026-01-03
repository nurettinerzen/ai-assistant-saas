/**
 * Cron Jobs Service - YENİ FİYATLANDIRMA SİSTEMİ
 *
 * Scheduled tasks:
 * 1. resetIncludedMinutes: Her ay başında STARTER/PRO planlarının dahil dakikalarını sıfırla
 * 2. lowBalanceWarning: Düşük bakiye uyarısı gönder
 * 3. autoReloadCheck: Otomatik yükleme kontrolü
 * 4. trialExpiredCheck: Deneme süresi dolmuş kullanıcıları kontrol et
 */

import { PrismaClient } from '@prisma/client';
import { getPlanDetails } from '../config/plans.js';

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
 */
export async function checkLowBalance() {
  console.log('💰 Checking for low balance warnings...');

  try {
    // Find PAYG and paid plan users with low balance
    const lowBalanceSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'active',
        plan: { in: ['PAYG', 'STARTER', 'PRO', 'ENTERPRISE', 'BASIC', 'PROFESSIONAL'] },
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
 * Run all cron jobs - can be called by a scheduler or manually
 */
export async function runAllJobs() {
  console.log('🕐 Running all cron jobs...');

  const results = {
    resetIncludedMinutes: await resetIncludedMinutes(),
    checkLowBalance: await checkLowBalance(),
    processAutoReload: await processAutoReload(),
    checkTrialExpired: await checkTrialExpired()
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
  runAllJobs
};
