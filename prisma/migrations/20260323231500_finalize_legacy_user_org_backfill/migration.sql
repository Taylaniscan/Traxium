COMMENT ON COLUMN "User"."organizationId" IS
'DEPRECATED: legacy single-organization backfill source. Do not use for tenant resolution.';

CREATE OR REPLACE FUNCTION "resolveLegacyOrganizationMembershipRole"(user_role "Role")
RETURNS "OrganizationRole"
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE
    WHEN user_role IN (
      'HEAD_OF_GLOBAL_PROCUREMENT',
      'GLOBAL_CATEGORY_LEADER',
      'FINANCIAL_CONTROLLER'
    ) THEN 'ADMIN'::"OrganizationRole"
    ELSE 'MEMBER'::"OrganizationRole"
  END
$$;

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
  "resolveLegacyOrganizationMembershipRole"("role"),
  'ACTIVE'::"MembershipStatus",
  "createdAt",
  "updatedAt"
FROM "User"
ON CONFLICT ("userId", "organizationId") DO NOTHING;

WITH "rankedActiveMemberships" AS (
  SELECT
    membership."userId",
    membership."organizationId",
    ROW_NUMBER() OVER (
      PARTITION BY membership."userId"
      ORDER BY membership."createdAt" ASC, membership."organizationId" ASC
    ) AS "position"
  FROM "OrganizationMembership" AS membership
  WHERE membership."status" = 'ACTIVE'
),
"preferredActiveOrganizations" AS (
  SELECT
    user_record."id" AS "userId",
    COALESCE(
      current_membership."organizationId",
      legacy_membership."organizationId",
      first_membership."organizationId"
    ) AS "organizationId"
  FROM "User" AS user_record
  LEFT JOIN "rankedActiveMemberships" AS current_membership
    ON current_membership."userId" = user_record."id"
   AND current_membership."organizationId" = user_record."activeOrganizationId"
  LEFT JOIN "rankedActiveMemberships" AS legacy_membership
    ON legacy_membership."userId" = user_record."id"
   AND legacy_membership."organizationId" = user_record."organizationId"
  LEFT JOIN "rankedActiveMemberships" AS first_membership
    ON first_membership."userId" = user_record."id"
   AND first_membership."position" = 1
)
UPDATE "User" AS user_record
SET "activeOrganizationId" = preferred."organizationId"
FROM "preferredActiveOrganizations" AS preferred
WHERE user_record."id" = preferred."userId"
  AND preferred."organizationId" IS NOT NULL
  AND user_record."activeOrganizationId" IS DISTINCT FROM preferred."organizationId";

CREATE OR REPLACE FUNCTION "syncLegacyUserMembershipAfterWrite"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."organizationId" IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO "OrganizationMembership" (
    "id",
    "userId",
    "organizationId",
    "role",
    "status",
    "createdAt",
    "updatedAt"
  )
  VALUES (
    'membership_' || md5(NEW."id" || ':' || NEW."organizationId"),
    NEW."id",
    NEW."organizationId",
    "resolveLegacyOrganizationMembershipRole"(NEW."role"),
    'ACTIVE'::"MembershipStatus",
    COALESCE(NEW."createdAt", CURRENT_TIMESTAMP),
    COALESCE(NEW."updatedAt", CURRENT_TIMESTAMP)
  )
  ON CONFLICT ("userId", "organizationId") DO NOTHING;

  IF NEW."activeOrganizationId" IS NULL THEN
    UPDATE "User"
    SET "activeOrganizationId" = NEW."organizationId"
    WHERE "id" = NEW."id"
      AND "activeOrganizationId" IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "User_sync_legacy_membership_after_write" ON "User";

CREATE TRIGGER "User_sync_legacy_membership_after_write"
AFTER INSERT OR UPDATE OF "organizationId", "role"
ON "User"
FOR EACH ROW
EXECUTE FUNCTION "syncLegacyUserMembershipAfterWrite"();
