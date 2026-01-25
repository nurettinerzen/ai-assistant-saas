#!/usr/bin/env node
/**
 * Verify Phase 4 Migrations
 * Checks all 3 migrations are applied correctly
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyMigrations() {
  console.log('🔍 Phase 4 Migration Verification');
  console.log('==================================\n');

  let allPassed = true;

  try {
    // ============================================
    // Migration 1: emailRagMinConfidence
    // ============================================
    console.log('📊 Migration 1: emailRagMinConfidence field');
    console.log('-------------------------------------------');

    const businessFields = await prisma.$queryRaw`
      SELECT column_name, column_default, data_type
      FROM information_schema.columns
      WHERE table_name = 'Business'
        AND column_name IN ('emailRagMinConfidence', 'emailRagEnabled', 'emailSnippetsEnabled', 'emailRagMaxExamples');
    `;

    if (businessFields.length >= 4) {
      console.log('✅ All email RAG fields exist in Business table:');
      businessFields.forEach(f => {
        console.log(`   - ${f.column_name}: ${f.data_type} (default: ${f.column_default})`);
      });
    } else {
      console.log('❌ Missing email RAG fields in Business table');
      allPassed = false;
    }

    console.log('');

    // ============================================
    // Migration 2: Composite Indexes
    // ============================================
    console.log('📊 Migration 2: Composite Indexes');
    console.log('----------------------------------');

    const indexes = await prisma.$queryRaw`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'EmailEmbedding'
        AND indexname IN ('EmailEmbedding_retrieval_idx', 'EmailEmbedding_language_idx', 'EmailEmbedding_content_hash_idx');
    `;

    if (indexes.length === 3) {
      console.log('✅ All 3 composite indexes exist:');
      indexes.forEach(idx => console.log(`   - ${idx.indexname}`));
    } else {
      console.log(`❌ Missing indexes: found ${indexes.length}/3`);
      allPassed = false;
    }

    console.log('');

    // ============================================
    // Migration 3: PilotBusiness Table
    // ============================================
    console.log('📊 Migration 3: PilotBusiness table');
    console.log('------------------------------------');

    const pilotTable = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'PilotBusiness';
    `;

    if (pilotTable.length === 1) {
      console.log('✅ PilotBusiness table exists');

      const pilotIndexes = await prisma.$queryRaw`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'PilotBusiness';
      `;

      console.log(`   Indexes: ${pilotIndexes.length} found`);
      pilotIndexes.forEach(idx => console.log(`   - ${idx.indexname}`));

      const pilotCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "PilotBusiness"`;
      console.log(`   Pilot businesses: ${pilotCount[0].count}`);
    } else {
      console.log('❌ PilotBusiness table NOT found');
      allPassed = false;
    }

    console.log('');

    // ============================================
    // Summary
    // ============================================
    if (allPassed) {
      console.log('🎉 All 3 migrations verified successfully!\n');
      console.log('Migration Status:');
      console.log('  ✅ emailRagMinConfidence field');
      console.log('  ✅ Composite indexes (3/3)');
      console.log('  ✅ PilotBusiness table\n');
      console.log('Database is ready for Phase 4 pilot deployment.');
      process.exit(0);
    } else {
      console.log('❌ Some migrations failed verification');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyMigrations();
