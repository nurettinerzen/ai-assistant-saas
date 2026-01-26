-- Add topicHash field for duplicate detection
-- This is optional (nullable) to avoid breaking existing records

ALTER TABLE "CallbackRequest"
ADD COLUMN "topicHash" TEXT;

-- Create composite index for efficient duplicate detection
CREATE INDEX "CallbackRequest_customerPhone_topicHash_requestedAt_idx"
ON "CallbackRequest"("customerPhone", "topicHash", "requestedAt");

-- Update existing records with computed hash (if needed)
-- Note: This is skipped since topicHash is nullable and will be populated on new callbacks
