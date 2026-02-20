-- Add business-level inbound toggle and onboarding completion timestamp
ALTER TABLE "Business"
  ADD COLUMN IF NOT EXISTS "phoneInboundEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Business"
  ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" TIMESTAMP(3);
