import { Prisma, Role } from "@prisma/client";
import type {
  InvitationStatus,
  MembershipStatus,
  OrganizationRole,
} from "@prisma/client";
import {
  auditEventTypes,
  listAuditEventsForOrganization,
  type OrganizationAuditEvent,
  writeAuditEvent,
} from "@/lib/audit";
import { analyticsEventNames, trackEvent } from "@/lib/analytics";
import { getScopedCachedValue } from "@/lib/cache";
import { isDevelopmentEnvironment } from "@/lib/env";
import { writeStructuredLog } from "@/lib/logger";
import { captureException } from "@/lib/observability";
import { prisma } from "@/lib/prisma";
import type {
  ActiveOrganizationContext,
  AuthenticatedUser,
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
const DEFAULT_FIRST_LOGIN_USER_ROLE: Role = "TACTICAL_BUYER";
const DEFAULT_WORKSPACE_TRIAL_DAYS = 14;

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

const workspaceMembershipOrganizationSelect = {
  id: true,
  name: true,
  slug: true,
  createdAt: true,
  updatedAt: true,
} as const;

const initialWorkspaceUserSelect = {
  activeOrganizationId: true,
  memberships: {
    where: {
      status: ACTIVE_MEMBERSHIP_STATUS,
    },
    select: {
      id: true,
      organizationId: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      organization: {
        select: workspaceMembershipOrganizationSelect,
      },
    },
    orderBy: [{ createdAt: "asc" as const }, { organizationId: "asc" as const }],
  },
} satisfies Prisma.UserSelect;

const organizationMembershipMutationSelect = {
  id: true,
  userId: true,
  organizationId: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
    },
  },
} satisfies Prisma.OrganizationMembershipSelect;

const organizationMembersDirectorySelect = {
  id: true,
  userId: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      name: true,
      email: true,
      createdAt: true,
    },
  },
} satisfies Prisma.OrganizationMembershipSelect;

const pendingInvitationDirectorySelect = {
  id: true,
  email: true,
  role: true,
  status: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
  invitedBy: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} satisfies Prisma.InvitationSelect;

const organizationSettingsSelect = {
  id: true,
  name: true,
  description: true,
  slug: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OrganizationSelect;

type ActiveOrganizationContextUser = Prisma.UserGetPayload<{
  select: typeof activeOrganizationContextUserSelect;
}>;

type ActiveMembershipRecord = ActiveOrganizationContextUser["memberships"][number];
type InitialWorkspaceUserRecord = Prisma.UserGetPayload<{
  select: typeof initialWorkspaceUserSelect;
}>;
type InitialWorkspaceMembershipRecord = InitialWorkspaceUserRecord["memberships"][number];
type OrganizationMembershipMutationRecord = Prisma.OrganizationMembershipGetPayload<{
  select: typeof organizationMembershipMutationSelect;
}>;
type OrganizationMembersDirectoryRecord = Prisma.OrganizationMembershipGetPayload<{
  select: typeof organizationMembersDirectorySelect;
}>;
type PendingInvitationDirectoryRecord = Prisma.InvitationGetPayload<{
  select: typeof pendingInvitationDirectorySelect;
}>;
type OrganizationSettingsRecord = Prisma.OrganizationGetPayload<{
  select: typeof organizationSettingsSelect;
}>;

type OrganizationWriteClient = Prisma.TransactionClient;

const MEMBERS_DIRECTORY_CACHE_TTL_MS = 2_000;
const ADMIN_AUDIT_EVENTS_CACHE_TTL_MS = 1_500;

export class WorkspaceOnboardingError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 = 400
  ) {
    super(message);
    this.name = "WorkspaceOnboardingError";
  }
}

export class OrganizationMembershipRoleUpdateError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 | 422 = 400
  ) {
    super(message);
    this.name = "OrganizationMembershipRoleUpdateError";
  }
}

export class OrganizationMembershipRemovalError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 | 422 = 400
  ) {
    super(message);
    this.name = "OrganizationMembershipRemovalError";
  }
}

export class OrganizationSettingsError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 | 422 = 400
  ) {
    super(message);
    this.name = "OrganizationSettingsError";
  }
}

export type InitialWorkspaceResult = {
  created: boolean;
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

export type InitialWorkspaceProvisioningResult = InitialWorkspaceResult & {
  userId: string;
};

export type OrganizationDirectoryMember = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: OrganizationRole;
  membershipStatus: MembershipStatus;
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type OrganizationDirectoryPendingInvite = {
  id: string;
  email: string;
  role: OrganizationRole;
  inviteStatus: InvitationStatus;
  invitedAt: Date;
  expiresAt: Date;
  updatedAt: Date;
  invitedBy: {
    id: string;
    name: string;
    email: string;
  };
};

export type OrganizationMembersDirectory = {
  members: OrganizationDirectoryMember[];
  pendingInvites: OrganizationDirectoryPendingInvite[];
};

export type OrganizationMembershipRoleUpdateResult = {
  changed: boolean;
  membership: OrganizationDirectoryMember;
};

export type OrganizationMembershipRemovalResult = {
  membership: OrganizationDirectoryMember;
};

export type OrganizationSettingsSummary = {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
};

export type OrganizationAdminAuditEvent = OrganizationAuditEvent;

export type OrganizationSettingsUpdateResult = {
  changed: boolean;
  organization: OrganizationSettingsSummary;
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

async function createInitialOrganization(
  tx: OrganizationWriteClient,
  workspaceName: string,
  workspaceDescription?: string | null
) {
  const slug = await createUniqueOrganizationSlug(tx, workspaceName);
  const shouldPersistWorkspaceTrialEnd = await canPersistWorkspaceTrialEnd(tx);
  const description = normalizeOrganizationDescription(workspaceDescription);
  const organizationCreateData: {
    name: string;
    slug: string;
    description?: string;
    workspaceTrialEndsAt?: Date;
  } = {
    name: workspaceName,
    slug,
  };

  if (description) {
    organizationCreateData.description = description;
  }

  if (shouldPersistWorkspaceTrialEnd) {
    const workspaceTrialEndsAt = new Date();
    workspaceTrialEndsAt.setDate(
      workspaceTrialEndsAt.getDate() + DEFAULT_WORKSPACE_TRIAL_DAYS
    );
    organizationCreateData.workspaceTrialEndsAt = workspaceTrialEndsAt;
  } else {
    if (isDevelopmentEnvironment()) {
      writeStructuredLog("warn", {
        event: "workspace.onboarding.workspace_trial_fallback_used",
        message:
          "workspaceTrialEndsAt is not available in the current development database yet. Creating the workspace without the trial column.",
        payload: {
          fallback: "organization_create_without_workspace_trial_ends_at_preflight",
          workspaceSlug: slug,
        },
      });
    }
  }

  return tx.organization.create({
    data: organizationCreateData,
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

async function canPersistWorkspaceTrialEnd(tx: OrganizationWriteClient) {
  if (!isDevelopmentEnvironment()) {
    return true;
  }

  if (
    (await tx.$queryRaw<Array<{ exists: boolean }>>(Prisma.sql`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'Organization'
          AND column_name = 'workspaceTrialEndsAt'
      ) AS "exists"
    `))[0]?.exists
  ) {
    return true;
  }

  return false;
}

async function createInitialOwnerMembership(
  tx: OrganizationWriteClient,
  userId: string,
  organizationId: string
) {
  return tx.organizationMembership.upsert({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
    update: {
      role: OWNER_ORGANIZATION_ROLE,
      status: ACTIVE_MEMBERSHIP_STATUS,
    },
    create: {
      userId,
      organizationId,
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
}

function getPreferredInitialWorkspaceMembership(
  user: InitialWorkspaceUserRecord
): InitialWorkspaceMembershipRecord | null {
  const activeOrganizationId = normalizeOrganizationId(user.activeOrganizationId);

  if (activeOrganizationId) {
    const activeMembership = user.memberships.find(
      (membership) => membership.organizationId === activeOrganizationId
    );

    if (activeMembership) {
      return activeMembership;
    }
  }

  return user.memberships[0] ?? null;
}

function mapInitialWorkspaceResult(
  membership: InitialWorkspaceMembershipRecord
): InitialWorkspaceResult {
  return {
    created: false,
    organization: membership.organization,
    membership: {
      id: membership.id,
      organizationId: membership.organizationId,
      role: membership.role,
      status: membership.status,
      createdAt: membership.createdAt,
      updatedAt: membership.updatedAt,
    },
    activeOrganizationId: membership.organizationId,
  };
}

function mapOrganizationDirectoryMember(
  membership: OrganizationMembersDirectoryRecord | OrganizationMembershipMutationRecord
): OrganizationDirectoryMember {
  return {
    id: membership.id,
    userId: membership.userId,
    name: membership.user.name,
    email: membership.user.email,
    role: membership.role,
    membershipStatus: membership.status,
    joinedAt: membership.createdAt,
    createdAt: membership.user.createdAt,
    updatedAt: membership.updatedAt,
  };
}

function mapPendingInvitationDirectoryRecord(
  invitation: PendingInvitationDirectoryRecord
): OrganizationDirectoryPendingInvite {
  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    inviteStatus: invitation.status,
    invitedAt: invitation.createdAt,
    expiresAt: invitation.expiresAt,
    updatedAt: invitation.updatedAt,
    invitedBy: invitation.invitedBy,
  };
}

function mapOrganizationSettings(
  organization: OrganizationSettingsRecord
): OrganizationSettingsSummary {
  return {
    id: organization.id,
    name: organization.name,
    description: organization.description,
    slug: organization.slug,
    createdAt: organization.createdAt,
    updatedAt: organization.updatedAt,
  };
}

function formatOrganizationRoleLabel(role: OrganizationRole) {
  return role
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeOrganizationDescription(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized ? normalized : null;
}

function captureWorkspaceOnboardingStepFailure(input: {
  event:
    | "onboarding.workspace.user_lookup_failed"
    | "onboarding.workspace.organization_create_failed"
    | "onboarding.workspace.membership_create_failed"
    | "onboarding.workspace.user_update_failed"
    | "onboarding.workspace.audit_write_failed"
    | "onboarding.workspace.first_login_user_create_failed";
  error: unknown;
  userId?: string;
  organizationId?: string;
  payload?: Record<string, unknown>;
}) {
  captureException(input.error, {
    event: input.event,
    userId: input.userId ?? null,
    organizationId: input.organizationId ?? null,
    payload: {
      workflow: "initial_workspace_onboarding",
      ...input.payload,
    },
  });
}

export async function createInitialWorkspaceForUser(
  userId: string,
  workspaceName: string,
  workspaceDescription?: string | null
): Promise<InitialWorkspaceResult> {
  const normalizedWorkspaceName = normalizeWorkspaceName(workspaceName);

  if (!normalizedWorkspaceName) {
    throw new WorkspaceOnboardingError("Workspace name is required.", 400);
  }

  return prisma.$transaction(async (tx) => {
    let user: InitialWorkspaceUserRecord | null;

    try {
      user = await tx.user.findUnique({
        where: { id: userId },
        select: initialWorkspaceUserSelect,
      });
    } catch (error) {
      captureWorkspaceOnboardingStepFailure({
        event: "onboarding.workspace.user_lookup_failed",
        error,
        userId,
        payload: {
          flow: "existing_user",
          workspaceName: normalizedWorkspaceName,
        },
      });
      throw error;
    }

    if (!user) {
      throw new WorkspaceOnboardingError("User not found.", 404);
    }

    const existingMembership = getPreferredInitialWorkspaceMembership(user);

    if (existingMembership) {
      return mapInitialWorkspaceResult(existingMembership);
    }

    let organization: Awaited<ReturnType<typeof createInitialOrganization>>;

    try {
      organization = await createInitialOrganization(
        tx,
        normalizedWorkspaceName,
        workspaceDescription
      );
    } catch (error) {
      captureWorkspaceOnboardingStepFailure({
        event: "onboarding.workspace.organization_create_failed",
        error,
        userId,
        payload: {
          flow: "existing_user",
          workspaceName: normalizedWorkspaceName,
        },
      });
      throw error;
    }

    let membership: Awaited<ReturnType<typeof createInitialOwnerMembership>>;

    try {
      membership = await createInitialOwnerMembership(tx, userId, organization.id);
    } catch (error) {
      captureWorkspaceOnboardingStepFailure({
        event: "onboarding.workspace.membership_create_failed",
        error,
        userId,
        organizationId: organization.id,
        payload: {
          flow: "existing_user",
          workspaceName: normalizedWorkspaceName,
        },
      });
      throw error;
    }

    try {
      await tx.user.update({
        where: { id: userId },
        data: {
          organizationId: organization.id,
          activeOrganizationId: organization.id,
        },
      });
    } catch (error) {
      captureWorkspaceOnboardingStepFailure({
        event: "onboarding.workspace.user_update_failed",
        error,
        userId,
        organizationId: organization.id,
        payload: {
          flow: "existing_user",
          workspaceName: normalizedWorkspaceName,
        },
      });
      throw error;
    }

    try {
      await writeAuditEvent(tx, {
        organizationId: organization.id,
        actorUserId: userId,
        targetUserId: userId,
        targetEntityId: organization.id,
        eventType: auditEventTypes.ONBOARDING_WORKSPACE_CREATED,
        detail: `Workspace ${organization.name} was created.`,
        payload: {
          membershipRole: OWNER_ORGANIZATION_ROLE,
          organizationSlug: organization.slug,
        },
      });
    } catch (error) {
      captureWorkspaceOnboardingStepFailure({
        event: "onboarding.workspace.audit_write_failed",
        error,
        userId,
        organizationId: organization.id,
        payload: {
          flow: "existing_user",
          workspaceName: normalizedWorkspaceName,
        },
      });
      throw error;
    }

    return {
      created: true,
      organization,
      membership,
      activeOrganizationId: organization.id,
    };
  });
}

export async function createInitialWorkspaceForAuthenticatedUser(
  input: {
    name: string;
    email: string;
    role?: Role;
    workspaceName: string;
    workspaceDescription?: string | null;
  }
): Promise<InitialWorkspaceProvisioningResult> {
  const normalizedWorkspaceName = normalizeWorkspaceName(input.workspaceName);
  const normalizedName = input.name.trim();
  const normalizedEmail = input.email.trim().toLowerCase();

  if (!normalizedWorkspaceName) {
    throw new WorkspaceOnboardingError("Workspace name is required.", 400);
  }

  if (!normalizedName) {
    throw new WorkspaceOnboardingError("User name is required.", 400);
  }

  if (!normalizedEmail) {
    throw new WorkspaceOnboardingError("User email is required.", 400);
  }

  return prisma.$transaction(async (tx) => {
    let organization: Awaited<ReturnType<typeof createInitialOrganization>>;

    try {
      organization = await createInitialOrganization(
        tx,
        normalizedWorkspaceName,
        input.workspaceDescription
      );
    } catch (error) {
      captureWorkspaceOnboardingStepFailure({
        event: "onboarding.workspace.organization_create_failed",
        error,
        payload: {
          flow: "first_login",
          workspaceName: normalizedWorkspaceName,
          email: normalizedEmail,
        },
      });
      throw error;
    }

    let user: { id: string };

    try {
      user = await tx.user.create({
        data: {
          organizationId: organization.id,
          activeOrganizationId: organization.id,
          name: normalizedName,
          email: normalizedEmail,
          role: input.role ?? DEFAULT_FIRST_LOGIN_USER_ROLE,
        },
        select: {
          id: true,
        },
      });
    } catch (error) {
      captureWorkspaceOnboardingStepFailure({
        event: "onboarding.workspace.first_login_user_create_failed",
        error,
        organizationId: organization.id,
        payload: {
          flow: "first_login",
          workspaceName: normalizedWorkspaceName,
          email: normalizedEmail,
        },
      });
      throw error;
    }

    let membership: Awaited<ReturnType<typeof createInitialOwnerMembership>>;

    try {
      membership = await createInitialOwnerMembership(tx, user.id, organization.id);
    } catch (error) {
      captureWorkspaceOnboardingStepFailure({
        event: "onboarding.workspace.membership_create_failed",
        error,
        userId: user.id,
        organizationId: organization.id,
        payload: {
          flow: "first_login",
          workspaceName: normalizedWorkspaceName,
          email: normalizedEmail,
        },
      });
      throw error;
    }

    try {
      await writeAuditEvent(tx, {
        organizationId: organization.id,
        actorUserId: user.id,
        targetUserId: user.id,
        targetEntityId: organization.id,
        eventType: auditEventTypes.ONBOARDING_WORKSPACE_CREATED,
        detail: `Workspace ${organization.name} was created.`,
        payload: {
          membershipRole: OWNER_ORGANIZATION_ROLE,
          organizationSlug: organization.slug,
        },
      });
    } catch (error) {
      captureWorkspaceOnboardingStepFailure({
        event: "onboarding.workspace.audit_write_failed",
        error,
        userId: user.id,
        organizationId: organization.id,
        payload: {
          flow: "first_login",
          workspaceName: normalizedWorkspaceName,
          email: normalizedEmail,
        },
      });
      throw error;
    }

    return {
      created: true,
      userId: user.id,
      organization,
      membership,
      activeOrganizationId: organization.id,
    };
  });
}

export async function getOrganizationMembersDirectory(
  organizationId: string
): Promise<OrganizationMembersDirectory> {
  const normalizedOrganizationId = normalizeOrganizationId(organizationId);

  if (!normalizedOrganizationId) {
    throw new Error("Organization context is required.");
  }

  return getScopedCachedValue(
    {
      namespace: "organization-members-directory",
      organizationId: normalizedOrganizationId,
      ttlMs: MEMBERS_DIRECTORY_CACHE_TTL_MS,
    },
    async () => {
      const [memberships, pendingInvitations] = await Promise.all([
        prisma.organizationMembership.findMany({
          where: {
            organizationId: normalizedOrganizationId,
          },
          select: organizationMembersDirectorySelect,
          orderBy: [
            { status: "asc" },
            { role: "asc" },
            { createdAt: "asc" },
          ],
        }),
        prisma.invitation.findMany({
          where: {
            organizationId: normalizedOrganizationId,
            status: "PENDING",
          },
          select: pendingInvitationDirectorySelect,
          orderBy: [{ createdAt: "desc" }],
        }),
      ]);

      return {
        members: memberships.map(mapOrganizationDirectoryMember),
        pendingInvites: pendingInvitations.map(mapPendingInvitationDirectoryRecord),
      };
    }
  );
}

export async function getOrganizationSettings(
  organizationId: string
): Promise<OrganizationSettingsSummary> {
  const normalizedOrganizationId = normalizeOrganizationId(organizationId);

  if (!normalizedOrganizationId) {
    throw new OrganizationSettingsError("Organization context is required.", 422);
  }

  const organization = await prisma.organization.findUnique({
    where: {
      id: normalizedOrganizationId,
    },
    select: organizationSettingsSelect,
  });

  if (!organization) {
    throw new OrganizationSettingsError("Organization not found.", 404);
  }

  return mapOrganizationSettings(organization);
}

export async function updateOrganizationSettings(input: {
  actor: AuthenticatedUser;
  name: string;
  description?: string | null;
}): Promise<OrganizationSettingsUpdateResult> {
  const organizationId = normalizeOrganizationId(
    input.actor.activeOrganization.organizationId
  );
  const actorRole = input.actor.activeOrganization.membershipRole;
  const nextName = input.name.trim();
  const nextDescription = normalizeOrganizationDescription(input.description);

  if (!organizationId) {
    throw new OrganizationSettingsError("Organization context is required.", 422);
  }

  if (!canManageOrganizationMembers(actorRole)) {
    throw new OrganizationSettingsError("Forbidden.", 403);
  }

  if (!nextName) {
    throw new OrganizationSettingsError("Workspace name is required.", 422);
  }

  return prisma.$transaction(async (tx) => {
    const organization = await tx.organization.findUnique({
      where: {
        id: organizationId,
      },
      select: organizationSettingsSelect,
    });

    if (!organization) {
      throw new OrganizationSettingsError("Organization not found.", 404);
    }

    if (
      organization.name === nextName &&
      normalizeOrganizationDescription(organization.description) === nextDescription
    ) {
      return {
        changed: false,
        organization: mapOrganizationSettings(organization),
      };
    }

    const updatedOrganization = await tx.organization.update({
      where: {
        id: organizationId,
      },
      data: {
        name: nextName,
        description: nextDescription,
      },
      select: organizationSettingsSelect,
    });

    await writeAuditEvent(tx, {
      organizationId,
      actorUserId: input.actor.id,
      targetEntityId: updatedOrganization.id,
      eventType: auditEventTypes.WORKSPACE_UPDATED,
      detail: `Workspace settings updated for ${updatedOrganization.name}.`,
      payload: {
        changedFields: [
          ...(organization.name !== nextName ? ["name"] : []),
          ...(
            normalizeOrganizationDescription(organization.description) !== nextDescription
              ? ["description"]
              : []
          ),
        ],
      },
    });

    return {
      changed: true,
      organization: mapOrganizationSettings(updatedOrganization),
    };
  });
}

export async function getOrganizationAdminAuditEvents(
  organizationId: string,
  take = 20
): Promise<OrganizationAdminAuditEvent[]> {
  const normalizedOrganizationId = normalizeOrganizationId(organizationId);

  if (!normalizedOrganizationId) {
    throw new Error("Organization context is required.");
  }

  return getScopedCachedValue(
    {
      namespace: "organization-admin-audit-events",
      organizationId: normalizedOrganizationId,
      key: `take:${take}`,
      ttlMs: ADMIN_AUDIT_EVENTS_CACHE_TTL_MS,
    },
    () => listAuditEventsForOrganization(normalizedOrganizationId, take)
  );
}

export async function updateOrganizationMembershipRole(input: {
  actor: AuthenticatedUser;
  membershipId: string;
  nextRole: OrganizationRole;
}): Promise<OrganizationMembershipRoleUpdateResult> {
  const membershipId = input.membershipId.trim();
  const activeOrganizationId = normalizeOrganizationId(
    input.actor.activeOrganization.organizationId
  );
  const actorRole = input.actor.activeOrganization.membershipRole;

  if (!membershipId) {
    throw new OrganizationMembershipRoleUpdateError("Membership id is required.", 422);
  }

  if (!activeOrganizationId) {
    throw new OrganizationMembershipRoleUpdateError(
      "Organization context is required.",
      422
    );
  }

  if (!canManageOrganizationMembers(actorRole)) {
    throw new OrganizationMembershipRoleUpdateError("Forbidden.", 403);
  }

  let previousRole: OrganizationRole | null = null;
  let targetUserId: string | null = null;
  let targetMembershipId: string | null = null;

  const result = await prisma.$transaction(async (tx) => {
    const membership = await tx.organizationMembership.findUnique({
      where: {
        id: membershipId,
      },
      select: organizationMembershipMutationSelect,
    });

    if (!membership || membership.organizationId !== activeOrganizationId) {
      throw new OrganizationMembershipRoleUpdateError(
        "Member not found in the active organization.",
        404
      );
    }

    if (membership.id === input.actor.activeOrganization.membershipId) {
      if (membership.role === input.nextRole) {
        return {
          changed: false,
          membership: mapOrganizationDirectoryMember(membership),
        };
      }

      throw new OrganizationMembershipRoleUpdateError(
        "Change another owner or admin before modifying your own role.",
        409
      );
    }

    if (
      actorRole !== OWNER_ORGANIZATION_ROLE &&
      membership.role === OWNER_ORGANIZATION_ROLE
    ) {
      throw new OrganizationMembershipRoleUpdateError(
        "Only workspace owners can change owner access.",
        403
      );
    }

    if (!canAssignOrganizationRole(actorRole, input.nextRole)) {
      throw new OrganizationMembershipRoleUpdateError(
        `You cannot assign the ${formatOrganizationRoleLabel(input.nextRole)} role.`,
        403
      );
    }

    if (membership.role === input.nextRole) {
      return {
        changed: false,
        membership: mapOrganizationDirectoryMember(membership),
      };
    }

    if (
      membership.role === OWNER_ORGANIZATION_ROLE &&
      input.nextRole !== OWNER_ORGANIZATION_ROLE
    ) {
      const ownerCount = await tx.organizationMembership.count({
        where: {
          organizationId: activeOrganizationId,
          role: OWNER_ORGANIZATION_ROLE,
          status: ACTIVE_MEMBERSHIP_STATUS,
        },
      });

      if (ownerCount <= 1) {
        throw new OrganizationMembershipRoleUpdateError(
          "The last active owner cannot be reassigned. Add another owner first.",
          409
        );
      }
    }

    const updatedMembership = await tx.organizationMembership.update({
      where: {
        id: membership.id,
      },
      data: {
        role: input.nextRole,
      },
      select: organizationMembershipMutationSelect,
    });

    previousRole = membership.role;
    targetUserId = membership.userId;
    targetMembershipId = membership.id;

    await writeAuditEvent(tx, {
      organizationId: activeOrganizationId,
      actorUserId: input.actor.id,
      targetUserId: membership.userId,
      targetEntityId: membership.id,
      eventType: auditEventTypes.MEMBER_ROLE_CHANGED,
      detail: `Changed ${updatedMembership.user.name} from ${formatOrganizationRoleLabel(membership.role)} to ${formatOrganizationRoleLabel(updatedMembership.role)}.`,
      payload: {
        membershipId: membership.id,
        previousRole: membership.role,
        nextRole: updatedMembership.role,
      },
    });

    return {
      changed: true,
      membership: mapOrganizationDirectoryMember(updatedMembership),
    };
  });

  if (result.changed) {
    await trackEvent({
      event: analyticsEventNames.ADMIN_MEMBER_ROLE_CHANGED,
      organizationId: activeOrganizationId,
      userId: input.actor.id,
      properties: {
        membershipId: targetMembershipId,
        targetUserId,
        previousRole,
        nextRole: result.membership.role,
      },
    });
  }

  return result;
}

export async function removeOrganizationMembership(input: {
  actor: AuthenticatedUser;
  membershipId: string;
}): Promise<OrganizationMembershipRemovalResult> {
  const membershipId = input.membershipId.trim();
  const activeOrganizationId = normalizeOrganizationId(
    input.actor.activeOrganization.organizationId
  );
  const actorRole = input.actor.activeOrganization.membershipRole;

  if (!membershipId) {
    throw new OrganizationMembershipRemovalError("Membership id is required.", 422);
  }

  if (!activeOrganizationId) {
    throw new OrganizationMembershipRemovalError(
      "Organization context is required.",
      422
    );
  }

  if (!canManageOrganizationMembers(actorRole)) {
    throw new OrganizationMembershipRemovalError("Forbidden.", 403);
  }

  return prisma.$transaction(async (tx) => {
    const membership = await tx.organizationMembership.findUnique({
      where: {
        id: membershipId,
      },
      select: organizationMembershipMutationSelect,
    });

    if (!membership || membership.organizationId !== activeOrganizationId) {
      throw new OrganizationMembershipRemovalError(
        "Member not found in the active organization.",
        404
      );
    }

    if (membership.id === input.actor.activeOrganization.membershipId) {
      throw new OrganizationMembershipRemovalError(
        "You cannot remove your own membership from this screen.",
        409
      );
    }

    if (
      actorRole !== OWNER_ORGANIZATION_ROLE &&
      membership.role === OWNER_ORGANIZATION_ROLE
    ) {
      throw new OrganizationMembershipRemovalError(
        "Only workspace owners can remove another owner.",
        403
      );
    }

    if (membership.role === OWNER_ORGANIZATION_ROLE) {
      const ownerCount = await tx.organizationMembership.count({
        where: {
          organizationId: activeOrganizationId,
          role: OWNER_ORGANIZATION_ROLE,
          status: ACTIVE_MEMBERSHIP_STATUS,
        },
      });

      if (ownerCount <= 1) {
        throw new OrganizationMembershipRemovalError(
          "The last active owner cannot be removed. Add another owner first.",
          409
        );
      }
    }

    const memberContext = await tx.user.findUnique({
      where: {
        id: membership.userId,
      },
      select: {
        activeOrganizationId: true,
        memberships: {
          where: {
            status: ACTIVE_MEMBERSHIP_STATUS,
          },
          select: {
            organizationId: true,
          },
          orderBy: [{ createdAt: "asc" as const }, { organizationId: "asc" as const }],
        },
      },
    });

    await tx.organizationMembership.delete({
      where: {
        id: membership.id,
      },
    });

    if (memberContext?.activeOrganizationId === activeOrganizationId) {
      const nextActiveOrganizationId =
        memberContext.memberships
          .map((item) => item.organizationId)
          .find((organizationId) => organizationId !== activeOrganizationId) ?? null;

      await tx.user.update({
        where: {
          id: membership.userId,
        },
        data: {
          activeOrganizationId: nextActiveOrganizationId,
        },
      });
    }

    await writeAuditEvent(tx, {
      organizationId: activeOrganizationId,
      actorUserId: input.actor.id,
      targetUserId: membership.userId,
      targetEntityId: membership.id,
      eventType: auditEventTypes.MEMBER_REMOVED,
      detail: `Removed ${membership.user.name} from the workspace.`,
      payload: {
        membershipId: membership.id,
        removedRole: membership.role,
      },
    });

    return {
      membership: mapOrganizationDirectoryMember(membership),
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
