-- Add PilotBusiness table for controlled feature rollout
-- Migration: Create pilot allowlist for gradual RAG/snippet deployment
-- Date: 2026-01-25

-- ============================================
-- 1. Create PilotBusiness table
-- ============================================

CREATE TABLE IF NOT EXISTS "PilotBusiness" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "feature" TEXT NOT NULL,
  "enabledAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "enabledBy" TEXT NOT NULL,
  "notes" TEXT,

  CONSTRAINT "PilotBusiness_businessId_fkey"
    FOREIGN KEY ("businessId")
    REFERENCES "Business"("id")
    ON DELETE CASCADE
);

-- ============================================
-- 2. Create indexes
-- ============================================

-- Unique constraint: businessId + feature (prevent duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS "PilotBusiness_businessId_feature_key"
ON "PilotBusiness"("businessId", "feature");

-- Query index: feature + businessId (for getPilotBusinesses)
CREATE INDEX IF NOT EXISTS "PilotBusiness_feature_idx"
ON "PilotBusiness"("feature", "businessId");

-- ============================================
-- 3. Add comments
-- ============================================

COMMENT ON TABLE "PilotBusiness" IS
'Controlled rollout allowlist for pilot features. Used for gradual RAG/snippet deployment with rollback capability.';

COMMENT ON COLUMN "PilotBusiness"."feature" IS
'Feature name: RAG_PILOT, SNIPPET_PILOT, AUTO_DRAFT';

COMMENT ON COLUMN "PilotBusiness"."enabledBy" IS
'Admin user (email) who enabled this feature for the business';

COMMENT ON COLUMN "PilotBusiness"."notes" IS
'Optional notes about pilot status (e.g., cohort, vertical, contact)';
