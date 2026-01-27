/**
 * Backfill Chat Rate Limiting Fields
 *
 * Sets proper default values for existing subscriptions:
 * - chatTokensLimit based on plan
 * - chatTokensResetAt = currentPeriodEnd (or +30 days for non-subscription)
 * - chatTokensUsed = 0 (fresh start)
 * - chatDailyMessageDate = null
 * - chatDailyMessageCount = 0
 *
 * Run AFTER schema migration, BEFORE enabling feature flag
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Plan-based token limits (matching chatRateLimiter.js)
const TOKEN_LIMITS = {
  FREE: 0,              // No chat allowed
  TRIAL: 100_000,       // 100k tokens/month
  PAYG: 1_000_000,      // 1M tokens/month
  STARTER: 2_000_000,   // 2M tokens/month
  PRO: 5_000_000,       // 5M tokens/month
  ENTERPRISE: 10_000_000 // 10M tokens/month (can be customized per business)
};

async function backfillChatLimits() {
  console.log('🔄 Starting chat limits backfill...\n');

  try {
    // Get all subscriptions
    const subscriptions = await prisma.subscription.findMany({
      include: {
        business: {
          select: { id: true, name: true }
        }
      }
    });

    console.log(`📊 Found ${subscriptions.length} subscriptions to update\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const sub of subscriptions) {
      try {
        const plan = sub.plan || 'FREE';

        // Get token limit for plan
        const tokenLimit = TOKEN_LIMITS[plan] || TOKEN_LIMITS.PAYG;

        // Determine reset date
        let resetAt = sub.currentPeriodEnd;

        // If no period end (PAYG/FREE/TRIAL without subscription), use +30 days
        if (!resetAt) {
          const now = new Date();
          resetAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        }

        // Update subscription
        await prisma.subscription.update({
          where: { id: sub.id },
          data: {
            chatTokensLimit: tokenLimit,
            chatTokensUsed: 0,
            chatTokensResetAt: resetAt,
            chatDailyMessageDate: null,
            chatDailyMessageCount: 0
          }
        });

        successCount++;
        console.log(`✅ ${sub.business?.name || 'Unknown'} (${plan}): ${tokenLimit.toLocaleString()} tokens/month, resets ${resetAt.toISOString().split('T')[0]}`);
      } catch (err) {
        errorCount++;
        console.error(`❌ Failed to update subscription ${sub.id}:`, err.message);
      }
    }

    console.log(`\n🎉 Backfill complete: ${successCount} success, ${errorCount} errors`);

    // Summary by plan
    const summary = await prisma.subscription.groupBy({
      by: ['plan'],
      _count: { plan: true }
    });

    console.log('\n📊 Summary by plan:');
    for (const row of summary) {
      const limit = TOKEN_LIMITS[row.plan] || TOKEN_LIMITS.PAYG;
      console.log(`   ${row.plan}: ${row._count.plan} subscriptions → ${limit.toLocaleString()} tokens/month`);
    }

  } catch (error) {
    console.error('\n❌ Backfill error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  backfillChatLimits()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

export default backfillChatLimits;
