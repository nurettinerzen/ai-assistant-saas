-- BusinessAuditLog Model for P1
-- Tracks team management and security events

CREATE TABLE "BusinessAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    "action" TEXT NOT NULL,
    "actorUserId" INTEGER,
    "businessId" INTEGER NOT NULL,
    "targetUserId" INTEGER,
    "targetEmail" TEXT,
    "metadata" TEXT, -- JSON
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BusinessAuditLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BusinessAuditLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "BusinessAuditLog_businessId_idx" ON "BusinessAuditLog"("businessId");
CREATE INDEX "BusinessAuditLog_actorUserId_idx" ON "BusinessAuditLog"("actorUserId");
CREATE INDEX "BusinessAuditLog_action_idx" ON "BusinessAuditLog"("action");
CREATE INDEX "BusinessAuditLog_createdAt_idx" ON "BusinessAuditLog"("createdAt");
