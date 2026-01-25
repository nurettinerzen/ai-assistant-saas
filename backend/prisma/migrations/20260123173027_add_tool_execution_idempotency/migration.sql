-- CreateTable
CREATE TABLE "ToolExecution" (
    "id" TEXT NOT NULL,
    "businessId" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "data" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ToolExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ToolExecution_businessId_idx" ON "ToolExecution"("businessId");

-- CreateIndex
CREATE INDEX "ToolExecution_expiresAt_idx" ON "ToolExecution"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ToolExecution_businessId_channel_messageId_toolName_key" ON "ToolExecution"("businessId", "channel", "messageId", "toolName");
