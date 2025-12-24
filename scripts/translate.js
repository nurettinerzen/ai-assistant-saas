/**
 * Translation Script
 *
 * Uses OpenAI GPT-4o-mini to translate locale files to different languages.
 *
 * Usage:
 *   node scripts/translate.js --lang=PR
 *   node scripts/translate.js --lang=PR --source=en
 *
 * Options:
 *   --lang      Target language code (required)
 *   --source    Source language file (default: en)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from backend
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Language metadata for better translations
const LANGUAGE_METADATA = {
  PR: {
    name: 'Brazilian Portuguese',
    nativeName: 'Português (Brasil)',
    instructions: `Translate to Brazilian Portuguese (pt-BR). Use Brazilian expressions and vocabulary, not European Portuguese. For example:
    - Use "celular" not "telemóvel"
    - Use "ônibus" not "autocarro"
    - Use "café da manhã" not "pequeno-almoço"
    - Use "você" as the standard second person pronoun
    - Keep the tone friendly and professional`
  },
  PT: {
    name: 'European Portuguese',
    nativeName: 'Português',
    instructions: 'Translate to European Portuguese (pt-PT). Use Portuguese expressions and vocabulary.'
  },
  TR: {
    name: 'Turkish',
    nativeName: 'Türkçe',
    instructions: 'Translate to Turkish. Use formal "siz" form for polite address.'
  },
  DE: {
    name: 'German',
    nativeName: 'Deutsch',
    instructions: 'Translate to German. Use formal "Sie" form for polite address.'
  },
  ES: {
    name: 'Spanish',
    nativeName: 'Español',
    instructions: 'Translate to Spanish. Use Latin American Spanish by default.'
  },
  FR: {
    name: 'French',
    nativeName: 'Français',
    instructions: 'Translate to French. Use formal "vous" form for polite address.'
  },
  IT: {
    name: 'Italian',
    nativeName: 'Italiano',
    instructions: 'Translate to Italian.'
  },
  NL: {
    name: 'Dutch',
    nativeName: 'Nederlands',
    instructions: 'Translate to Dutch.'
  },
  PL: {
    name: 'Polish',
    nativeName: 'Polski',
    instructions: 'Translate to Polish.'
  },
  RU: {
    name: 'Russian',
    nativeName: 'Русский',
    instructions: 'Translate to Russian. Use formal "вы" form for polite address.'
  },
  AR: {
    name: 'Arabic',
    nativeName: 'العربية',
    instructions: 'Translate to Modern Standard Arabic.'
  },
  JA: {
    name: 'Japanese',
    nativeName: '日本語',
    instructions: 'Translate to Japanese. Use polite form (です/ます).'
  },
  KO: {
    name: 'Korean',
    nativeName: '한국어',
    instructions: 'Translate to Korean. Use polite form (합니다/해요).'
  },
  ZH: {
    name: 'Chinese',
    nativeName: '中文',
    instructions: 'Translate to Simplified Chinese (zh-CN).'
  },
  HI: {
    name: 'Hindi',
    nativeName: 'हिन्दी',
    instructions: 'Translate to Hindi.'
  },
  SV: {
    name: 'Swedish',
    nativeName: 'Svenska',
    instructions: 'Translate to Swedish.'
  }
};

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      args[key] = value || true;
    }
  });
  return args;
}

/**
 * Translate a chunk of text using OpenAI
 */
async function translateChunk(textObj, targetLang, sourceLang = 'en') {
  const langMeta = LANGUAGE_METADATA[targetLang.toUpperCase()];

  if (!langMeta) {
    throw new Error(`Unknown language code: ${targetLang}`);
  }

  const systemPrompt = `You are a professional translator. ${langMeta.instructions}

IMPORTANT RULES:
1. Preserve all JSON keys exactly as they are
2. Only translate the values, not the keys
3. Keep all placeholders like {name}, {count}, etc.
4. Keep technical terms like "API", "WhatsApp", "Shopify" unchanged
5. Keep brand names unchanged (e.g., "Telyx.ai", "TELYX")
6. Return valid JSON only, no markdown or explanations
7. Maintain the exact same JSON structure`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Translate the following JSON from ${sourceLang.toUpperCase()} to ${langMeta.name}:\n\n${JSON.stringify(textObj, null, 2)}`
      }
    ],
    temperature: 0.3,
    max_tokens: 16000
  });

  const content = response.choices[0].message.content;

  // Clean up any markdown code blocks
  let cleanContent = content;
  if (content.startsWith('```')) {
    cleanContent = content.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
  }

  return JSON.parse(cleanContent);
}

/**
 * Split object into chunks for API limits
 */
function chunkObject(obj, maxSize = 50) {
  const entries = Object.entries(obj);
  const chunks = [];

  for (let i = 0; i < entries.length; i += maxSize) {
    chunks.push(Object.fromEntries(entries.slice(i, i + maxSize)));
  }

  return chunks;
}

/**
 * Recursively translate nested objects
 */
async function translateObject(obj, targetLang, sourceLang, depth = 0) {
  // If it's a simple object with only string values, translate directly
  const hasNestedObjects = Object.values(obj).some(v => typeof v === 'object' && v !== null);

  if (!hasNestedObjects) {
    return await translateChunk(obj, targetLang, sourceLang);
  }

  // For nested objects, translate each top-level key separately
  const result = {};
  const entries = Object.entries(obj);

  for (let i = 0; i < entries.length; i++) {
    const [key, value] = entries[i];
    console.log(`  ${'  '.repeat(depth)}Translating section: ${key} (${i + 1}/${entries.length})`);

    if (typeof value === 'object' && value !== null) {
      result[key] = await translateObject(value, targetLang, sourceLang, depth + 1);
    } else {
      result[key] = value; // Keep non-objects as-is (shouldn't happen in this structure)
    }

    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return result;
}

/**
 * Main function
 */
async function main() {
  const args = parseArgs();

  if (!args.lang) {
    console.error('Error: --lang parameter is required');
    console.log('Usage: node scripts/translate.js --lang=PR');
    process.exit(1);
  }

  const targetLang = args.lang.toUpperCase();
  const sourceLang = (args.source || 'en').toLowerCase();

  const localesDir = path.join(__dirname, '../frontend/locales');
  const sourceFile = path.join(localesDir, `${sourceLang}.json`);
  const targetFile = path.join(localesDir, `${targetLang.toLowerCase()}.json`);

  // Check if source file exists
  if (!fs.existsSync(sourceFile)) {
    console.error(`Error: Source file not found: ${sourceFile}`);
    process.exit(1);
  }

  // Check if API key exists
  if (!process.env.OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY not found in environment');
    process.exit(1);
  }

  console.log(`\n🌍 Translation Script`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Source: ${sourceLang}.json`);
  console.log(`Target: ${targetLang.toLowerCase()}.json (${LANGUAGE_METADATA[targetLang]?.name || targetLang})`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // Read source file
  const sourceContent = JSON.parse(fs.readFileSync(sourceFile, 'utf-8'));

  console.log('Starting translation...\n');

  try {
    // Translate the content
    const translatedContent = await translateObject(sourceContent, targetLang, sourceLang);

    // Write the result
    fs.writeFileSync(targetFile, JSON.stringify(translatedContent, null, 2), 'utf-8');

    console.log(`\n✅ Translation complete!`);
    console.log(`📁 Output file: ${targetFile}`);
  } catch (error) {
    console.error('\n❌ Translation failed:', error.message);
    process.exit(1);
  }
}

main();
