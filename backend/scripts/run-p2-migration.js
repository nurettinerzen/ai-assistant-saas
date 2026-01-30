/**
 * Run P2 Migration: CRM Webhook Idempotency
 * Creates CrmWebhookEvent table for tracking processed webhook events
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
    console.log('🔄 Running P2 migration: CRM Webhook Idempotency...\n');

    // Step 1: Check if table already exists
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'CrmWebhookEvent'
      )
    `;

    if (tableExists[0].exists) {
      console.log('✅ CrmWebhookEvent table already exists, skipping creation\n');
      return;
    }

    // Step 2: Create CrmWebhookEvent table WITHOUT foreign key first
    console.log('Creating CrmWebhookEvent table...');
    await prisma.$executeRaw`
      CREATE TABLE "CrmWebhookEvent" (
        "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "idempotencyKey" TEXT NOT NULL UNIQUE,
        "businessId" INTEGER NOT NULL,
        "eventType" TEXT NOT NULL,
        "eventId" TEXT NOT NULL,
        "recordId" TEXT NOT NULL,
        "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ Table created (without FK)\n');

    // Step 2: Create indexes
    console.log('Creating indexes...');

    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "CrmWebhookEvent_businessId_eventType_idx"
      ON "CrmWebhookEvent"("businessId", "eventType")
    `;
    console.log('✅ Index: businessId + eventType');

    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "CrmWebhookEvent_processedAt_idx"
      ON "CrmWebhookEvent"("processedAt")
    `;
    console.log('✅ Index: processedAt\n');

    // Step 3: Verify table exists
    console.log('Verifying migration...');
    const result = await prisma.$queryRaw`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'CrmWebhookEvent'
      ORDER BY ordinal_position
    `;

    console.log('✅ CrmWebhookEvent table structure:');
    console.table(result);

    console.log('\n✅ P2 Migration completed successfully!');
    console.log('📊 CrmWebhookEvent table ready for webhook idempotency tracking\n');

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
