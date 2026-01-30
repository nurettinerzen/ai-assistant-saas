-- Add orderNo field to CustomerData table (for order matching in verification)
ALTER TABLE "CustomerData" ADD COLUMN "orderNo" TEXT;

-- Add crmVersion field to Business table (for cache invalidation on CRM changes)
ALTER TABLE "Business" ADD COLUMN "crmVersion" INTEGER NOT NULL DEFAULT 0;
