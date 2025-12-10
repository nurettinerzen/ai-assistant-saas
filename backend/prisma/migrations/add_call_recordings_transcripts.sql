-- Migration: Add Call Recordings and Transcripts Fields
-- This migration adds new fields to the CallLog model to support recordings, transcripts, and AI analysis

-- Add new columns to CallLog table
ALTER TABLE "CallLog"
  -- Change transcript from TEXT to JSONB for structured data
  ALTER COLUMN "transcript" TYPE JSONB USING
    CASE
      WHEN "transcript" IS NOT NULL THEN
        json_build_array(
          json_build_object(
            'speaker', 'assistant',
            'text', "transcript",
            'timestamp', "createdAt"
          )
        )::jsonb
      ELSE NULL
    END,

  -- Add plain text transcript for search
  ADD COLUMN IF NOT EXISTS "transcriptText" TEXT,

  -- Expand recordingUrl to TEXT type
  ALTER COLUMN "recordingUrl" TYPE TEXT,

  -- Add recording duration
  ADD COLUMN IF NOT EXISTS "recordingDuration" INTEGER,

  -- Add sentiment score
  ADD COLUMN IF NOT EXISTS "sentimentScore" DOUBLE PRECISION,

  -- Expand summary to TEXT type
  ALTER COLUMN "summary" TYPE TEXT,

  -- Add key topics array
  ADD COLUMN IF NOT EXISTS "keyTopics" TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Add action items array
  ADD COLUMN IF NOT EXISTS "actionItems" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Update existing transcriptText from transcript for search
UPDATE "CallLog"
SET "transcriptText" = "transcript"::TEXT
WHERE "transcript" IS NOT NULL AND "transcriptText" IS NULL;

-- Comments for documentation
COMMENT ON COLUMN "CallLog"."transcript" IS 'Array of {speaker, text, timestamp} objects';
COMMENT ON COLUMN "CallLog"."transcriptText" IS 'Plain text transcript for search functionality';
COMMENT ON COLUMN "CallLog"."recordingUrl" IS 'URL to the call recording audio file';
COMMENT ON COLUMN "CallLog"."recordingDuration" IS 'Duration of the recording in seconds';
COMMENT ON COLUMN "CallLog"."sentiment" IS 'Overall sentiment: positive, neutral, or negative';
COMMENT ON COLUMN "CallLog"."sentimentScore" IS 'Sentiment score from 0.0 to 1.0';
COMMENT ON COLUMN "CallLog"."keyTopics" IS 'Array of key topics detected in the call';
COMMENT ON COLUMN "CallLog"."actionItems" IS 'Array of action items identified from the call';
