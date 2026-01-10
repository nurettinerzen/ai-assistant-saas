/**
 * Script to translate existing English call summaries to Turkish
 * Run with: node scripts/translate-summaries.js
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

const prisma = new PrismaClient();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function translateToTurkish(text) {
  if (!text) return null;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Sen profesyonel bir çevirmensin. Verilen İngilizce metni doğal ve akıcı Türkçe\'ye çevir. Sadece çeviriyi döndür, başka bir şey ekleme.'
        },
        {
          role: 'user',
          content: text
        }
      ],
      temperature: 0.3,
      max_tokens: 500
    });

    return response.choices[0]?.message?.content || text;
  } catch (error) {
    console.error('Translation error:', error.message);
    return text;
  }
}

async function main() {
  console.log('Starting summary translation...\n');

  // Get all call logs with English summaries
  const callLogs = await prisma.callLog.findMany({
    where: {
      summary: { not: null }
    },
    select: {
      id: true,
      summary: true
    }
  });

  console.log(`Found ${callLogs.length} call logs with summaries\n`);

  let translated = 0;
  let skipped = 0;

  for (const call of callLogs) {
    // Check if summary appears to be in English (simple heuristic)
    const englishIndicators = ['The', 'agent', 'user', 'called', 'stated', 'mentioned', 'payment', 'debt', 'reminded'];
    const isEnglish = englishIndicators.some(word => call.summary.includes(word));

    if (!isEnglish) {
      console.log(`[${call.id}] Skipping - appears to be already in Turkish`);
      skipped++;
      continue;
    }

    console.log(`[${call.id}] Translating...`);

    const translatedSummary = await translateToTurkish(call.summary);

    await prisma.callLog.update({
      where: { id: call.id },
      data: { summary: translatedSummary }
    });

    console.log(`[${call.id}] Done: ${translatedSummary.substring(0, 60)}...`);
    translated++;

    // Rate limiting - wait 500ms between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\n========================================`);
  console.log(`Translation complete!`);
  console.log(`Translated: ${translated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`========================================`);

  await prisma.$disconnect();
}

main().catch(console.error);
