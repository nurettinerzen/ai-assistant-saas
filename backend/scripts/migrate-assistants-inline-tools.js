/**
 * Migration Script: Convert all assistants from tool_ids to inline tools
 *
 * Problem: Assistants created before Jan 12 2026 18:22 may use external tool_ids
 * which no longer exist in 11Labs, causing "Unknown tool" errors.
 *
 * Solution: Update all agents to use inline tools instead of tool_ids
 *
 * Usage: node scripts/migrate-assistants-inline-tools.js [--dry-run]
 */

import { PrismaClient } from '@prisma/client';
import elevenLabsService from '../src/services/elevenlabs.js';
import { getActiveTools } from '../src/tools/index.js';
import { getElevenLabsVoiceId } from '../src/constants/voices.js';

const prisma = new PrismaClient();

const ELEVENLABS_LANGUAGE_MAP = {
  'tr': 'tr', 'en': 'en', 'pr': 'pt-br', 'pt': 'pt',
  'de': 'de', 'es': 'es', 'fr': 'fr', 'it': 'it',
  'ja': 'ja', 'ko': 'ko', 'zh': 'zh', 'ar': 'ar',
  'hi': 'hi', 'nl': 'nl', 'pl': 'pl', 'ru': 'ru', 'sv': 'sv'
};

function getElevenLabsLanguage(lang) {
  const normalized = lang?.toLowerCase() || 'tr';
  return ELEVENLABS_LANGUAGE_MAP[normalized] || normalized;
}

async function migrateAssistant(assistant, business, dryRun = false) {
  const lang = business?.language || 'TR';
  const elevenLabsLang = getElevenLabsLanguage(lang);
  const elevenLabsVoiceId = getElevenLabsVoiceId(assistant.voiceId, lang);

  // System tools
  const endCallTool = {
    type: 'system',
    name: 'end_call',
    description: 'Müşteri vedalaştığında veya "iyi günler", "görüşürüz", "hoşçakal", "bye", "goodbye" dediğinde aramayı sonlandır.',
    params: { system_tool_type: 'end_call' }
  };

  const voicemailDetectionTool = {
    type: 'system',
    name: 'voicemail_detection',
    description: 'Sesli mesaj (voicemail) algılandığında aramayı otomatik olarak sonlandırır.',
    params: {
      system_tool_type: 'voicemail_detection',
      voicemail_message: '',
      use_out_of_band_dtmf: false
    }
  };

  // Webhook tools
  const backendUrl = process.env.BACKEND_URL || 'https://api.telyx.ai';
  const webhookUrl = `${backendUrl}/api/elevenlabs/webhook?agentId=${assistant.elevenLabsAgentId}`;
  const activeToolDefinitions = getActiveTools(business);

  const webhookTools = activeToolDefinitions.map(tool => ({
    type: 'webhook',
    name: tool.function.name,
    description: tool.function.description,
    api_schema: {
      url: webhookUrl,
      method: 'POST',
      request_body_schema: {
        type: 'object',
        properties: {
          tool_name: {
            type: 'string',
            constant_value: tool.function.name
          },
          ...Object.fromEntries(
            Object.entries(tool.function.parameters.properties || {}).map(([key, value]) => [
              key,
              {
                type: value.type || 'string',
                description: value.description || '',
                ...(value.enum ? { enum: value.enum } : {})
              }
            ])
          )
        },
        required: tool.function.parameters.required || []
      }
    }
  }));

  const allTools = [endCallTool, voicemailDetectionTool, ...webhookTools];

  // Analysis prompts
  const analysisPrompts = {
    tr: {
      transcript_summary: 'Bu görüşmenin kısa bir özetini Türkçe olarak yaz.',
      success_evaluation: 'Görüşme başarılı mı?'
    },
    en: {
      transcript_summary: 'Write a brief summary of this conversation.',
      success_evaluation: 'Was the conversation successful?'
    }
  };
  const langAnalysis = analysisPrompts[elevenLabsLang] || analysisPrompts.en;

  const agentUpdateConfig = {
    name: assistant.name,
    conversation_config: {
      agent: {
        prompt: {
          prompt: assistant.systemPrompt,
          llm: 'gemini-2.5-flash',
          temperature: 0.1,
          tools: allTools
        },
        first_message: assistant.firstMessage,
        language: elevenLabsLang
      },
      tts: {
        voice_id: elevenLabsVoiceId,
        model_id: 'eleven_turbo_v2_5',
        stability: 0.4,
        similarity_boost: 0.6,
        style: 0.15,
        optimize_streaming_latency: 3
      },
      stt: {
        provider: 'elevenlabs',
        model: 'scribe_v1',
        language: elevenLabsLang
      },
      turn: {
        mode: 'turn',
        turn_timeout: 8,
        turn_eagerness: 'normal',
        silence_end_call_timeout: 30
      },
      analysis: {
        transcript_summary_prompt: langAnalysis.transcript_summary,
        success_evaluation_prompt: langAnalysis.success_evaluation
      }
    }
  };

  if (dryRun) {
    console.log(`  [DRY-RUN] Would update agent with ${allTools.length} inline tools`);
    return { success: true, dryRun: true };
  }

  // Clear tool_ids first
  try {
    await elevenLabsService.updateAgent(assistant.elevenLabsAgentId, { tool_ids: [] });
    console.log(`  ✅ Cleared tool_ids`);
  } catch (e) {
    console.log(`  ⚠️ Could not clear tool_ids: ${e.message}`);
  }

  // Update with inline tools
  await elevenLabsService.updateAgent(assistant.elevenLabsAgentId, agentUpdateConfig);
  console.log(`  ✅ Updated with ${allTools.length} inline tools`);

  return { success: true };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('🔄 Assistant Migration: tool_ids → inline tools');
  console.log(dryRun ? '⚠️  DRY RUN MODE - No changes will be made\n' : '');

  // Get all active assistants with 11Labs agents
  const assistants = await prisma.assistant.findMany({
    where: {
      isActive: true,
      elevenLabsAgentId: { not: null }
    },
    include: {
      business: {
        include: {
          integrations: { where: { isActive: true } }
        }
      }
    }
  });

  console.log(`📋 Found ${assistants.length} assistants to check\n`);

  let migrated = 0;
  let failed = 0;
  let skipped = 0;

  for (const assistant of assistants) {
    console.log(`\n[${assistant.id}] ${assistant.name} (Business: ${assistant.business?.name || 'Unknown'})`);
    console.log(`  Agent ID: ${assistant.elevenLabsAgentId}`);

    try {
      // Check current agent status
      const agent = await elevenLabsService.getAgent(assistant.elevenLabsAgentId);
      const hasToolIds = agent.tool_ids && agent.tool_ids.length > 0;
      const hasInlineTools = agent.conversation_config?.agent?.prompt?.tools?.length > 0;

      console.log(`  Current: tool_ids=${hasToolIds ? agent.tool_ids.length : 0}, inline_tools=${hasInlineTools ? 'yes' : 'no'}`);

      if (hasToolIds) {
        console.log(`  🔧 NEEDS MIGRATION (has tool_ids)`);
        const result = await migrateAssistant(assistant, assistant.business, dryRun);
        if (result.success) migrated++;
      } else if (!hasInlineTools) {
        console.log(`  🔧 NEEDS MIGRATION (no tools at all)`);
        const result = await migrateAssistant(assistant, assistant.business, dryRun);
        if (result.success) migrated++;
      } else {
        console.log(`  ✅ Already using inline tools`);
        skipped++;
      }
    } catch (error) {
      console.log(`  ❌ ERROR: ${error.message}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`📊 Results:`);
  console.log(`   Migrated: ${migrated}`);
  console.log(`   Skipped:  ${skipped}`);
  console.log(`   Failed:   ${failed}`);
  console.log(`   Total:    ${assistants.length}`);

  if (dryRun) {
    console.log('\n⚠️  This was a dry run. Run without --dry-run to apply changes.');
  }

  await prisma.$disconnect();
}

main().catch(console.error);
