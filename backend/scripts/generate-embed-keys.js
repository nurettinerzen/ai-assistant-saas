/**
 * Script to generate chatEmbedKey for existing businesses
 * Run with: node scripts/generate-embed-keys.js
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

function generateChatEmbedKey() {
  return `emb_${crypto.randomBytes(16).toString('hex')}`;
}

async function main() {
  console.log('Generating chat embed keys for existing businesses...\n');

  // Get all businesses without chatEmbedKey
  const businesses = await prisma.business.findMany({
    where: {
      chatEmbedKey: null
    },
    select: {
      id: true,
      name: true
    }
  });

  console.log(`Found ${businesses.length} businesses without embed key\n`);

  let updated = 0;

  for (const business of businesses) {
    const embedKey = generateChatEmbedKey();

    await prisma.business.update({
      where: { id: business.id },
      data: { chatEmbedKey: embedKey }
    });

    console.log(`[${business.id}] ${business.name}: ${embedKey}`);
    updated++;
  }

  console.log(`\n========================================`);
  console.log(`Generation complete!`);
  console.log(`Updated: ${updated} businesses`);
  console.log(`========================================`);

  await prisma.$disconnect();
}

main().catch(console.error);
