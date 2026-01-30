-- P2: CRM Webhook Idempotency Migration
-- Creates CrmWebhookEvent table for idempotency tracking

-- Create CrmWebhookEvent table
CREATE TABLE IF NOT EXISTS "CrmWebhookEvent" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "businessId" INTEGER NOT NULL,
  "eventType" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "recordId" TEXT NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CrmWebhookEvent_businessId_fkey"
    FOREIGN KEY ("businessId")
    REFERENCES "Business"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "CrmWebhookEvent_businessId_eventType_idx"
  ON "CrmWebhookEvent"("businessId", "eventType");

CREATE INDEX IF NOT EXISTS "CrmWebhookEvent_processedAt_idx"
  ON "CrmWebhookEvent"("processedAt");

-- Verify table creation
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'CrmWebhookEvent'
ORDER BY ordinal_position;
