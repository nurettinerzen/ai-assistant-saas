/**
 * Cleanup Test Assistants
 *
 * Identifies and removes unused/test assistants to keep the database clean.
 *
 * Strategy per business:
 *   - KEEP: Active (isActive=true) assistants with real usage (chats > 0 or phones > 0)
 *   - KEEP: The most recently active assistant (fallback if none have usage)
 *   - DELETE: Everything else (inactive, empty, test-named)
 *
 * Usage:
 *   node scripts/cleanup-test-assistants.js              # Dry run (list only)
 *   node scripts/cleanup-test-assistants.js --delete      # Actually delete
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const shouldDelete = args.includes('--delete');

async function main() {
  console.log('🔍 Scanning all assistants...\n');

  // Get all assistants with usage counts
  const assistants = await prisma.assistant.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      businessId: true,
      isActive: true,
      createdAt: true,
      customNotes: true,
      _count: {
        select: {
          chatLogs: true,
          phoneNumbers: true,
          batchCalls: true,
        }
      }
    }
  });

  console.log(`📊 Total assistants in database: ${assistants.length}\n`);

  // Group by business
  const byBusiness = {};
  for (const a of assistants) {
    if (!byBusiness[a.businessId]) byBusiness[a.businessId] = [];
    byBusiness[a.businessId].push(a);
  }

  const toDelete = [];
  const toKeep = [];

  for (const [businessId, list] of Object.entries(byBusiness)) {
    console.log(`\n📁 Business ${businessId} (${list.length} assistants):`);

    // Categorize assistants
    const withUsage = list.filter(a => a._count.chatLogs > 0 || a._count.phoneNumbers > 0);
    const activeOnes = list.filter(a => a.isActive);

    // Decide which to keep per business
    const keepSet = new Set();

    // 1. Always keep active assistants with real usage
    for (const a of withUsage) {
      if (a.isActive) keepSet.add(a.id);
    }

    // 2. If no active+used assistant, keep the last active one
    if (keepSet.size === 0 && activeOnes.length > 0) {
      keepSet.add(activeOnes[activeOnes.length - 1].id);
    }

    // 3. If no active at all, keep the last one as fallback
    if (keepSet.size === 0 && list.length > 0) {
      keepSet.add(list[list.length - 1].id);
    }

    // Print and categorize
    for (const a of list) {
      const chatCount = a._count.chatLogs;
      const phoneCount = a._count.phoneNumbers;
      const batchCount = a._count.batchCalls;
      const statusIcon = a.isActive ? '🟢' : '⚪';
      const isTestNamed = a.name?.toLowerCase().includes('test') ||
                          a.customNotes?.toLowerCase().includes('test assistant');

      const keep = keepSet.has(a.id);
      const action = keep ? '✅ KEEP  ' : '🗑️  DELETE';
      const testTag = isTestNamed ? ' [TEST]' : '';

      console.log(`  ${statusIcon} ${action} | ${a.name}${testTag} (${a.id.slice(-8)}) | ${a.createdAt.toISOString().split('T')[0]} | Chats: ${chatCount}, Phones: ${phoneCount}, Batches: ${batchCount}`);

      if (keep) toKeep.push(a);
      else toDelete.push(a);
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`📊 Summary:`);
  console.log(`   Keep:   ${toKeep.length} assistants`);
  console.log(`   Delete: ${toDelete.length} assistants`);
  console.log(`${'='.repeat(70)}\n`);

  if (toDelete.length === 0) {
    console.log('✅ No assistants to clean up!');
    return;
  }

  if (!shouldDelete) {
    console.log('⚠️  DRY RUN - No changes made.');
    console.log('   Run with --delete flag to actually delete:');
    console.log('   node scripts/cleanup-test-assistants.js --delete\n');
    return;
  }

  // Actually delete
  console.log('🗑️  Deleting unused assistants...\n');

  let deleted = 0;
  let failed = 0;

  for (const a of toDelete) {
    try {
      // Delete dependent records first (foreign key order)
      const chatDeleted = await prisma.chatLog.deleteMany({ where: { assistantId: a.id } });
      const cbDeleted = await prisma.callbackRequest.deleteMany({ where: { assistantId: a.id } });
      const batchDeleted = await prisma.batchCall.deleteMany({ where: { assistantId: a.id } });

      // Delete the assistant
      await prisma.assistant.delete({ where: { id: a.id } });

      deleted++;
      console.log(`  ✅ Deleted: ${a.name} (${a.id.slice(-8)}) [${chatDeleted.count} chats, ${cbDeleted.count} callbacks, ${batchDeleted.count} batches]`);
    } catch (error) {
      failed++;
      console.error(`  ❌ Failed: ${a.name} (${a.id.slice(-8)}): ${error.message}`);
    }
  }

  console.log(`\n✅ Cleanup complete: ${deleted} deleted, ${failed} failed`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
