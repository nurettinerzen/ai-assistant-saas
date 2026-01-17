-- Migration: Remove unique constraint on CustomerData (businessId, phone)
-- Allows same customer to have multiple records (e.g., different orders, debts)

-- Drop the unique constraint (if exists as constraint)
ALTER TABLE "CustomerData" DROP CONSTRAINT IF EXISTS "CustomerData_businessId_phone_key";

-- Drop the unique index (Prisma creates it as index, not constraint)
DROP INDEX IF EXISTS "CustomerData_businessId_phone_key";
