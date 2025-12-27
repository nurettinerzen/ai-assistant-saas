-- Add concurrent call limit fields to Subscription table
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "concurrentLimit" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "activeCalls" INTEGER NOT NULL DEFAULT 0;

-- Add new plan values to SubscriptionPlan enum
-- Note: PostgreSQL requires recreating the enum for new values
-- This is a safe migration that adds the values if they don't exist

DO $$
BEGIN
    -- Add STARTER if not exists
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'STARTER' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'SubscriptionPlan')) THEN
        ALTER TYPE "SubscriptionPlan" ADD VALUE 'STARTER';
    END IF;

    -- Add PRO if not exists
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PRO' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'SubscriptionPlan')) THEN
        ALTER TYPE "SubscriptionPlan" ADD VALUE 'PRO';
    END IF;
END $$;

-- Set default concurrent limits based on existing plans
UPDATE "Subscription" SET "concurrentLimit" = 0 WHERE "plan" = 'FREE';
UPDATE "Subscription" SET "concurrentLimit" = 1 WHERE "plan" IN ('STARTER', 'BASIC');
UPDATE "Subscription" SET "concurrentLimit" = 3 WHERE "plan" = 'PROFESSIONAL';
UPDATE "Subscription" SET "concurrentLimit" = 5 WHERE "plan" = 'PRO';
UPDATE "Subscription" SET "concurrentLimit" = 10 WHERE "plan" = 'ENTERPRISE';

-- Reset all active calls to 0 (cleanup any stale data)
UPDATE "Subscription" SET "activeCalls" = 0;
