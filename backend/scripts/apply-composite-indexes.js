#!/usr/bin/env node
/**
 * Apply composite indexes for EmailEmbedding table
 * Phase 4 migration
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();

async function applyCompositeIndexes() {
  console.log('🔄 Applying composite indexes for EmailEmbedding...');

  try {
    // Index 1: Retrieval index (businessId, direction, intent, sentAt DESC)
    // Note: Removed CONCURRENTLY to allow execution via Prisma
    console.log('📊 Creating EmailEmbedding_retrieval_idx...');
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "EmailEmbedding_retrieval_idx"
      ON "EmailEmbedding" ("businessId", "direction", "intent", "sentAt" DESC)
      WHERE "direction" = 'OUTBOUND';
    `);
    console.log('✅ EmailEmbedding_retrieval_idx created');

    // Index 2: Language index
    console.log('📊 Creating EmailEmbedding_language_idx...');
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "EmailEmbedding_language_idx"
      ON "EmailEmbedding" ("businessId", "language", "sentAt" DESC)
      WHERE "direction" = 'OUTBOUND';
    `);
    console.log('✅ EmailEmbedding_language_idx created');

    // Index 3: Content hash index
    console.log('📊 Creating EmailEmbedding_content_hash_idx...');
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "EmailEmbedding_content_hash_idx"
      ON "EmailEmbedding" ("businessId", "contentHash");
    `);
    console.log('✅ EmailEmbedding_content_hash_idx created');

    // Add comments
    await prisma.$executeRawUnsafe(`
      COMMENT ON INDEX "EmailEmbedding_retrieval_idx" IS 'Composite index for RAG retrieval: businessId + direction + intent + sentAt DESC. Partial index on OUTBOUND only.';
    `);

    await prisma.$executeRawUnsafe(`
      COMMENT ON INDEX "EmailEmbedding_language_idx" IS 'Language-based retrieval index for multi-language businesses.';
    `);

    await prisma.$executeRawUnsafe(`
      COMMENT ON INDEX "EmailEmbedding_content_hash_idx" IS 'Deduplication index for preventing duplicate embeddings.';
    `);

    console.log('✅ All composite indexes created successfully');

  } catch (error) {
    console.error('❌ Error applying composite indexes:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

applyCompositeIndexes()
  .then(() => {
    console.log('🎉 Composite indexes migration complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  });
