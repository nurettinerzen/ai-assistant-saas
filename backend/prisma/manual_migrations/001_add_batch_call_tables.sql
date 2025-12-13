-- ============================================================================
-- BATCH CALL / COLLECTION CAMPAIGN TABLES
-- Manual Migration - Run in Supabase SQL Editor or psql
-- ============================================================================
-- Date: 2025-12-13
-- Description: Adds Campaign and CampaignCall tables for batch collection calls
-- ============================================================================

-- Create ENUM types
DO $$ BEGIN
    CREATE TYPE "CampaignChannel" AS ENUM ('PHONE', 'WHATSAPP');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "CampaignStatus" AS ENUM ('PENDING', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "CampaignCallStatus" AS ENUM ('PENDING', 'QUEUED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'NO_ANSWER', 'BUSY', 'VOICEMAIL', 'SKIPPED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "CampaignCallOutcome" AS ENUM ('PAYMENT_PROMISED', 'PARTIAL_PAYMENT', 'PAYMENT_REFUSED', 'DISPUTE', 'CALLBACK_REQUESTED', 'WRONG_NUMBER', 'NOT_AVAILABLE', 'NO_RESPONSE', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create Campaign table
CREATE TABLE IF NOT EXISTS "Campaign" (
    "id" SERIAL PRIMARY KEY,
    "businessId" INTEGER NOT NULL,
    "name" TEXT,
    "channel" "CampaignChannel" NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'PENDING',

    -- Statistics
    "totalCalls" INTEGER NOT NULL DEFAULT 0,
    "completedCalls" INTEGER NOT NULL DEFAULT 0,
    "successfulCalls" INTEGER NOT NULL DEFAULT 0,
    "failedCalls" INTEGER NOT NULL DEFAULT 0,

    -- Configuration
    "maxConcurrent" INTEGER NOT NULL DEFAULT 5,
    "callDelay" INTEGER NOT NULL DEFAULT 5,
    "maxRetries" INTEGER NOT NULL DEFAULT 2,

    -- Script/Prompt for AI
    "collectionScript" TEXT,

    -- Timestamps
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create CampaignCall table
CREATE TABLE IF NOT EXISTS "CampaignCall" (
    "id" SERIAL PRIMARY KEY,
    "campaignId" INTEGER NOT NULL,

    -- Customer Info
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerEmail" TEXT,

    -- Invoice Info (from Paraşüt)
    "invoiceId" TEXT,
    "invoiceNumber" TEXT,
    "invoiceAmount" DOUBLE PRECISION NOT NULL,
    "invoiceCurrency" TEXT NOT NULL DEFAULT 'TRY',
    "daysOverdue" INTEGER NOT NULL,

    -- Call Status
    "status" "CampaignCallStatus" NOT NULL DEFAULT 'PENDING',
    "outcome" "CampaignCallOutcome",
    "retryCount" INTEGER NOT NULL DEFAULT 0,

    -- VAPI Integration
    "vapiCallId" TEXT UNIQUE,

    -- Call Details
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,

    -- Results
    "transcript" JSONB,
    "transcriptText" TEXT,
    "summary" TEXT,
    "paymentDate" TIMESTAMP(3),
    "paymentAmount" DOUBLE PRECISION,
    "notes" TEXT,

    -- Timestamps
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Foreign Key
    CONSTRAINT "CampaignCall_campaignId_fkey" FOREIGN KEY ("campaignId")
        REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create indexes for Campaign
CREATE INDEX IF NOT EXISTS "Campaign_businessId_idx" ON "Campaign"("businessId");
CREATE INDEX IF NOT EXISTS "Campaign_status_idx" ON "Campaign"("status");
CREATE INDEX IF NOT EXISTS "Campaign_createdAt_idx" ON "Campaign"("createdAt");

-- Create indexes for CampaignCall
CREATE INDEX IF NOT EXISTS "CampaignCall_campaignId_idx" ON "CampaignCall"("campaignId");
CREATE INDEX IF NOT EXISTS "CampaignCall_status_idx" ON "CampaignCall"("status");
CREATE INDEX IF NOT EXISTS "CampaignCall_customerPhone_idx" ON "CampaignCall"("customerPhone");
CREATE INDEX IF NOT EXISTS "CampaignCall_vapiCallId_idx" ON "CampaignCall"("vapiCallId");

-- Create trigger for updatedAt on Campaign
CREATE OR REPLACE FUNCTION update_campaign_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_campaign_updated_at ON "Campaign";
CREATE TRIGGER trigger_campaign_updated_at
    BEFORE UPDATE ON "Campaign"
    FOR EACH ROW
    EXECUTE FUNCTION update_campaign_updated_at();

-- Create trigger for updatedAt on CampaignCall
DROP TRIGGER IF EXISTS trigger_campaign_call_updated_at ON "CampaignCall";
CREATE TRIGGER trigger_campaign_call_updated_at
    BEFORE UPDATE ON "CampaignCall"
    FOR EACH ROW
    EXECUTE FUNCTION update_campaign_updated_at();

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Run this to verify tables were created:
-- SELECT table_name FROM information_schema.tables WHERE table_name IN ('Campaign', 'CampaignCall');
