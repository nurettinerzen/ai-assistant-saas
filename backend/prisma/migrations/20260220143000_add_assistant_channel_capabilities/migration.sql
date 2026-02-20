-- Chat-capable assistant routing support
ALTER TABLE "Business"
  ADD COLUMN IF NOT EXISTS "chatAssistantId" TEXT;

CREATE INDEX IF NOT EXISTS "Business_chatAssistantId_idx"
  ON "Business"("chatAssistantId");

ALTER TABLE "Assistant"
  ADD COLUMN IF NOT EXISTS "channelCapabilities" TEXT[] NOT NULL DEFAULT ARRAY['phone_outbound'];

-- Inbound assistants can also handle chat/whatsapp/email channels.
UPDATE "Assistant"
SET "channelCapabilities" = ARRAY['phone_inbound', 'chat', 'whatsapp', 'email']
WHERE "callDirection" = 'inbound';

-- Existing outbound assistants remain outbound-only by default.
UPDATE "Assistant"
SET "channelCapabilities" = ARRAY['phone_outbound']
WHERE "callDirection" LIKE 'outbound%';

-- Legacy/manual chat assistants can serve chat-capable channels.
UPDATE "Assistant"
SET "channelCapabilities" = ARRAY['chat', 'whatsapp', 'email']
WHERE "callDirection" = 'chat';

UPDATE "Assistant"
SET "channelCapabilities" = ARRAY['phone_outbound']
WHERE "channelCapabilities" IS NULL
   OR cardinality("channelCapabilities") = 0;
