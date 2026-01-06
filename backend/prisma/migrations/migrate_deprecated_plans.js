/**
 * Migration Script: Deprecated Plan Migration
 *
 * Bu script, deprecated planları yeni planlara migrate eder:
 * - BASIC → STARTER
 * - PROFESSIONAL → PRO
 *
 * Kullanım:
 *   node backend/prisma/migrations/migrate_deprecated_plans.js
 *
 * NOT: Bu script'i çalıştırmadan önce:
 * 1. Database backup alın
 * 2. Production'da dikkatli olun
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkCurrentPlanUsage() {
  console.log('\n📊 Mevcut Plan Kullanımı:\n');

  // Her plan için kullanıcı sayısı
  const planCounts = await prisma.subscription.groupBy({
    by: ['plan'],
    _count: { plan: true }
  });

  planCounts.forEach(({ plan, _count }) => {
    const icon = plan === 'BASIC' || plan === 'PROFESSIONAL' ? '⚠️' : '✅';
    console.log(`  ${icon} ${plan}: ${_count.plan} subscription`);
  });

  return planCounts;
}

async function migrateDeprecatedPlans(dryRun = true) {
  console.log('\n🔄 Deprecated Plan Migration\n');
  console.log(`  Mode: ${dryRun ? 'DRY RUN (test)' : 'LIVE'}\n`);

  // BASIC → STARTER
  const basicSubscriptions = await prisma.subscription.findMany({
    where: { plan: 'BASIC' },
    include: { business: { select: { name: true } } }
  });

  console.log(`\n  📦 BASIC → STARTER: ${basicSubscriptions.length} subscription(s)`);

  if (!dryRun && basicSubscriptions.length > 0) {
    await prisma.subscription.updateMany({
      where: { plan: 'BASIC' },
      data: { plan: 'STARTER' }
    });
    console.log('    ✅ Migrated!');
  } else if (basicSubscriptions.length > 0) {
    basicSubscriptions.forEach(sub => {
      console.log(`    - Business: ${sub.business?.name || sub.businessId}`);
    });
  }

  // PROFESSIONAL → PRO
  const professionalSubscriptions = await prisma.subscription.findMany({
    where: { plan: 'PROFESSIONAL' },
    include: { business: { select: { name: true } } }
  });

  console.log(`\n  📦 PROFESSIONAL → PRO: ${professionalSubscriptions.length} subscription(s)`);

  if (!dryRun && professionalSubscriptions.length > 0) {
    await prisma.subscription.updateMany({
      where: { plan: 'PROFESSIONAL' },
      data: { plan: 'PRO' }
    });
    console.log('    ✅ Migrated!');
  } else if (professionalSubscriptions.length > 0) {
    professionalSubscriptions.forEach(sub => {
      console.log(`    - Business: ${sub.business?.name || sub.businessId}`);
    });
  }

  console.log('\n');
}

async function main() {
  try {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('              DEPRECATED PLAN MIGRATION TOOL                 ');
    console.log('═══════════════════════════════════════════════════════════');

    // Önce mevcut durumu göster
    await checkCurrentPlanUsage();

    // Dry run - sadece göster, değiştirme
    await migrateDeprecatedPlans(true);

    // Gerçek migration için:
    // await migrateDeprecatedPlans(false);

    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('  ℹ️  Bu DRY RUN modunda çalıştı.');
    console.log('');
    console.log('  Gerçek migration için:');
    console.log('  1. Bu dosyayı açın');
    console.log('  2. migrateDeprecatedPlans(false) satırının yorumunu kaldırın');
    console.log('  3. Script\'i tekrar çalıştırın');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');

  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
