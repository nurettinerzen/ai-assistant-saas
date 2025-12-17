-- Add onboardingCompleted column to User table
-- Run this migration manually on your database

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false;

-- Update existing users who have completed onboarding (optional - based on your logic)
-- For example, if you want to mark all existing users as having completed onboarding:
-- UPDATE "User" SET "onboardingCompleted" = true WHERE "createdAt" < NOW();
