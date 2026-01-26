-- Create composite index only (column already exists)
CREATE INDEX IF NOT EXISTS "CallbackRequest_customerPhone_topicHash_requestedAt_idx"
ON "CallbackRequest"("customerPhone", "topicHash", "requestedAt");
