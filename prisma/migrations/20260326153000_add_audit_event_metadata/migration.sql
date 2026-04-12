-- AlterTable
ALTER TABLE "AuditLog"
  ADD COLUMN IF NOT EXISTS "organizationId" TEXT,
  ADD COLUMN IF NOT EXISTS "actorUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "targetUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "targetEntityId" TEXT,
  ADD COLUMN IF NOT EXISTS "eventType" TEXT,
  ADD COLUMN IF NOT EXISTS "payload" JSONB;

-- Backfill organization identifiers from the saving card whenever possible.
UPDATE "AuditLog" AS audit_log
SET "organizationId" = saving_card."organizationId"
FROM "SavingCard" AS saving_card
WHERE audit_log."organizationId" IS NULL
  AND audit_log."savingCardId" IS NOT NULL
  AND saving_card."id" = audit_log."savingCardId";

-- Fall back to the legacy actor user organization when the audit row was not tied to a saving card.
UPDATE "AuditLog" AS audit_log
SET "organizationId" = actor_user."organizationId"
FROM "User" AS actor_user
WHERE audit_log."organizationId" IS NULL
  AND audit_log."userId" IS NOT NULL
  AND actor_user."id" = audit_log."userId";

-- Backfill existing actor identifiers for legacy audit rows that already used userId as the actor.
UPDATE "AuditLog"
SET "actorUserId" = "userId"
WHERE "actorUserId" IS NULL
  AND "userId" IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "pg_constraint"
    WHERE "conname" = 'AuditLog_organizationId_fkey'
  ) THEN
    ALTER TABLE "AuditLog"
    ADD CONSTRAINT "AuditLog_organizationId_fkey"
    FOREIGN KEY ("organizationId")
    REFERENCES "Organization"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_organizationId_eventType_createdAt_idx"
  ON "AuditLog"("organizationId", "eventType", "createdAt");

CREATE INDEX IF NOT EXISTS "AuditLog_organizationId_actorUserId_idx"
  ON "AuditLog"("organizationId", "actorUserId");

CREATE INDEX IF NOT EXISTS "AuditLog_organizationId_targetUserId_idx"
  ON "AuditLog"("organizationId", "targetUserId");

CREATE INDEX IF NOT EXISTS "AuditLog_organizationId_targetEntityId_idx"
  ON "AuditLog"("organizationId", "targetEntityId");
