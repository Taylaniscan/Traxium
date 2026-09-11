ALTER TABLE "Notification"
ADD COLUMN "organizationId" TEXT,
ADD COLUMN "href" TEXT;

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_organizationId_fkey"
FOREIGN KEY ("organizationId")
REFERENCES "Organization"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

CREATE INDEX "Notification_userId_readAt_createdAt_idx"
ON "Notification"("userId", "readAt", "createdAt");

CREATE INDEX "Notification_organizationId_userId_createdAt_idx"
ON "Notification"("organizationId", "userId", "createdAt");
