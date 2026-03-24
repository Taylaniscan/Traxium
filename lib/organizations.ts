import { Prisma } from "@prisma/client";
import type { MembershipStatus, OrganizationRole } from "@prisma/client";
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
const ADMIN_ORGANIZATION_ROLE: OrganizationRole = "ADMIN";
const OWNER_ORGANIZATION_ROLE: OrganizationRole = "OWNER";

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

type OrganizationWriteClient = Prisma.TransactionClient;

export class WorkspaceOnboardingError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 = 400
  ) {
    super(message);
    this.name = "WorkspaceOnboardingError";
  }
}

export type InitialWorkspaceResult = {
  organization: {
    id: string;
    name: string;
    slug: string;
    createdAt: Date;
    updatedAt: Date;
  };
  membership: {
    id: string;
    organizationId: string;
    role: OrganizationRole;
    status: MembershipStatus;
    createdAt: Date;
    updatedAt: Date;
  };
  activeOrganizationId: string;
};

export function canManageOrganizationMembers(role: OrganizationRole) {
  return role === OWNER_ORGANIZATION_ROLE || role === ADMIN_ORGANIZATION_ROLE;
}

export function canAssignOrganizationRole(
  actorRole: OrganizationRole,
  targetRole: OrganizationRole
) {
  if (!canManageOrganizationMembers(actorRole)) {
    return false;
  }

  if (targetRole === OWNER_ORGANIZATION_ROLE) {
    return actorRole === OWNER_ORGANIZATION_ROLE;
  }

  return true;
}

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

function normalizeWorkspaceName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function slugifyWorkspaceName(value: string) {
  const slug = normalizeWorkspaceName(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || "workspace";
}

async function createUniqueOrganizationSlug(
  tx: OrganizationWriteClient,
  workspaceName: string
) {
  const baseSlug = slugifyWorkspaceName(workspaceName);
  const existingOrganizations = await tx.organization.findMany({
    where: {
      slug: {
        startsWith: baseSlug,
      },
    },
    select: {
      slug: true,
    },
  });

  const existingSlugs = new Set(existingOrganizations.map((organization) => organization.slug));

  if (!existingSlugs.has(baseSlug)) {
    return baseSlug;
  }

  let suffix = 2;

  while (existingSlugs.has(`${baseSlug}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseSlug}-${suffix}`;
}

export async function createInitialWorkspaceForUser(
  userId: string,
  workspaceName: string
): Promise<InitialWorkspaceResult> {
  const normalizedWorkspaceName = normalizeWorkspaceName(workspaceName);

  if (!normalizedWorkspaceName) {
    throw new WorkspaceOnboardingError("Workspace name is required.", 400);
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        memberships: {
          select: {
            id: true,
          },
          take: 1,
        },
      },
    });

    if (!user) {
      throw new WorkspaceOnboardingError("User not found.", 404);
    }

    if (user.memberships.length > 0) {
      throw new WorkspaceOnboardingError(
        "Initial workspace onboarding is already complete for this account.",
        409
      );
    }

    const slug = await createUniqueOrganizationSlug(tx, normalizedWorkspaceName);

    const organization = await tx.organization.create({
      data: {
        name: normalizedWorkspaceName,
        slug,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const membership = await tx.organizationMembership.create({
      data: {
        userId,
        organizationId: organization.id,
        role: OWNER_ORGANIZATION_ROLE,
        status: ACTIVE_MEMBERSHIP_STATUS,
      },
      select: {
        id: true,
        organizationId: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        organizationId: organization.id,
        activeOrganizationId: organization.id,
      },
    });

    return {
      organization,
      membership,
      activeOrganizationId: organization.id,
    };
  });
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
