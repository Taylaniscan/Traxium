import { MembershipStatus, OrganizationRole, Role } from "@prisma/client";

const adminRoles = new Set<Role>([
  Role.HEAD_OF_GLOBAL_PROCUREMENT,
  Role.GLOBAL_CATEGORY_LEADER,
  Role.FINANCIAL_CONTROLLER,
]);

export type ExistingMembershipSnapshot = {
  organizationId: string;
  status: MembershipStatus;
  createdAt?: Date;
};

export type LegacyUserBackfillSource = {
  id: string;
  role: Role;
  organizationId?: string | null;
  activeOrganizationId?: string | null;
  memberships: ExistingMembershipSnapshot[];
};

export type LegacyMembershipBackfillRow = {
  userId: string;
  organizationId: string;
  role: OrganizationRole;
  status: MembershipStatus;
};

export type LegacyUserBackfillResult = {
  membershipRows: LegacyMembershipBackfillRow[];
  activeOrganizationId: string | null;
};

function normalizeOrganizationId(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function sortMembershipsByAge(
  memberships: ExistingMembershipSnapshot[]
): ExistingMembershipSnapshot[] {
  return [...memberships].sort((left, right) => {
    const leftTime = left.createdAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const rightTime = right.createdAt?.getTime() ?? Number.MAX_SAFE_INTEGER;

    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }

    return left.organizationId.localeCompare(right.organizationId);
  });
}

function hasMembership(
  memberships: ExistingMembershipSnapshot[],
  organizationId: string
) {
  return memberships.some(
    (membership) => membership.organizationId === organizationId
  );
}

function getActiveMembershipOrganizationIds(
  memberships: ExistingMembershipSnapshot[]
) {
  return sortMembershipsByAge(
    memberships.filter((membership) => membership.status === MembershipStatus.ACTIVE)
  ).map((membership) => membership.organizationId);
}

export function resolveLegacyMembershipRole(role: Role): OrganizationRole {
  return adminRoles.has(role) ? OrganizationRole.ADMIN : OrganizationRole.MEMBER;
}

export function buildLegacyMembershipRows(
  user: LegacyUserBackfillSource
): LegacyMembershipBackfillRow[] {
  const legacyOrganizationId = normalizeOrganizationId(user.organizationId);

  if (!legacyOrganizationId || hasMembership(user.memberships, legacyOrganizationId)) {
    return [];
  }

  return [
    {
      userId: user.id,
      organizationId: legacyOrganizationId,
      role: resolveLegacyMembershipRole(user.role),
      status: MembershipStatus.ACTIVE,
    },
  ];
}

export function resolveBackfilledActiveOrganizationId(
  user: LegacyUserBackfillSource
): string | null {
  const membershipRows = buildLegacyMembershipRows(user);
  const memberships = [
    ...user.memberships,
    ...membershipRows.map((membership) => ({
      organizationId: membership.organizationId,
      status: membership.status,
    })),
  ];
  const activeMembershipOrganizationIds = getActiveMembershipOrganizationIds(memberships);
  const currentActiveOrganizationId = normalizeOrganizationId(user.activeOrganizationId);

  if (
    currentActiveOrganizationId &&
    activeMembershipOrganizationIds.includes(currentActiveOrganizationId)
  ) {
    return currentActiveOrganizationId;
  }

  const legacyOrganizationId = normalizeOrganizationId(user.organizationId);

  if (
    legacyOrganizationId &&
    activeMembershipOrganizationIds.includes(legacyOrganizationId)
  ) {
    return legacyOrganizationId;
  }

  return activeMembershipOrganizationIds[0] ?? null;
}

export function buildLegacyUserBackfill(
  user: LegacyUserBackfillSource
): LegacyUserBackfillResult {
  const membershipRows = buildLegacyMembershipRows(user);

  return {
    membershipRows,
    activeOrganizationId: resolveBackfilledActiveOrganizationId(user),
  };
}
