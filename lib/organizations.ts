import { Prisma } from "@prisma/client";
import type { MembershipStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  ActiveOrganizationContext,
  ActiveTenantContext,
  TenantContext,
  TenantContextSource,
} from "@/lib/types";

const activeMembershipSelect = {
  id: true,
  organizationId: true,
  role: true,
  status: true,
} satisfies Prisma.OrganizationMembershipSelect;

const ACTIVE_MEMBERSHIP_STATUS: MembershipStatus = "ACTIVE";

const activeOrganizationContextUserSelect = {
  activeOrganizationId: true,
  memberships: {
    where: {
      status: ACTIVE_MEMBERSHIP_STATUS,
    },
    select: activeMembershipSelect,
    orderBy: [{ createdAt: "asc" as const }, { organizationId: "asc" as const }],
  },
} satisfies Prisma.UserSelect;

type ActiveOrganizationContextUser = Prisma.UserGetPayload<{
  select: typeof activeOrganizationContextUserSelect;
}>;

type ActiveMembershipRecord = ActiveOrganizationContextUser["memberships"][number];

function normalizeOrganizationId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function hasActiveTenantContext(
  context: TenantContextSource
): context is ActiveTenantContext {
  return typeof context !== "string" && "activeOrganization" in context;
}

function mapActiveMembershipContext(
  membership: ActiveMembershipRecord
): ActiveOrganizationContext {
  return {
    membershipId: membership.id,
    organizationId: membership.organizationId,
    membershipRole: membership.role,
    membershipStatus: membership.status,
  };
}

function getActiveMembership(
  user: ActiveOrganizationContextUser
): ActiveMembershipRecord | null {
  const activeOrganizationId = normalizeOrganizationId(user.activeOrganizationId);

  if (!activeOrganizationId) {
    return null;
  }

  return (
    user.memberships.find(
      (membership) => membership.organizationId === activeOrganizationId
    ) ?? null
  );
}

export function resolveTenantContext(
  context: TenantContextSource
): TenantContext {
  if (typeof context === "string") {
    const organizationId = normalizeOrganizationId(context);

    if (!organizationId) {
      throw new Error("Organization context is required.");
    }

    return { organizationId };
  }

  if (hasActiveTenantContext(context)) {
    const organizationId =
      normalizeOrganizationId(context.activeOrganization.organizationId) ??
      normalizeOrganizationId(context.activeOrganizationId) ??
      normalizeOrganizationId(context.organizationId);

    if (!organizationId) {
      throw new Error("Organization context is required.");
    }

    return { organizationId };
  }

  const organizationId = normalizeOrganizationId(context.organizationId);

  if (!organizationId) {
    throw new Error("Organization context is required.");
  }

  return { organizationId };
}

export function buildOrganizationUserWhere(
  context: TenantContextSource,
  where: Prisma.UserWhereInput = {}
): Prisma.UserWhereInput {
  const { organizationId } = resolveTenantContext(context);

  return {
    ...where,
    memberships: {
      some: {
        organizationId,
        status: ACTIVE_MEMBERSHIP_STATUS,
      },
    },
  };
}

export async function getActiveOrganizationContext(
  userId: string
): Promise<ActiveTenantContext> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: activeOrganizationContextUserSelect,
  });

  if (!user) {
    throw new Error("User not found.");
  }

  const activeMembership = getActiveMembership(user);

  if (!activeMembership) {
    throw new Error("Active organization membership is required.");
  }

  return {
    organizationId: activeMembership.organizationId,
    activeOrganizationId: activeMembership.organizationId,
    activeOrganization: mapActiveMembershipContext(activeMembership),
  };
}
