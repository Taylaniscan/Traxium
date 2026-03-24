CREATE TYPE "OrganizationRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED');

CREATE TABLE "OrganizationMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "OrganizationRole" NOT NULL DEFAULT 'MEMBER',
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationMembership_userId_organizationId_key"
ON "OrganizationMembership"("userId", "organizationId");

CREATE INDEX "OrganizationMembership_userId_idx"
ON "OrganizationMembership"("userId");

CREATE INDEX "OrganizationMembership_organizationId_idx"
ON "OrganizationMembership"("organizationId");

CREATE INDEX "OrganizationMembership_organizationId_role_idx"
ON "OrganizationMembership"("organizationId", "role");

CREATE INDEX "OrganizationMembership_organizationId_status_idx"
ON "OrganizationMembership"("organizationId", "status");

ALTER TABLE "OrganizationMembership"
ADD CONSTRAINT "OrganizationMembership_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganizationMembership"
ADD CONSTRAINT "OrganizationMembership_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "OrganizationMembership" (
    "id",
    "userId",
    "organizationId",
    "role",
    "status",
    "createdAt",
    "updatedAt"
)
SELECT
    'membership_' || md5("id" || ':' || "organizationId"),
    "id",
    "organizationId",
    CASE
        WHEN "role" IN ('HEAD_OF_GLOBAL_PROCUREMENT', 'GLOBAL_CATEGORY_LEADER', 'FINANCIAL_CONTROLLER')
            THEN 'ADMIN'::"OrganizationRole"
        ELSE 'MEMBER'::"OrganizationRole"
    END,
    'ACTIVE'::"MembershipStatus",
    "createdAt",
    "updatedAt"
FROM "User"
ON CONFLICT ("userId", "organizationId") DO NOTHING;
