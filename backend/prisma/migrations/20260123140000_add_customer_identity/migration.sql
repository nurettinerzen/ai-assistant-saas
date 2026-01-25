-- CreateTable
CREATE TABLE "CustomerIdentity" (
    "id" TEXT NOT NULL,
    "businessId" INTEGER NOT NULL,
    "primaryPhone" TEXT NOT NULL,
    "primaryEmail" TEXT,
    "displayName" TEXT NOT NULL,
    "externalRefs" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerIdentity_businessId_primaryPhone_key" ON "CustomerIdentity"("businessId", "primaryPhone");

-- CreateIndex
CREATE INDEX "CustomerIdentity_businessId_idx" ON "CustomerIdentity"("businessId");

-- CreateIndex
CREATE INDEX "CustomerIdentity_primaryPhone_idx" ON "CustomerIdentity"("primaryPhone");

-- CreateIndex
CREATE INDEX "CustomerIdentity_primaryEmail_idx" ON "CustomerIdentity"("primaryEmail");
