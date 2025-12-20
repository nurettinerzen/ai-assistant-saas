#!/usr/bin/env node
// ============================================================================
// VAPI TO 11LABS MIGRATION SCRIPT
// ============================================================================
// FILE: backend/scripts/migrate-to-elevenlabs.js
//
// Migrates existing assistants and phone numbers from VAPI to 11Labs
// Run with: node scripts/migrate-to-elevenlabs.js
// ============================================================================

import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import elevenLabsService from '../src/services/elevenlabs.js';
import { getActiveToolsForElevenLabs } from '../src/tools/index.js';
import { buildAssistantPrompt } from '../src/services/promptBuilder.js';

const prisma = new PrismaClient();

// ============================================================================
// CONFIGURATION
// ============================================================================
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

function log(message) {
  console.log(`[Migration] ${message}`);
}

function verbose(message) {
  if (VERBOSE) {
    console.log(`[Migration:Verbose] ${message}`);
  }
}

// ============================================================================
// MIGRATE ASSISTANTS
// ============================================================================
async function migrateAssistants() {
  log('Starting assistant migration...');

  const assistants = await prisma.assistant.findMany({
    where: {
      vapiAssistantId: { not: null },
      elevenLabsAgentId: null,
      isActive: true
    },
    include: {
      business: {
        include: {
          integrations: { where: { isActive: true } }
        }
      }
    }
  });

  log(`Found ${assistants.length} assistants to migrate`);

  let successCount = 0;
  let failCount = 0;

  for (const assistant of assistants) {
    try {
      log(`Migrating assistant: ${assistant.name} (ID: ${assistant.id})`);
      verbose(`  VAPI ID: ${assistant.vapiAssistantId}`);

      if (DRY_RUN) {
        log(`  [DRY RUN] Would create 11Labs agent`);
        successCount++;
        continue;
      }

      // Build system prompt
      const fullSystemPrompt = buildAssistantPrompt(
        assistant,
        assistant.business,
        assistant.business.integrations
      );

      // Get active tools
      const tools = getActiveToolsForElevenLabs(assistant.business);
      verbose(`  Tools: ${tools.map(t => t.name).join(', ')}`);

      // Get language
      const lang = assistant.business.language?.toLowerCase() || 'tr';

      // Create 11Labs agent config
      const agentConfig = {
        name: `${assistant.name} - Migrated ${Date.now()}`,
        conversation_config: {
          agent: {
            prompt: {
              prompt: fullSystemPrompt
            },
            first_message: assistant.firstMessage ||
              (lang === 'tr'
                ? `Merhaba, ben ${assistant.name}. Size nasil yardimci olabilirim?`
                : `Hello, I'm ${assistant.name}. How can I help you?`),
            language: lang
          },
          tts: {
            voice_id: assistant.voiceId,
            model_id: 'eleven_turbo_v2_5',
            stability: 0.5,
            similarity_boost: 0.75,
            optimize_streaming_latency: 3
          },
          stt: {
            provider: 'elevenlabs',
            model: 'scribe_v1',
            language: lang
          },
          turn: {
            mode: 'turn_based'
          }
        },
        tools: tools,
        metadata: {
          telyx_assistant_id: assistant.id,
          telyx_business_id: assistant.business.id.toString(),
          migrated_from_vapi: assistant.vapiAssistantId,
          migration_date: new Date().toISOString()
        }
      };

      // Create agent in 11Labs
      const elevenLabsResponse = await elevenLabsService.createAgent(agentConfig);
      const elevenLabsAgentId = elevenLabsResponse.agent_id;

      log(`  Created 11Labs agent: ${elevenLabsAgentId}`);

      // Update database
      await prisma.assistant.update({
        where: { id: assistant.id },
        data: {
          elevenLabsAgentId: elevenLabsAgentId,
          voiceProvider: 'elevenlabs'
        }
      });

      log(`  Database updated successfully`);
      successCount++;

      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error(`  ERROR migrating ${assistant.name}:`, error.message);
      failCount++;
    }
  }

  log(`Assistant migration complete: ${successCount} succeeded, ${failCount} failed`);
  return { successCount, failCount };
}

// ============================================================================
// MIGRATE PHONE NUMBERS
// ============================================================================
async function migratePhoneNumbers() {
  log('Starting phone number migration...');

  const phoneNumbers = await prisma.phoneNumber.findMany({
    where: {
      vapiPhoneId: { not: null },
      elevenLabsPhoneId: null,
      status: 'ACTIVE'
    },
    include: {
      assistant: true
    }
  });

  log(`Found ${phoneNumbers.length} phone numbers to migrate`);

  let successCount = 0;
  let failCount = 0;
  let skippedCount = 0;

  for (const phoneNumber of phoneNumbers) {
    try {
      log(`Migrating phone number: ${phoneNumber.phoneNumber}`);
      verbose(`  VAPI Phone ID: ${phoneNumber.vapiPhoneId}`);
      verbose(`  Provider: ${phoneNumber.provider}`);

      // Skip if assistant not migrated yet
      if (!phoneNumber.assistant?.elevenLabsAgentId) {
        log(`  SKIPPED: Assistant not yet migrated to 11Labs`);
        skippedCount++;
        continue;
      }

      if (DRY_RUN) {
        log(`  [DRY RUN] Would import phone number to 11Labs`);
        successCount++;
        continue;
      }

      // For now, we can't automatically import Twilio numbers without credentials
      // This step requires manual Twilio configuration
      log(`  NOTE: Phone number requires manual Twilio import`);
      log(`  Use POST /api/phone-numbers/${phoneNumber.id}/import-twilio with Twilio credentials`);

      // Update provider to ELEVENLABS to mark for migration
      await prisma.phoneNumber.update({
        where: { id: phoneNumber.id },
        data: {
          provider: 'ELEVENLABS'
        }
      });

      successCount++;

    } catch (error) {
      console.error(`  ERROR migrating ${phoneNumber.phoneNumber}:`, error.message);
      failCount++;
    }
  }

  log(`Phone number migration complete: ${successCount} succeeded, ${failCount} failed, ${skippedCount} skipped`);
  return { successCount, failCount, skippedCount };
}

// ============================================================================
// VERIFY MIGRATION
// ============================================================================
async function verifyMigration() {
  log('Verifying migration...');

  const stats = await prisma.$transaction([
    // Total assistants
    prisma.assistant.count({ where: { isActive: true } }),
    // Migrated assistants
    prisma.assistant.count({ where: { elevenLabsAgentId: { not: null }, isActive: true } }),
    // Still on VAPI
    prisma.assistant.count({ where: { vapiAssistantId: { not: null }, elevenLabsAgentId: null, isActive: true } }),
    // Total phone numbers
    prisma.phoneNumber.count({ where: { status: 'ACTIVE' } }),
    // Migrated phone numbers
    prisma.phoneNumber.count({ where: { elevenLabsPhoneId: { not: null }, status: 'ACTIVE' } }),
    // Marked for 11Labs but not imported
    prisma.phoneNumber.count({ where: { provider: 'ELEVENLABS', elevenLabsPhoneId: null, status: 'ACTIVE' } }),
  ]);

  log('=== Migration Status ===');
  log(`Assistants:`);
  log(`  - Total active: ${stats[0]}`);
  log(`  - Migrated to 11Labs: ${stats[1]}`);
  log(`  - Still on VAPI: ${stats[2]}`);
  log(`Phone Numbers:`);
  log(`  - Total active: ${stats[3]}`);
  log(`  - Imported to 11Labs: ${stats[4]}`);
  log(`  - Pending import: ${stats[5]}`);

  return stats;
}

// ============================================================================
// MAIN
// ============================================================================
async function main() {
  console.log('='.repeat(60));
  console.log('VAPI to 11Labs Migration Script');
  console.log('='.repeat(60));

  if (DRY_RUN) {
    console.log('>>> DRY RUN MODE - No changes will be made <<<\n');
  }

  if (!process.env.ELEVENLABS_API_KEY) {
    console.error('ERROR: ELEVENLABS_API_KEY not set in environment');
    process.exit(1);
  }

  try {
    // Verify before migration
    log('Status before migration:');
    await verifyMigration();

    console.log('\n');

    // Migrate assistants
    const assistantResult = await migrateAssistants();

    console.log('\n');

    // Migrate phone numbers
    const phoneResult = await migratePhoneNumbers();

    console.log('\n');

    // Verify after migration
    log('Status after migration:');
    await verifyMigration();

    console.log('\n='.repeat(60));
    console.log('Migration Complete!');
    console.log('='.repeat(60));

    if (!DRY_RUN) {
      console.log('\nNext steps:');
      console.log('1. For phone numbers, run the Twilio import for each number:');
      console.log('   POST /api/phone-numbers/{id}/import-twilio');
      console.log('2. Update 11Labs webhook URL in 11Labs dashboard');
      console.log('3. Test a call to verify everything works');
    }

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
