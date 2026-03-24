import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";
import type { MembershipStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { hasAnyRole, hasPermission } from "@/lib/permissions";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  AppPermission,
  AuthenticatedUser,
  AuthFailureCode,
  AuthGuardOptions,
} from "@/lib/types";

const sessionMembershipSelect = {
  id: true,
  organizationId: true,
  role: true,
  status: true,
} as const;

const ACTIVE_MEMBERSHIP_STATUS: MembershipStatus = "ACTIVE";

const sessionUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  activeOrganizationId: true,
  memberships: {
    where: {
      status: ACTIVE_MEMBERSHIP_STATUS,
    },
    select: sessionMembershipSelect,
    orderBy: [{ createdAt: "asc" as const }, { organizationId: "asc" as const }],
  },
} satisfies Prisma.UserSelect;

type SessionUserRecord = Prisma.UserGetPayload<{
  select: typeof sessionUserSelect;
}>;

type SessionMembershipRecord = SessionUserRecord["memberships"][number];

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
      user: SessionUserRecord;
    }
  | {
      ok: false;
      code: "UNAUTHENTICATED" | "AMBIGUOUS_USER" | "USER_NOT_PROVISIONED";
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
        | "USER_NOT_PROVISIONED"
        | "ORGANIZATION_ACCESS_REQUIRED"
        | "SESSION_REPAIR_FAILED";
      message: string;
    };

export class AuthGuardError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403,
    readonly code: AuthFailureCode
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

  if (!activeOrganizationId) {
    return null;
  }

  return (
    user.memberships.find(
      (membership) =>
        membership.organizationId === activeOrganizationId &&
        membership.status === ACTIVE_MEMBERSHIP_STATUS
    ) ?? null
  );
}

function getMembershipByOrganizationId(
  user: SessionUserRecord,
  organizationId: string
): SessionMembershipRecord | null {
  return (
    user.memberships.find(
      (membership) =>
        membership.organizationId === organizationId &&
        membership.status === ACTIVE_MEMBERSHIP_STATUS
    ) ?? null
  );
}

function getPreferredActiveOrganizationId(user: SessionUserRecord): string | null {
  const activeMembership = getActiveMembership(user);

  if (activeMembership) {
    return activeMembership.organizationId;
  }

  return user.memberships[0]?.organizationId ?? null;
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

async function resolveAuthenticatedAppUser(): Promise<AuthenticatedAppUserResult> {
  const authUser = await getAuthenticatedSessionUser();

  if (!authUser) {
    return {
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authenticated session is required.",
    };
  }

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
        user,
      };
    }
  }

  const candidates = await findSessionUsersByEmail(email);

  if (!candidates.length) {
    return {
      ok: false,
      code: "USER_NOT_PROVISIONED",
      message:
        "Your account is authenticated, but no Traxium workspace user is provisioned for this email.",
    };
  }

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
    user: candidates[0],
  };
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const resolved = await resolveAuthenticatedAppUser();

  if (!resolved.ok) {
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
    } catch (error) {
      return {
        ok: false,
        code: "SESSION_REPAIR_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "Unable to update the active Traxium organization.",
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
    } catch (error) {
      return {
        ok: false,
        code: "SESSION_REPAIR_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "Unable to update account workspace context.",
      };
    }
  }

  return {
    ok: true,
    repaired,
    user: mapSessionUser(user, activeMembership),
  };
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
  options: AuthGuardOptions = {}
): never {
  if (
    (code === "UNAUTHENTICATED" || code === "ORGANIZATION_REQUIRED") &&
    options.redirectTo !== null
  ) {
    redirect(options.redirectTo ?? "/login");
  }

  throw new AuthGuardError(message, code === "FORBIDDEN" ? 403 : 401, code);
}

export async function requireUser(options: AuthGuardOptions = {}): Promise<SessionUser> {
  const user = await getCurrentUser();

  if (!user) {
    failAuthGuard("UNAUTHENTICATED", "Authenticated session is required.", options);
  }

  return user;
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
