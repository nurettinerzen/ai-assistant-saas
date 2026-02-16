-- PHONE OUTBOUND V1: Do Not Call persistence
CREATE TABLE IF NOT EXISTS "DoNotCall" (
  "id" TEXT NOT NULL,
  "businessId" INTEGER NOT NULL,
  "phoneE164" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'PHONE_OUTBOUND_V1',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DoNotCall_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DoNotCall_businessId_phoneE164_key"
  ON "DoNotCall"("businessId", "phoneE164");

CREATE INDEX IF NOT EXISTS "DoNotCall_businessId_idx"
  ON "DoNotCall"("businessId");

CREATE INDEX IF NOT EXISTS "DoNotCall_phoneE164_idx"
  ON "DoNotCall"("phoneE164");

CREATE INDEX IF NOT EXISTS "DoNotCall_createdAt_idx"
  ON "DoNotCall"("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'DoNotCall_businessId_fkey'
  ) THEN
    ALTER TABLE "DoNotCall"
      ADD CONSTRAINT "DoNotCall_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
