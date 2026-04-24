import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";
import type { MembershipStatus, OrganizationRole } from "@prisma/client";

import {
  acceptOrganizationInvitation,
  type InvitationAcceptanceResult,
} from "@/lib/invitations";
import { analyticsEventNames, trackEvent } from "@/lib/analytics";
import {
  getOrganizationAccessState,
  type OrganizationAccessStateResult,
} from "@/lib/billing/access";
import { prisma } from "@/lib/prisma";
import {
  createInitialWorkspaceForAuthenticatedUser,
  createInitialWorkspaceForUser,
} from "@/lib/organizations";
import { resolveLegacyMembershipRole } from "@/lib/organization-membership-backfill";
import { hasAnyRole, hasPermission } from "@/lib/permissions";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  AppPermission,
  AuthenticatedUser,
  AuthFailureCode,
  AuthGuardOptions,
} from "@/lib/types";

const ACTIVE_MEMBERSHIP_STATUS: MembershipStatus = "ACTIVE";

const sessionUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  organizationId: true,
  activeOrganizationId: true,
} satisfies Prisma.UserSelect;

type BaseSessionUserRecord = Prisma.UserGetPayload<{
  select: typeof sessionUserSelect;
}>;

type SessionMembershipRecord = {
  id: string;
  organizationId: string;
  role: OrganizationRole;
  status: MembershipStatus;
};

type SessionUserRecord = BaseSessionUserRecord & {
  memberships?: SessionMembershipRecord[] | null;
};

export type SessionUser = AuthenticatedUser;

type AuthSessionUser = {
  id: string;
  email?: string | null;
  app_metadata?: unknown;
  user_metadata?: unknown;
};

type AuthenticatedAppUserResult =
  | {
      ok: true;
      authUser: AuthSessionUser;
      email: string;
      name: string;
      user: SessionUserRecord | null;
    }
  | {
      ok: false;
      code: "UNAUTHENTICATED" | "AMBIGUOUS_USER";
      message: string;
    };

export type SessionBootstrapResult =
  | {
      ok: true;
      repaired: boolean;
      user: SessionUser;
    }
  | {
      ok: false;
      code:
        | "UNAUTHENTICATED"
        | "AMBIGUOUS_USER"
        | "ORGANIZATION_ACCESS_REQUIRED"
        | "BILLING_REQUIRED"
        | "SESSION_REPAIR_FAILED";
      message: string;
      accessState?: OrganizationAccessStateResult;
    };

export type WorkspaceOnboardingStateResult =
  | {
      ok: true;
      needsWorkspace: boolean;
      user: {
        id: string;
        name: string;
        email: string;
      };
    }
  | {
      ok: false;
      code: "UNAUTHENTICATED" | "AMBIGUOUS_USER";
      message: string;
    };

export type WorkspaceOnboardingResult = {
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
    role: SessionUser["activeOrganization"]["membershipRole"];
    status: SessionUser["activeOrganization"]["membershipStatus"];
    createdAt: Date;
    updatedAt: Date;
  };
  activeOrganizationId: string;
  user: SessionUser;
};

export class AuthGuardError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 402 | 403,
    readonly code: AuthFailureCode,
    readonly accessState?: OrganizationAccessStateResult
  ) {
    super(message);
    this.name = "AuthGuardError";
  }
}

export function isAuthGuardError(error: unknown): error is AuthGuardError {
  return error instanceof AuthGuardError;
}

export function createAuthGuardErrorResponse(error: unknown) {
  if (!isAuthGuardError(error)) {
    return null;
  }

  if (error.code === "BILLING_REQUIRED") {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        accessState: error.accessState?.accessState ?? null,
        reasonCode: error.accessState?.reasonCode ?? null,
        billingRequiredPath: "/billing-required",
      },
      { status: error.status }
    );
  }

  return NextResponse.json(
    {
      error: error.code === "FORBIDDEN" ? "Forbidden." : "Unauthorized.",
    },
    { status: error.status }
  );
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function normalizeEmail(value: unknown): string | null {
  const normalized = normalizeString(value);
  return normalized ? normalized.toLowerCase() : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function readMetadataValue(source: unknown, keys: readonly string[]): string | null {
  const record = asRecord(source);

  for (const key of keys) {
    const value = normalizeString(record[key]);

    if (value) {
      return value;
    }
  }

  return null;
}

function startCase(value: string) {
  return value
    .split(/[\s._-]+/u)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function resolveSessionDisplayName(authUser: AuthSessionUser, email: string) {
  const metadataName = readMetadataValue(authUser.user_metadata, [
    "name",
    "full_name",
    "display_name",
    "preferred_name",
  ]);

  if (metadataName) {
    return metadataName;
  }

  const localPart = email.split("@")[0]?.trim() ?? "";
  return startCase(localPart) || email;
}

function getAuthUserId(authUser: AuthSessionUser): string | null {
  return readMetadataValue(authUser.app_metadata, ["userId", "user_id"]);
}

function getAuthActiveOrganizationId(authUser: AuthSessionUser): string | null {
  return readMetadataValue(authUser.app_metadata, [
    "activeOrganizationId",
    "active_organization_id",
    "organizationId",
    "organization_id",
  ]);
}

async function getAuthenticatedSessionUser(): Promise<AuthSessionUser | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
    error,
  } = await supabase.auth.getUser();

  if (error || !authUser) {
    return null;
  }

  return authUser as AuthSessionUser;
}

async function resolveAuthenticatedAppUserFromAuthUser(
  authUser: AuthSessionUser
): Promise<AuthenticatedAppUserResult> {
  const email = normalizeEmail(authUser.email);

  if (!email) {
    return {
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authenticated session is missing an email address.",
    };
  }

  const authUserId = getAuthUserId(authUser);

  if (authUserId) {
    const user = await findSessionUserById(authUserId);

    if (user && hasMatchingSessionEmail(user, email)) {
      return {
        ok: true,
        authUser,
        email,
        name: user.name,
        user,
      };
    }
  }

  const candidates = await findSessionUsersByEmail(email);

  if (candidates.length > 1) {
    return {
      ok: false,
      code: "AMBIGUOUS_USER",
      message:
        "Your account matches multiple Traxium users. Contact an administrator to complete workspace consolidation.",
    };
  }

  return {
    ok: true,
    authUser,
    email,
    name: candidates[0]?.name ?? resolveSessionDisplayName(authUser, email),
    user: candidates[0] ?? null,
  };
}

async function findSessionUserById(userId: string): Promise<SessionUserRecord | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: sessionUserSelect,
  });
}

async function findSessionUsersByEmail(email: string): Promise<SessionUserRecord[]> {
  return prisma.user.findMany({
    where: {
      email: {
        equals: email,
        mode: "insensitive",
      },
    },
    select: sessionUserSelect,
    orderBy: [{ id: "asc" }],
    take: 2,
  });
}

async function updateAuthSessionContext(
  authUser: AuthSessionUser,
  context: {
    userId: string;
    activeOrganizationId: string;
  }
) {
  const supabaseAdmin = createSupabaseAdminClient();
  const currentMetadata = asRecord(authUser.app_metadata);
  const {
    organizationId: _legacyOrganizationId,
    organization_id: _legacyOrganizationIdSnakeCase,
    ...nextMetadata
  } = currentMetadata;
  const { error } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
    app_metadata: {
      ...nextMetadata,
      userId: context.userId,
      activeOrganizationId: context.activeOrganizationId,
    },
  });

  if (error) {
    throw new Error(`Unable to update account workspace context: ${error.message}`);
  }
}

async function updateUserActiveOrganization(
  userId: string,
  organizationId: string
): Promise<SessionUserRecord> {
  return prisma.user.update({
    where: { id: userId },
    data: {
      activeOrganizationId: organizationId,
    },
    select: sessionUserSelect,
  });
}

function hasMatchingSessionEmail(user: SessionUserRecord, email: string) {
  return normalizeEmail(user.email) === email;
}

function getActiveMembership(user: SessionUserRecord): SessionMembershipRecord | null {
  const activeOrganizationId = normalizeString(user.activeOrganizationId);
  const memberships = getSessionMemberships(user);

  if (!activeOrganizationId) {
    return memberships[0] ?? null;
  }

  return (
    memberships.find(
      (membership) =>
        membership.organizationId === activeOrganizationId &&
        membership.status === ACTIVE_MEMBERSHIP_STATUS
    ) ??
    memberships[0] ??
    null
  );
}

function getMembershipByOrganizationId(
  user: SessionUserRecord,
  organizationId: string
): SessionMembershipRecord | null {
  const memberships = getSessionMemberships(user);

  return (
    memberships.find(
      (membership) =>
        membership.organizationId === organizationId &&
        membership.status === ACTIVE_MEMBERSHIP_STATUS
    ) ?? null
  );
}

function getPreferredActiveOrganizationId(user: SessionUserRecord): string | null {
  const activeMembership = getActiveMembership(user);
  const memberships = getSessionMemberships(user);

  if (activeMembership) {
    return activeMembership.organizationId;
  }

  return memberships[0]?.organizationId ?? null;
}

function getSessionMemberships(user: SessionUserRecord): SessionMembershipRecord[] {
  if (Array.isArray(user.memberships)) {
    return user.memberships.filter(
      (membership): membership is SessionMembershipRecord =>
        Boolean(
          normalizeString(membership.id) &&
          normalizeString(membership.organizationId) &&
          normalizeString(membership.role) &&
          normalizeString(membership.status)
        )
    );
  }

  const legacyOrganizationId = normalizeString(user.organizationId);

  if (!legacyOrganizationId) {
    return [];
  }

  return [
    {
      id: `legacy-membership-${user.id}-${legacyOrganizationId}`,
      organizationId: legacyOrganizationId,
      role: resolveLegacyMembershipRole(user.role),
      status: ACTIVE_MEMBERSHIP_STATUS,
    },
  ];
}

function mapSessionUser(
  user: SessionUserRecord,
  activeMembership: SessionMembershipRecord
): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    organizationId: activeMembership.organizationId,
    activeOrganizationId: activeMembership.organizationId,
    activeOrganization: {
      membershipId: activeMembership.id,
      organizationId: activeMembership.organizationId,
      membershipRole: activeMembership.role,
      membershipStatus: activeMembership.status,
    },
  };
}

function getBillingRequiredMessage(accessState: OrganizationAccessStateResult) {
  switch (accessState.reasonCode) {
    case "past_due_grace_period":
      return "Your workspace billing needs attention soon. Complete billing recovery to keep access uninterrupted.";
    case "past_due_blocked":
      return "Your workspace subscription is past due. Update billing before product access can continue.";
    case "unpaid":
      return "Your workspace subscription is unpaid. Resolve billing before product access can continue.";
    case "canceled":
      return "Your workspace subscription has been canceled. Reactivate billing before product access can continue.";
    case "paused":
      return "Your workspace subscription is paused. Resume billing before product access can continue.";
    case "incomplete":
    case "incomplete_expired":
    case "no_subscription":
      return "Your workspace does not have an active subscription yet. Complete billing setup before product access can continue.";
    case "trial_expired":
      return "Your workspace trial has ended. Start a subscription before product access can continue.";
    case "unknown":
      return "Your workspace billing state could not be verified safely. Complete billing recovery before product access can continue.";
    case "active":
    case "trialing":
    case "workspace_trial":
      return "Your workspace billing access is active.";
  }
}

async function assertBillingAccess(
  user: SessionUser,
  options: AuthGuardOptions = {}
) {
  if (options.allowBillingBlocked) {
    return user;
  }

  const accessState = await getOrganizationAccessState(
    user.activeOrganization.organizationId
  );

  if (!accessState.isBlocked) {
    return user;
  }

  if (options.billingRedirectTo !== null && options.redirectTo !== null) {
    redirect(options.billingRedirectTo ?? "/billing-required");
  }

  throw new AuthGuardError(
    getBillingRequiredMessage(accessState),
    402,
    "BILLING_REQUIRED",
    accessState
  );
}

async function resolveAuthenticatedAppUser(): Promise<AuthenticatedAppUserResult> {
  const authUser = await getAuthenticatedSessionUser();

  if (!authUser) {
    return {
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authenticated session is required.",
    };
  }

  return resolveAuthenticatedAppUserFromAuthUser(authUser);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const resolved = await resolveAuthenticatedAppUser();

  if (!resolved.ok || !resolved.user) {
    return null;
  }

  const activeMembership = getActiveMembership(resolved.user);

  if (!activeMembership) {
    return null;
  }

  return mapSessionUser(resolved.user, activeMembership);
}

export async function bootstrapCurrentUser(): Promise<SessionBootstrapResult> {
  const resolved = await resolveAuthenticatedAppUser();

  if (!resolved.ok) {
    return resolved;
  }

  return bootstrapResolvedAuthenticatedAppUser(resolved);
}

async function bootstrapResolvedAuthenticatedAppUser(
  resolved: Extract<AuthenticatedAppUserResult, { ok: true }>
): Promise<SessionBootstrapResult> {
  if (!resolved.user) {
    return {
      ok: false,
      code: "ORGANIZATION_ACCESS_REQUIRED",
      message:
        "Your account is authenticated but does not yet belong to a Traxium workspace.",
    };
  }

  const preferredActiveOrganizationId = getPreferredActiveOrganizationId(resolved.user);

  if (!preferredActiveOrganizationId) {
    return {
      ok: false,
      code: "ORGANIZATION_ACCESS_REQUIRED",
      message: "Your account is not an active member of any Traxium organization.",
    };
  }

  let repaired = false;
  let user = resolved.user;

  if (user.activeOrganizationId !== preferredActiveOrganizationId) {
    try {
      user = await updateUserActiveOrganization(user.id, preferredActiveOrganizationId);
      repaired = true;
    } catch {
      user = {
        ...user,
        activeOrganizationId: preferredActiveOrganizationId,
      };
    }
  }

  const activeMembership = getActiveMembership(user);

  if (!activeMembership) {
    return {
      ok: false,
      code: "ORGANIZATION_ACCESS_REQUIRED",
      message: "Your active Traxium organization is not a valid membership for this account.",
    };
  }

  const authUserId = getAuthUserId(resolved.authUser);
  const authActiveOrganizationId = getAuthActiveOrganizationId(resolved.authUser);

  if (authUserId !== user.id || authActiveOrganizationId !== activeMembership.organizationId) {
    try {
      await updateAuthSessionContext(resolved.authUser, {
        userId: user.id,
        activeOrganizationId: activeMembership.organizationId,
      });
      repaired = true;
    } catch {
      // Allow the current request to continue with the resolved membership.
      // Route-level guards can still authorize safely even if metadata sync lags.
    }
  }

  const sessionUser = mapSessionUser(user, activeMembership);
  const accessState = await getOrganizationAccessState(
    sessionUser.activeOrganization.organizationId
  );

  if (accessState.isBlocked) {
    return {
      ok: false,
      code: "BILLING_REQUIRED",
      message: getBillingRequiredMessage(accessState),
      accessState,
    };
  }

  return {
    ok: true,
    repaired,
    user: sessionUser,
  };
}

export async function bootstrapCurrentUserFromAuthUser(
  authUser: {
    id: string;
    email?: string | null;
    app_metadata?: unknown;
    user_metadata?: unknown;
  }
): Promise<SessionBootstrapResult> {
  const resolved = await resolveAuthenticatedAppUserFromAuthUser(authUser);

  if (!resolved.ok) {
    return resolved;
  }

  return bootstrapResolvedAuthenticatedAppUser(resolved);
}

export async function getWorkspaceOnboardingState(): Promise<WorkspaceOnboardingStateResult> {
  const resolved = await resolveAuthenticatedAppUser();

  if (!resolved.ok) {
    return resolved;
  }

  return {
    ok: true,
    needsWorkspace: !resolved.user || getSessionMemberships(resolved.user).length === 0,
    user: {
      id: resolved.user?.id ?? resolved.authUser.id,
      name: resolved.user?.name ?? resolved.name,
      email: resolved.user?.email ?? resolved.email,
    },
  };
}

export async function createInitialWorkspaceOnboarding(
  workspaceName: string,
  workspaceDescription?: string | null
): Promise<WorkspaceOnboardingResult> {
  const resolved = await resolveAuthenticatedAppUser();

  if (!resolved.ok) {
    throw new AuthGuardError(
      resolved.message,
      resolved.code === "UNAUTHENTICATED" ? 401 : 403,
      resolved.code === "UNAUTHENTICATED" ? "UNAUTHENTICATED" : "FORBIDDEN"
    );
  }

  let result: Awaited<ReturnType<typeof createInitialWorkspaceForUser>>;
  let persistedUserId: string;

  if (resolved.user) {
    result = await createInitialWorkspaceForUser(
      resolved.user.id,
      workspaceName,
      workspaceDescription
    );
    persistedUserId = resolved.user.id;
  } else {
    const provisionedResult = await createInitialWorkspaceForAuthenticatedUser({
      name: resolved.name,
      email: resolved.email,
      workspaceName,
      workspaceDescription,
    });

    result = provisionedResult;
    persistedUserId = provisionedResult.userId;
  }

  await updateAuthSessionContext(resolved.authUser, {
    userId: persistedUserId,
    activeOrganizationId: result.activeOrganizationId,
  });

  const refreshedUser = await findSessionUserById(persistedUserId);

  if (!refreshedUser) {
    throw new Error("Workspace user could not be reloaded after onboarding.");
  }

  const activeMembership =
    getActiveMembership(refreshedUser) ??
    getMembershipByOrganizationId(refreshedUser, result.activeOrganizationId);

  if (!activeMembership) {
    throw new Error("Workspace onboarding completed without an active organization membership.");
  }

  if (result.created) {
    await trackEvent({
      event: analyticsEventNames.ONBOARDING_WORKSPACE_CREATED,
      organizationId: result.organization.id,
      userId: persistedUserId,
      properties: {
        creationMode: resolved.user ? "existing_user" : "first_login",
        membershipRole: result.membership.role,
      },
    });
  }

  return {
    created: result.created,
    organization: result.organization,
    membership: result.membership,
    activeOrganizationId: result.activeOrganizationId,
    user: mapSessionUser(refreshedUser, activeMembership),
  };
}

export async function acceptInvitationForCurrentUser(
  token: string
): Promise<InvitationAcceptanceResult> {
  const resolved = await resolveAuthenticatedAppUser();

  if (!resolved.ok) {
    throw new AuthGuardError(
      resolved.message,
      resolved.code === "UNAUTHENTICATED" ? 401 : 403,
      resolved.code === "UNAUTHENTICATED" ? "UNAUTHENTICATED" : "FORBIDDEN"
    );
  }

  if (!resolved.user) {
    throw new AuthGuardError(
      "Your account must complete workspace onboarding before continuing.",
      403,
      "FORBIDDEN"
    );
  }

  const result = await acceptOrganizationInvitation({
    token,
    userId: resolved.user.id,
    userEmail: resolved.user.email,
    activeOrganizationId: getPreferredActiveOrganizationId(resolved.user),
    source: "authenticated_user",
  });

  await updateAuthSessionContext(resolved.authUser, {
    userId: resolved.user.id,
    activeOrganizationId: result.activeOrganizationId,
  });

  return result;
}

export async function switchCurrentOrganization(
  organizationId: string
): Promise<SessionUser> {
  const nextOrganizationId = normalizeString(organizationId);

  if (!nextOrganizationId) {
    throw new Error("Organization id is required.");
  }

  const resolved = await resolveAuthenticatedAppUser();

  if (!resolved.ok) {
    throw new AuthGuardError(
      resolved.message,
      resolved.code === "UNAUTHENTICATED" ? 401 : 403,
      resolved.code === "UNAUTHENTICATED" ? "UNAUTHENTICATED" : "FORBIDDEN"
    );
  }

  if (!resolved.user) {
    throw new AuthGuardError(
      "Your account does not yet belong to a Traxium workspace.",
      403,
      "FORBIDDEN"
    );
  }

  const membership = getMembershipByOrganizationId(resolved.user, nextOrganizationId);

  if (!membership) {
    throw new AuthGuardError(
      "You are not an active member of the requested organization.",
      403,
      "FORBIDDEN"
    );
  }

  let user = resolved.user;

  if (user.activeOrganizationId !== nextOrganizationId) {
    user = await updateUserActiveOrganization(user.id, nextOrganizationId);
  }

  await updateAuthSessionContext(resolved.authUser, {
    userId: user.id,
    activeOrganizationId: nextOrganizationId,
  });

  const activeMembership = getActiveMembership(user) ?? membership;

  return mapSessionUser(user, activeMembership);
}

function failAuthGuard(
  code: AuthFailureCode,
  message: string,
  options: AuthGuardOptions = {},
  accessState?: OrganizationAccessStateResult
): never {
  if (
    (code === "UNAUTHENTICATED" || code === "ORGANIZATION_REQUIRED") &&
    options.redirectTo !== null
  ) {
    redirect(options.redirectTo ?? "/login");
  }

  if (code === "BILLING_REQUIRED" && options.billingRedirectTo !== null) {
    redirect(options.billingRedirectTo ?? "/billing-required");
  }

  throw new AuthGuardError(
    message,
    code === "FORBIDDEN" ? 403 : code === "BILLING_REQUIRED" ? 402 : 401,
    code,
    accessState
  );
}

export async function requireUser(options: AuthGuardOptions = {}): Promise<SessionUser> {
  const user = await getCurrentUser();

  if (!user) {
    failAuthGuard("UNAUTHENTICATED", "Authenticated session is required.", options);
  }

  return assertBillingAccess(user, options);
}

export async function requireOrganization(
  options: AuthGuardOptions = {}
): Promise<SessionUser> {
  const user = await requireUser(options);
  const organizationId = normalizeString(user.organizationId);

  if (!organizationId) {
    failAuthGuard("ORGANIZATION_REQUIRED", "Organization context is required.", options);
  }

  return user;
}

export async function requireRole(
  roles: readonly Role[],
  options: AuthGuardOptions = {}
): Promise<SessionUser> {
  const user = await requireOrganization(options);

  if (!roles.length || !hasAnyRole(user.role, roles)) {
    failAuthGuard("FORBIDDEN", "Forbidden", { ...options, redirectTo: null });
  }

  return user;
}

export async function requirePermission(
  permission: AppPermission,
  options: AuthGuardOptions = {}
): Promise<SessionUser> {
  const user = await requireOrganization(options);

  if (!hasPermission(user.role, permission)) {
    failAuthGuard("FORBIDDEN", "Forbidden", { ...options, redirectTo: null });
  }

  return user;
}
