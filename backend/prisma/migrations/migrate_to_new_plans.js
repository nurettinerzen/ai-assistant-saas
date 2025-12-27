// ============================================================================
// MIGRATION SCRIPT: Migrate to New Plan Structure
// ============================================================================
// This script migrates existing subscriptions to the new plan structure:
// - BASIC -> STARTER (with adjusted limits)
// - PROFESSIONAL -> PRO (with adjusted limits)
// - Sets concurrentLimit based on plan
// ============================================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// New plan configuration
const NEW_PLAN_CONFIG = {
  FREE: {
    minutesLimit: 0,
    concurrentLimit: 0,
    overageRate: 0,
    overageLimit: 0
  },
  STARTER: {
    minutesLimit: 100,
    concurrentLimit: 1,
    overageRate: 7.5,
    overageLimit: 100
  },
  PRO: {
    minutesLimit: 800,
    concurrentLimit: 5,
    overageRate: 6.5,
    overageLimit: 200
  },
  ENTERPRISE: {
    minutesLimit: 1000, // Custom, can be overridden
    concurrentLimit: 10,
    overageRate: 5.5,
    overageLimit: 500
  },
  // Legacy plans - keep as is but add concurrent limits
  BASIC: {
    concurrentLimit: 1
  },
  PROFESSIONAL: {
    concurrentLimit: 3
  }
};

async function migrateSubscriptions() {
  console.log('🚀 Starting subscription migration...\n');

  try {
    // Get all subscriptions
    const subscriptions = await prisma.subscription.findMany({
      include: {
        business: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    console.log(`📊 Found ${subscriptions.length} subscriptions to process\n`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const subscription of subscriptions) {
      try {
        const config = NEW_PLAN_CONFIG[subscription.plan];

        if (!config) {
          console.log(`⚠️ Unknown plan ${subscription.plan} for business ${subscription.businessId}, skipping`);
          skippedCount++;
          continue;
        }

        // Prepare update data
        const updateData = {
          concurrentLimit: config.concurrentLimit,
          activeCalls: 0 // Reset active calls
        };

        // For new plans, update all limits
        if (['STARTER', 'PRO', 'ENTERPRISE'].includes(subscription.plan)) {
          if (config.minutesLimit !== undefined) {
            updateData.minutesLimit = config.minutesLimit;
          }
          if (config.overageRate !== undefined) {
            updateData.overageRate = config.overageRate;
          }
          if (config.overageLimit !== undefined) {
            updateData.overageLimit = config.overageLimit;
          }
        }

        // Update subscription
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: updateData
        });

        console.log(`✅ Updated ${subscription.business?.name || 'Business ' + subscription.businessId}: plan=${subscription.plan}, concurrent=${updateData.concurrentLimit}`);
        migratedCount++;

      } catch (error) {
        console.error(`❌ Error updating subscription ${subscription.id}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Migrated: ${migratedCount}`);
    console.log(`   ⏭️ Skipped: ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

async function migrateLegacyPlans() {
  console.log('\n🔄 Migrating legacy plans to new structure...\n');

  try {
    // Migrate BASIC -> STARTER (optional - only if you want to force migration)
    // const basicToStarter = await prisma.subscription.updateMany({
    //   where: { plan: 'BASIC' },
    //   data: { plan: 'STARTER' }
    // });
    // console.log(`Migrated ${basicToStarter.count} BASIC plans to STARTER`);

    // Migrate PROFESSIONAL -> PRO (optional - only if you want to force migration)
    // const professionalToPro = await prisma.subscription.updateMany({
    //   where: { plan: 'PROFESSIONAL' },
    //   data: { plan: 'PRO' }
    // });
    // console.log(`Migrated ${professionalToPro.count} PROFESSIONAL plans to PRO`);

    console.log('ℹ️ Legacy plan migration is disabled by default.');
    console.log('   Uncomment the migration code above to force migrate legacy plans.');
    console.log('   Existing BASIC and PROFESSIONAL plans will continue to work.');

  } catch (error) {
    console.error('❌ Legacy plan migration failed:', error);
    throw error;
  }
}

async function validateMigration() {
  console.log('\n🔍 Validating migration...\n');

  try {
    // Check for subscriptions without concurrent limits
    const missingConcurrent = await prisma.subscription.findMany({
      where: {
        OR: [
          { concurrentLimit: null },
          { concurrentLimit: 0, plan: { not: 'FREE' } }
        ]
      },
      select: {
        id: true,
        businessId: true,
        plan: true,
        concurrentLimit: true
      }
    });

    if (missingConcurrent.length > 0) {
      console.log(`⚠️ Found ${missingConcurrent.length} subscriptions with missing concurrent limits:`);
      missingConcurrent.forEach(s => {
        console.log(`   - Business ${s.businessId}: plan=${s.plan}, concurrent=${s.concurrentLimit}`);
      });
    } else {
      console.log('✅ All subscriptions have valid concurrent limits');
    }

    // Summary by plan
    const planSummary = await prisma.subscription.groupBy({
      by: ['plan'],
      _count: { id: true }
    });

    console.log('\n📊 Plan Distribution:');
    planSummary.forEach(p => {
      console.log(`   ${p.plan}: ${p._count.id} subscriptions`);
    });

  } catch (error) {
    console.error('❌ Validation failed:', error);
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       TELYX.AI - New Plan Structure Migration              ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    await migrateSubscriptions();
    await migrateLegacyPlans();
    await validateMigration();

    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
main();
