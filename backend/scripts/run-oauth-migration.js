/**
 * Run OAuth State Migration
 * Creates OAuthState table for CSRF protection
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('🔄 Running OAuth state migration...\n');

    // Step 1: Create OAuthState table
    console.log('Creating OAuthState table...');
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "OAuthState" (
        "id" SERIAL PRIMARY KEY,
        "state" TEXT NOT NULL UNIQUE,
        "businessId" INTEGER NOT NULL,
        "provider" TEXT NOT NULL,
        "metadata" JSONB,
        "expiresAt" TIMESTAMP(3) NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "OAuthState_businessId_fkey"
          FOREIGN KEY ("businessId")
          REFERENCES "Business"("id")
          ON DELETE CASCADE
          ON UPDATE CASCADE
      )
    `;
    console.log('✅ Table created\n');

    // Step 2: Create indexes
    console.log('Creating indexes...');

    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "OAuthState_state_idx"
      ON "OAuthState"("state")
    `;
    console.log('✅ Index: state');

    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "OAuthState_businessId_provider_idx"
      ON "OAuthState"("businessId", "provider")
    `;
    console.log('✅ Index: businessId + provider');

    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "OAuthState_expiresAt_idx"
      ON "OAuthState"("expiresAt")
    `;
    console.log('✅ Index: expiresAt\n');

    // Step 3: Verify table exists
    console.log('Verifying migration...');
    const result = await prisma.$queryRaw`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'OAuthState'
      ORDER BY ordinal_position
    `;

    console.log('✅ OAuthState table structure:');
    console.table(result);

    console.log('\n✅ Migration completed successfully!');
    console.log('📊 OAuthState table ready for OAuth CSRF protection\n');

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
