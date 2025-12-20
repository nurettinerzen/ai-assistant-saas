-- ============================================================================
-- MIGRATION: Add 11Labs Conversational AI Fields
-- ============================================================================
-- This migration adds support for 11Labs Conversational AI
-- Run manually if Prisma migration doesn't work
-- ============================================================================

-- Add 11Labs fields to Assistant table
ALTER TABLE "Assistant"
ADD COLUMN IF NOT EXISTS "elevenLabsAgentId" TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS "voiceProvider" TEXT DEFAULT 'elevenlabs';

-- Add 11Labs fields to PhoneNumber table
ALTER TABLE "PhoneNumber"
ADD COLUMN IF NOT EXISTS "elevenLabsPhoneId" TEXT UNIQUE;

-- Add ELEVENLABS to PhoneProvider enum (if using PostgreSQL enums)
-- Note: You may need to adjust this based on your database setup
-- ALTER TYPE "PhoneProvider" ADD VALUE IF NOT EXISTS 'ELEVENLABS';

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS "Assistant_elevenLabsAgentId_idx" ON "Assistant"("elevenLabsAgentId");
CREATE INDEX IF NOT EXISTS "PhoneNumber_elevenLabsPhoneId_idx" ON "PhoneNumber"("elevenLabsPhoneId");

-- Add comment for documentation
COMMENT ON COLUMN "Assistant"."elevenLabsAgentId" IS '11Labs Conversational AI Agent ID - replaces vapiAssistantId';
COMMENT ON COLUMN "Assistant"."voiceProvider" IS 'Voice provider: elevenlabs or vapi (deprecated)';
COMMENT ON COLUMN "PhoneNumber"."elevenLabsPhoneId" IS '11Labs Phone Number ID - replaces vapiPhoneId';
