-- Session revocation support on User
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- Admin MFA challenge table (OTP step-up)
CREATE TABLE IF NOT EXISTS "AdminMfaChallenge" (
  "id" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "adminEmail" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AdminMfaChallenge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AdminMfaChallenge_adminId_expiresAt_idx" ON "AdminMfaChallenge"("adminId", "expiresAt");
CREATE INDEX IF NOT EXISTS "AdminMfaChallenge_adminEmail_expiresAt_idx" ON "AdminMfaChallenge"("adminEmail", "expiresAt");
CREATE INDEX IF NOT EXISTS "AdminMfaChallenge_userId_createdAt_idx" ON "AdminMfaChallenge"("userId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AdminMfaChallenge_adminId_fkey'
  ) THEN
    ALTER TABLE "AdminMfaChallenge"
    ADD CONSTRAINT "AdminMfaChallenge_adminId_fkey"
    FOREIGN KEY ("adminId")
    REFERENCES "AdminUser"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END $$;
