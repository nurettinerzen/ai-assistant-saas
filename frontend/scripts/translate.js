#!/usr/bin/env node

/**
 * Translation Script for TELYX.AI
 *
 * Translates the English locale file to other languages using OpenAI GPT-4o-mini.
 *
 * Usage:
 *   node scripts/translate.js --lang=PR    # Translate to Brazilian Portuguese
 *   node scripts/translate.js --lang=DE    # Translate to German
 *   node scripts/translate.js --lang=all   # Translate to all missing languages
 *
 * Requirements:
 *   - OPENAI_API_KEY environment variable must be set
 */

const fs = require('fs');
const path = require('path');

// Language configurations
const LANGUAGES = {
  TR: { name: 'Turkish', nativeName: 'Türkçe' },
  EN: { name: 'English', nativeName: 'English' },
  PT: { name: 'Portuguese (Brazilian)', nativeName: 'Português Brasileiro' },
  DE: { name: 'German', nativeName: 'Deutsch' },
  ES: { name: 'Spanish', nativeName: 'Español' },
  FR: { name: 'French', nativeName: 'Français' },
  IT: { name: 'Italian', nativeName: 'Italiano' },
  NL: { name: 'Dutch', nativeName: 'Nederlands' },
  PL: { name: 'Polish', nativeName: 'Polski' },
  RU: { name: 'Russian', nativeName: 'Русский' },
  AR: { name: 'Arabic', nativeName: 'العربية' },
  JA: { name: 'Japanese', nativeName: '日本語' },
  KO: { name: 'Korean', nativeName: '한국어' },
  ZH: { name: 'Chinese', nativeName: '中文' },
  HI: { name: 'Hindi', nativeName: 'हिन्दी' },
  SV: { name: 'Swedish', nativeName: 'Svenska' }
};

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (const arg of args) {
    if (arg.startsWith('--lang=')) {
      options.lang = arg.split('=')[1].toUpperCase();
    }
    if (arg === '--dry-run') {
      options.dryRun = true;
    }
  }

  return options;
}

// Flatten nested object to dot notation
function flattenObject(obj, prefix = '') {
  const result = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, newKey));
    } else {
      result[newKey] = value;
    }
  }

  return result;
}

// Unflatten dot notation back to nested object
function unflattenObject(obj) {
  const result = {};

  for (const [key, value] of Object.entries(obj)) {
    const keys = key.split('.');
    let current = result;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;
  }

  return result;
}

// Translate using OpenAI API
async function translateWithOpenAI(texts, targetLang, langConfig) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  // Split into chunks of 50 items to avoid token limits
  const CHUNK_SIZE = 50;
  const chunks = [];
  const keys = Object.keys(texts);

  for (let i = 0; i < keys.length; i += CHUNK_SIZE) {
    const chunkKeys = keys.slice(i, i + CHUNK_SIZE);
    const chunk = {};
    for (const key of chunkKeys) {
      chunk[key] = texts[key];
    }
    chunks.push(chunk);
  }

  console.log(`Translating ${keys.length} strings in ${chunks.length} chunks...`);

  const translatedTexts = {};

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`Processing chunk ${i + 1}/${chunks.length}...`);

    const prompt = `You are a professional translator. Translate the following JSON object from English to ${langConfig.name} (${langConfig.nativeName}).

Important rules:
1. Maintain the exact JSON structure and keys
2. Only translate the VALUES, never the keys
3. Keep brand names (Telyx.ai, Shopify, WhatsApp, etc.) unchanged
4. Keep technical terms and placeholders unchanged
5. Use natural, conversational ${langConfig.name} appropriate for a SaaS platform
6. For Brazilian Portuguese specifically: use Brazilian vocabulary (celular not telemóvel, ônibus not autocarro)
7. Return ONLY the translated JSON, no explanations

JSON to translate:
${JSON.stringify(chunk, null, 2)}`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a professional translator specializing in software localization.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 4000
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const translatedContent = data.choices[0].message.content;

      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = translatedContent;
      if (translatedContent.includes('```json')) {
        jsonStr = translatedContent.split('```json')[1].split('```')[0].trim();
      } else if (translatedContent.includes('```')) {
        jsonStr = translatedContent.split('```')[1].split('```')[0].trim();
      }

      const translatedChunk = JSON.parse(jsonStr);
      Object.assign(translatedTexts, translatedChunk);

      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Error translating chunk ${i + 1}:`, error.message);
      // Keep original texts for this chunk
      Object.assign(translatedTexts, chunk);
    }
  }

  return translatedTexts;
}

async function main() {
  const options = parseArgs();

  if (!options.lang) {
    console.log('Usage: node scripts/translate.js --lang=PR');
    console.log('Available languages:', Object.keys(LANGUAGES).join(', '));
    process.exit(1);
  }

  const targetLang = options.lang;
  const langConfig = LANGUAGES[targetLang];

  if (!langConfig) {
    console.error(`Unknown language: ${targetLang}`);
    console.log('Available languages:', Object.keys(LANGUAGES).join(', '));
    process.exit(1);
  }

  const localesDir = path.join(__dirname, '..', 'locales');
  const sourcePath = path.join(localesDir, 'en.json');
  const targetPath = path.join(localesDir, `${targetLang.toLowerCase()}.json`);

  // Read source file
  if (!fs.existsSync(sourcePath)) {
    console.error('Source file not found:', sourcePath);
    process.exit(1);
  }

  const sourceContent = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  const flattenedSource = flattenObject(sourceContent);

  console.log(`\nTranslating to ${langConfig.name} (${langConfig.nativeName})...`);
  console.log(`Source: ${sourcePath}`);
  console.log(`Target: ${targetPath}`);
  console.log(`Total strings: ${Object.keys(flattenedSource).length}`);

  if (options.dryRun) {
    console.log('\n[DRY RUN] Would translate these strings:');
    console.log(Object.keys(flattenedSource).slice(0, 10).join('\n'));
    console.log(`... and ${Object.keys(flattenedSource).length - 10} more`);
    process.exit(0);
  }

  // Translate
  const translatedFlat = await translateWithOpenAI(flattenedSource, targetLang, langConfig);

  // Unflatten back to nested structure
  const translatedContent = unflattenObject(translatedFlat);

  // Write to file
  fs.writeFileSync(targetPath, JSON.stringify(translatedContent, null, 2), 'utf8');

  console.log(`\nTranslation complete! Saved to: ${targetPath}`);
}

main().catch(error => {
  console.error('Translation failed:', error);
  process.exit(1);
});
