-- AlterTable
ALTER TABLE "AuditLog"
  ADD COLUMN IF NOT EXISTS "actorUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "targetUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "targetEntityId" TEXT,
  ADD COLUMN IF NOT EXISTS "eventType" TEXT,
  ADD COLUMN IF NOT EXISTS "payload" JSONB;

-- Backfill existing actor identifiers for legacy audit rows that already used userId as the actor.
UPDATE "AuditLog"
SET "actorUserId" = "userId"
WHERE "actorUserId" IS NULL
  AND "userId" IS NOT NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_organizationId_eventType_createdAt_idx"
  ON "AuditLog"("organizationId", "eventType", "createdAt");

CREATE INDEX IF NOT EXISTS "AuditLog_organizationId_actorUserId_idx"
  ON "AuditLog"("organizationId", "actorUserId");

CREATE INDEX IF NOT EXISTS "AuditLog_organizationId_targetUserId_idx"
  ON "AuditLog"("organizationId", "targetUserId");

CREATE INDEX IF NOT EXISTS "AuditLog_organizationId_targetEntityId_idx"
  ON "AuditLog"("organizationId", "targetEntityId");
