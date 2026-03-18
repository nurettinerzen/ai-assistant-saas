-- CreateTable
CREATE TABLE "WhatsappEmbeddedSignupSession" (
    "id" TEXT NOT NULL,
    "businessId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "configId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sessionInfo" JSONB,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappEmbeddedSignupSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhatsappEmbeddedSignupSession_businessId_status_idx" ON "WhatsappEmbeddedSignupSession"("businessId", "status");

-- CreateIndex
CREATE INDEX "WhatsappEmbeddedSignupSession_userId_status_idx" ON "WhatsappEmbeddedSignupSession"("userId", "status");

-- CreateIndex
CREATE INDEX "WhatsappEmbeddedSignupSession_expiresAt_idx" ON "WhatsappEmbeddedSignupSession"("expiresAt");

-- AddForeignKey
ALTER TABLE "WhatsappEmbeddedSignupSession"
ADD CONSTRAINT "WhatsappEmbeddedSignupSession_businessId_fkey"
FOREIGN KEY ("businessId") REFERENCES "Business"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappEmbeddedSignupSession"
ADD CONSTRAINT "WhatsappEmbeddedSignupSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
