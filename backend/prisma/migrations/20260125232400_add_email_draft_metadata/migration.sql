-- AlterTable: Add metadata field to EmailDraft
ALTER TABLE "EmailDraft" ADD COLUMN "metadata" JSONB;

-- Comment
COMMENT ON COLUMN "EmailDraft"."metadata" IS 'Draft generation metadata: classification, tools called, guardrails, RAG metrics';
