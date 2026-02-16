-- Add customerEmail to CrmOrder table
-- This allows email-based customer matching in addition to phone-based resolution

ALTER TABLE "CrmOrder" ADD COLUMN "customerEmail" TEXT;

-- Index for email-based lookups
CREATE INDEX "CrmOrder_businessId_customerEmail_idx" ON "CrmOrder"("businessId", "customerEmail");
