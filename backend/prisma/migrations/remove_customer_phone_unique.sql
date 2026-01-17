-- Migration: Remove unique constraint on CustomerData (businessId, phone)
-- Allows same customer to have multiple records (e.g., different orders, debts)

-- Drop the unique constraint
ALTER TABLE "CustomerData" DROP CONSTRAINT IF EXISTS "CustomerData_businessId_phone_key";

-- The index will be recreated by Prisma as a regular index
-- CREATE INDEX IF NOT EXISTS "CustomerData_businessId_phone_idx" ON "CustomerData"("businessId", "phone");
