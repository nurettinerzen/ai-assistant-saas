-- ============================================================================
-- OAUTH STATE MANAGEMENT (CSRF Protection)
-- Migration: Add OAuthState table for secure OAuth callbacks
-- ============================================================================

CREATE TABLE IF NOT EXISTS "OAuthState" (
  "id" SERIAL PRIMARY KEY,
  "state" TEXT NOT NULL UNIQUE,
  "businessId" INTEGER NOT NULL,
  "provider" TEXT NOT NULL,
  "metadata" JSONB,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OAuthState_businessId_fkey"
    FOREIGN KEY ("businessId")
    REFERENCES "Business"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "OAuthState_state_idx" ON "OAuthState"("state");
CREATE INDEX IF NOT EXISTS "OAuthState_businessId_provider_idx" ON "OAuthState"("businessId", "provider");
CREATE INDEX IF NOT EXISTS "OAuthState_expiresAt_idx" ON "OAuthState"("expiresAt");

-- Comments for documentation
COMMENT ON TABLE "OAuthState" IS 'OAuth state tokens for CSRF protection on OAuth callbacks';
COMMENT ON COLUMN "OAuthState"."state" IS 'Cryptographically random 64-char hex token';
COMMENT ON COLUMN "OAuthState"."provider" IS 'OAuth provider: google, microsoft, hubspot, etc.';
COMMENT ON COLUMN "OAuthState"."metadata" IS 'Additional context: redirectUrl, integrationId, etc.';
COMMENT ON COLUMN "OAuthState"."expiresAt" IS '10-minute expiry for state tokens';
