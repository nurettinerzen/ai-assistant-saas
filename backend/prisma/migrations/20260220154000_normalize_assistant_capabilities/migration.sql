-- Normalize assistant channel capabilities to prevent text/phone cross-channel bleed.
ALTER TABLE "Assistant"
  ADD COLUMN IF NOT EXISTS "channelCapabilities" TEXT[] NOT NULL DEFAULT ARRAY['phone_outbound'];

-- Phone assistants should only carry phone capabilities.
UPDATE "Assistant" AS a
SET "channelCapabilities" = COALESCE(
  NULLIF(
    ARRAY(
      SELECT DISTINCT cap
      FROM unnest(COALESCE(a."channelCapabilities", ARRAY['phone_outbound']::TEXT[])) AS cap
      WHERE cap IN ('phone_outbound', 'phone_inbound')
    ),
    ARRAY[]::TEXT[]
  ),
  ARRAY['phone_outbound']::TEXT[]
)
WHERE a."assistantType" = 'phone';

-- Text assistants should only carry chat capabilities.
UPDATE "Assistant" AS a
SET "channelCapabilities" = COALESCE(
  NULLIF(
    ARRAY(
      SELECT DISTINCT cap
      FROM unnest(COALESCE(a."channelCapabilities", ARRAY['chat', 'whatsapp', 'email']::TEXT[])) AS cap
      WHERE cap IN ('chat', 'whatsapp', 'email')
    ),
    ARRAY[]::TEXT[]
  ),
  ARRAY['chat', 'whatsapp', 'email']::TEXT[]
)
WHERE a."assistantType" = 'text';
