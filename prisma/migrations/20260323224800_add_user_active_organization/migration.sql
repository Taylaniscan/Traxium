ALTER TABLE "User"
ADD COLUMN "activeOrganizationId" TEXT;

UPDATE "User"
SET "activeOrganizationId" = "organizationId"
WHERE "activeOrganizationId" IS NULL;

CREATE INDEX "User_activeOrganizationId_idx"
ON "User"("activeOrganizationId");

ALTER TABLE "User"
ADD CONSTRAINT "User_activeOrganizationId_fkey"
FOREIGN KEY ("activeOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
