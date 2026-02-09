/**
 * Cleanup Orphaned ElevenLabs Agents
 *
 * Finds agents that exist in ElevenLabs but NOT in our database,
 * and deletes them from ElevenLabs.
 *
 * This handles the case where cleanup-test-assistants.js deleted
 * assistants from the DB without calling the ElevenLabs API.
 *
 * Usage:
 *   node scripts/cleanup-elevenlabs-orphans.js              # Dry run (list only)
 *   node scripts/cleanup-elevenlabs-orphans.js --delete      # Actually delete from 11Labs
 */

import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const prisma = new PrismaClient();

const elevenLabsClient = axios.create({
  baseURL: 'https://api.elevenlabs.io/v1',
  headers: {
    'xi-api-key': process.env.ELEVENLABS_API_KEY,
    'Content-Type': 'application/json'
  }
});

const args = process.argv.slice(2);
const shouldDelete = args.includes('--delete');

async function main() {
  console.log('🔍 Fetching all agents from ElevenLabs API...\n');

  // Step 1: Get all agents from ElevenLabs
  let elevenLabsAgents;
  try {
    const response = await elevenLabsClient.get('/convai/agents');
    elevenLabsAgents = response.data.agents || response.data || [];
  } catch (error) {
    console.error('❌ Failed to fetch agents from ElevenLabs:', error.response?.data || error.message);
    process.exit(1);
  }

  console.log(`📊 Total agents in ElevenLabs: ${elevenLabsAgents.length}\n`);

  // Step 2: Get all elevenLabsAgentIds from our database
  const dbAssistants = await prisma.assistant.findMany({
    select: { elevenLabsAgentId: true, name: true, isActive: true }
  });

  const dbAgentIds = new Set(
    dbAssistants
      .filter(a => a.elevenLabsAgentId)
      .map(a => a.elevenLabsAgentId)
  );

  console.log(`📊 Total agents tracked in database: ${dbAgentIds.size}\n`);

  // Step 3: Find orphans (in ElevenLabs but not in DB)
  const orphans = [];
  const tracked = [];

  for (const agent of elevenLabsAgents) {
    const agentId = agent.agent_id;
    const agentName = agent.name || 'Unnamed';
    const createdAt = agent.created_at || 'Unknown';

    if (dbAgentIds.has(agentId)) {
      tracked.push({ agentId, name: agentName, createdAt });
    } else {
      orphans.push({ agentId, name: agentName, createdAt });
    }
  }

  // Print tracked agents
  console.log(`\n✅ Tracked agents (in both 11Labs + DB): ${tracked.length}`);
  for (const a of tracked) {
    console.log(`  🟢 ${a.name} (${a.agentId.slice(0, 12)}...) | ${a.createdAt}`);
  }

  // Print orphans
  console.log(`\n🗑️  Orphaned agents (in 11Labs only, NOT in DB): ${orphans.length}`);
  for (const a of orphans) {
    console.log(`  ⚪ ${a.name} (${a.agentId.slice(0, 12)}...) | ${a.createdAt}`);
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`📊 Summary:`);
  console.log(`   Tracked (keep): ${tracked.length}`);
  console.log(`   Orphaned (delete): ${orphans.length}`);
  console.log(`${'='.repeat(70)}\n`);

  if (orphans.length === 0) {
    console.log('✅ No orphaned agents to clean up!');
    return;
  }

  if (!shouldDelete) {
    console.log('⚠️  DRY RUN - No changes made.');
    console.log('   Run with --delete flag to actually delete from ElevenLabs:');
    console.log('   node scripts/cleanup-elevenlabs-orphans.js --delete\n');
    return;
  }

  // Actually delete orphans from ElevenLabs
  console.log('🗑️  Deleting orphaned agents from ElevenLabs...\n');

  let deleted = 0;
  let failed = 0;

  for (const a of orphans) {
    try {
      await elevenLabsClient.delete(`/convai/agents/${a.agentId}`);
      deleted++;
      console.log(`  ✅ Deleted: ${a.name} (${a.agentId})`);
    } catch (error) {
      if (error.response?.status === 404) {
        deleted++;
        console.log(`  ⚠️  Already gone: ${a.name} (${a.agentId})`);
      } else {
        failed++;
        console.error(`  ❌ Failed: ${a.name} (${a.agentId}): ${error.response?.data?.detail || error.message}`);
      }
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n✅ Cleanup complete: ${deleted} deleted, ${failed} failed`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
