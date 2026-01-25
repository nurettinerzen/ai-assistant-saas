-- Add emailRagMinConfidence field to Business table
-- Migration: Add business-level RAG confidence threshold setting
-- Date: 2026-01-24

ALTER TABLE "Business"
ADD COLUMN IF NOT EXISTS "emailRagMinConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0.7;

COMMENT ON COLUMN "Business"."emailRagMinConfidence" IS 'Minimum classification confidence for RAG (0.0-1.0). If classification confidence is below this threshold, RAG and snippets are disabled.';
