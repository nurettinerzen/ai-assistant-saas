-- Idempotent schema safety for assistantType + voiceId across old environments.
ALTER TABLE "Assistant"
  ADD COLUMN IF NOT EXISTS "assistantType" TEXT;

ALTER TABLE "Assistant"
  ADD COLUMN IF NOT EXISTS "voiceId" TEXT;

ALTER TABLE "Assistant"
  ALTER COLUMN "voiceId" DROP NOT NULL;

-- Backfill legacy direction-based rows.
UPDATE "Assistant"
SET "assistantType" = CASE
  WHEN "callDirection" IN ('chat', 'whatsapp', 'email') THEN 'text'
  ELSE 'phone'
END
WHERE "assistantType" IS NULL;

UPDATE "Assistant"
SET "assistantType" = 'text'
WHERE "assistantType" <> 'text'
  AND "callDirection" IN ('chat', 'whatsapp', 'email');

-- Text assistants should not keep voice values.
UPDATE "Assistant"
SET "voiceId" = NULL
WHERE "assistantType" = 'text'
  AND "voiceId" IS NOT NULL;

ALTER TABLE "Assistant"
  ALTER COLUMN "assistantType" SET DEFAULT 'phone';

UPDATE "Assistant"
SET "assistantType" = 'phone'
WHERE "assistantType" IS NULL;

ALTER TABLE "Assistant"
  ALTER COLUMN "assistantType" SET NOT NULL;
