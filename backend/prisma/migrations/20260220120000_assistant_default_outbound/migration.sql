-- V1 outbound-only: assistant default direction should be outbound
ALTER TABLE "Assistant"
  ALTER COLUMN "callDirection" SET DEFAULT 'outbound';
