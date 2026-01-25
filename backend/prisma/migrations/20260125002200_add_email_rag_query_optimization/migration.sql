-- Email RAG Query Optimization
-- Migration: Add indexes and constraints for retrieval performance
-- Date: 2026-01-24

-- ============================================
-- 1. Add composite index for RAG retrieval query
-- ============================================
-- This index optimizes the most common retrieval pattern:
-- WHERE businessId = X AND direction = 'OUTBOUND' AND intent = Y ORDER BY sentAt DESC

CREATE INDEX IF NOT EXISTS "EmailEmbedding_retrieval_idx"
ON "EmailEmbedding" ("businessId", "direction", "intent", "sentAt" DESC)
WHERE "direction" = 'OUTBOUND';

-- ============================================
-- 2. Add index for language-based filtering
-- ============================================
CREATE INDEX IF NOT EXISTS "EmailEmbedding_language_idx"
ON "EmailEmbedding" ("businessId", "language", "sentAt" DESC)
WHERE "direction" = 'OUTBOUND';

-- ============================================
-- 3. Add index for content hash (deduplication)
-- ============================================
CREATE INDEX IF NOT EXISTS "EmailEmbedding_content_hash_idx"
ON "EmailEmbedding" ("businessId", "contentHash");

-- ============================================
-- 4. Set statement_timeout for retrieval queries
-- ============================================
-- Note: This is set at connection level in Prisma client
-- Default: 2000ms (2 seconds) - matches MAX_RETRIEVAL_TIME_MS
-- Application code should use: SET LOCAL statement_timeout = '2s';

COMMENT ON INDEX "EmailEmbedding_retrieval_idx" IS 'Composite index for RAG retrieval: businessId + direction + intent + sentAt DESC. Partial index on OUTBOUND only.';
COMMENT ON INDEX "EmailEmbedding_language_idx" IS 'Language-based retrieval index for multi-language businesses.';
COMMENT ON INDEX "EmailEmbedding_content_hash_idx" IS 'Deduplication index for preventing duplicate embeddings.';

-- ============================================
-- 5. Add table statistics comment
-- ============================================
COMMENT ON TABLE "EmailEmbedding" IS 'Email embeddings for RAG. Expected scale: 10K-1M rows per business. Query timeout: 2s. Indexes: retrieval_idx (primary), language_idx, content_hash_idx.';
