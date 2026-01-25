#!/usr/bin/env node
/**
 * Backfill Email Embeddings for Pilot Businesses
 *
 * Usage:
 *   node backfill-embeddings.js --businessId=<id> --days=90
 *
 * Purpose:
 *   One-time backfill of historical OUTBOUND emails for RAG pilot.
 *   Generates OpenAI embeddings for last N days of sent emails.
 *
 * Features:
 *   - Deduplication (contentHash)
 *   - Rate limiting (OpenAI 3500 RPM)
 *   - Progress logging
 *   - Error recovery
 */

import { PrismaClient } from '@prisma/client';
import { generateEmbedding } from '../src/core/email/rag/embeddingService.js';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

/**
 * Backfill embeddings for a business
 *
 * @param {string} businessId - Business ID to backfill
 * @param {number} days - Number of days to backfill (default: 90)
 * @returns {Promise<Object>} { processed, skipped, errors }
 */
async function backfillEmbeddings(businessId, days = 90) {
  console.log(`🔄 [Backfill] Starting for businessId=${businessId}, days=${days}`);

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Verify business exists
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true }
  });

  if (!business) {
    console.error(`❌ [Backfill] Business not found: ${businessId}`);
    return { processed: 0, skipped: 0, errors: 1 };
  }

  console.log(`📧 [Backfill] Business: ${business.name} (${business.id})`);

  // Find all OUTBOUND emails in last N days
  const emails = await prisma.emailThread.findMany({
    where: {
      businessId,
      direction: 'OUTBOUND',
      sentAt: { gte: since },
      // Exclude already embedded
      embeddings: {
        none: {}
      }
    },
    select: {
      id: true,
      subject: true,
      bodyPlain: true,
      classification: true,
      sentAt: true
    },
    orderBy: { sentAt: 'desc' }
  });

  console.log(`📧 [Backfill] Found ${emails.length} OUTBOUND emails to embed`);

  if (emails.length === 0) {
    console.log(`✅ [Backfill] No emails to backfill`);
    return { processed: 0, skipped: 0, errors: 0 };
  }

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const email of emails) {
    try {
      // Skip if no body or too short
      if (!email.bodyPlain || email.bodyPlain.length < 50) {
        console.log(`⏭️  [Backfill] Skipping (too short): ${email.id}`);
        skipped++;
        continue;
      }

      // Generate content hash (deduplication)
      const contentHash = createHash('sha256')
        .update(email.subject + email.bodyPlain)
        .digest('hex')
        .substring(0, 16);

      // Check if duplicate already exists
      const existing = await prisma.emailEmbedding.findFirst({
        where: {
          businessId,
          contentHash
        }
      });

      if (existing) {
        console.log(`⏭️  [Backfill] Duplicate detected: ${email.id} (hash: ${contentHash})`);
        skipped++;
        continue;
      }

      // Generate embedding
      const text = `${email.subject}\n\n${email.bodyPlain}`;
      const embedding = await generateEmbedding(text);

      if (!embedding || embedding.length !== 1536) {
        console.error(`❌ [Backfill] Invalid embedding for ${email.id}`);
        errors++;
        continue;
      }

      // Save to DB
      await prisma.emailEmbedding.create({
        data: {
          businessId,
          emailId: email.id,
          subject: email.subject,
          bodyPlain: email.bodyPlain,
          embedding: embedding, // 1536-dim array
          contentHash,
          intent: email.classification?.intent || null,
          language: email.classification?.language || null,
          direction: 'OUTBOUND',
          sentAt: email.sentAt
        }
      });

      processed++;

      if (processed % 10 === 0) {
        console.log(`✅ [Backfill] Progress: ${processed}/${emails.length} (${Math.round(processed / emails.length * 100)}%)`);
      }

      // Rate limit: OpenAI has 3500 RPM = ~58 RPS
      // Sleep 20ms between calls to stay under limit (~50 RPS)
      await new Promise(resolve => setTimeout(resolve, 20));

    } catch (error) {
      console.error(`❌ [Backfill] Error embedding ${email.id}:`, error.message);
      errors++;

      // Continue processing even on errors
      continue;
    }
  }

  console.log(`✅ [Backfill] Complete: processed=${processed}, skipped=${skipped}, errors=${errors}`);

  // Summary
  const summary = {
    processed,
    skipped,
    errors,
    total: emails.length,
    successRate: Math.round((processed / emails.length) * 100)
  };

  console.log(`📊 [Backfill] Summary:`, JSON.stringify(summary, null, 2));

  return summary;
}

// ============================================
// CLI Execution
// ============================================

const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.split('=');
  acc[key.replace('--', '')] = value;
  return acc;
}, {});

if (!args.businessId) {
  console.error(`
❌ Missing required argument: --businessId

Usage:
  node backfill-embeddings.js --businessId=<id> --days=90

Example:
  node backfill-embeddings.js --businessId=clx1234567890 --days=90
  `);
  process.exit(1);
}

const businessId = args.businessId;
const days = parseInt(args.days || '90');

console.log(`🚀 [Backfill] Starting backfill process...`);
console.log(`   Business ID: ${businessId}`);
console.log(`   Days: ${days}`);
console.log(``);

backfillEmbeddings(businessId, days)
  .then(result => {
    console.log(`📊 [Backfill] Final Result:`, result);

    if (result.errors > 0) {
      console.warn(`⚠️ [Backfill] Completed with ${result.errors} errors`);
      process.exit(1);
    } else {
      console.log(`✅ [Backfill] Success!`);
      process.exit(0);
    }
  })
  .catch(error => {
    console.error(`❌ [Backfill] Fatal error:`, error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
