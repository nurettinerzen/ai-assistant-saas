/**
 * Run P3 Migration: ActiveCallSession Table
 * Creates ActiveCallSession table for concurrent call tracking
 */

import { PrismaClient } from '@prisma/client';

// Use DIRECT_URL for migrations (avoids pgbouncer transaction mode issues)
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
});

async function runMigration() {
  try {
    console.log('🔄 Running P3 migration: ActiveCallSession table...\n');

    // Step 1: Check if table already exists
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'ActiveCallSession'
      )
    `;

    if (tableExists[0].exists) {
      console.log('✅ ActiveCallSession table already exists, skipping creation\n');
      return;
    }

    // Step 2: Create ActiveCallSession table WITHOUT foreign key first
    console.log('Creating ActiveCallSession table...');
    await prisma.$executeRaw`
      CREATE TABLE "ActiveCallSession" (
        "id" SERIAL PRIMARY KEY,
        "callId" TEXT NOT NULL UNIQUE,
        "businessId" INTEGER NOT NULL,
        "plan" TEXT NOT NULL,
        "direction" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'active',
        "provider" TEXT NOT NULL DEFAULT 'elevenlabs',
        "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "endedAt" TIMESTAMP(3),
        "metadata" JSONB,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ Table created (without FK)\n');

    // Step 3: Create indexes
    console.log('Creating indexes...');

    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "ActiveCallSession_callId_idx"
      ON "ActiveCallSession"("callId")
    `;
    console.log('✅ Index: callId\n');

    // Step 4: Verify table exists
    console.log('Verifying migration...');
    const result = await prisma.$queryRaw`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'ActiveCallSession'
      ORDER BY ordinal_position
    `;

    console.log('✅ ActiveCallSession table structure:');
    console.table(result);

    console.log('\n✅ P3 Migration completed successfully!');
    console.log('📊 ActiveCallSession table ready for concurrent call tracking\n');

  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('✅ Table already exists - migration previously applied');
    } else {
      console.error('❌ Migration failed:', error.message);
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

runMigration()
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
