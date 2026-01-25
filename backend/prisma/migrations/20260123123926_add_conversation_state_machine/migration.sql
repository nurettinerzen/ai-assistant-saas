-- CreateTable
CREATE TABLE "SessionMapping" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "businessId" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "channelUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationState" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "businessId" INTEGER NOT NULL,
    "state" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SessionMapping_sessionId_key" ON "SessionMapping"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionMapping_businessId_channel_channelUserId_key" ON "SessionMapping"("businessId", "channel", "channelUserId");

-- CreateIndex
CREATE INDEX "SessionMapping_sessionId_idx" ON "SessionMapping"("sessionId");

-- CreateIndex
CREATE INDEX "SessionMapping_businessId_channel_idx" ON "SessionMapping"("businessId", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationState_sessionId_key" ON "ConversationState"("sessionId");

-- CreateIndex
CREATE INDEX "ConversationState_businessId_idx" ON "ConversationState"("businessId");

-- CreateIndex
CREATE INDEX "ConversationState_expiresAt_idx" ON "ConversationState"("expiresAt");
