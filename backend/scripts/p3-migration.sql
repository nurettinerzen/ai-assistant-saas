-- P3: ActiveCallSession Table Migration
-- Creates ActiveCallSession table for concurrent call tracking

-- Create ActiveCallSession table
CREATE TABLE IF NOT EXISTS "ActiveCallSession" (
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
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ActiveCallSession_businessId_fkey"
    FOREIGN KEY ("businessId")
    REFERENCES "Business"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "ActiveCallSession_callId_idx"
  ON "ActiveCallSession"("callId");

-- Verify table creation
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'ActiveCallSession'
ORDER BY ordinal_position;
