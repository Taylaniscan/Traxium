import { MembershipStatus, OrganizationRole, Role } from "@prisma/client";

export const DEFAULT_ORGANIZATION_ID = "org-1";
export const OTHER_ORGANIZATION_ID = "org-2";
export const DEFAULT_USER_ID = "user-1";

export type MockAuthGuardErrorCode = "UNAUTHENTICATED" | "ORGANIZATION_REQUIRED" | "FORBIDDEN";

export class MockAuthGuardError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403,
    readonly code: MockAuthGuardErrorCode
  ) {
    super(message);
    this.name = "AuthGuardError";
  }
}

export function createAuthGuardJsonResponse(error: unknown) {
  if (!(error instanceof MockAuthGuardError)) {
    return null;
  }

  return Response.json(
    {
      error: error.code === "FORBIDDEN" ? "Forbidden." : "Unauthorized.",
    },
    { status: error.status }
  );
}

export function createSessionUser(
  overrides: Partial<{
    id: string;
    name: string;
    email: string;
    role: Role;
    organizationId: string;
    activeOrganizationId: string;
    activeOrganization: {
      membershipId: string;
      organizationId: string;
      membershipRole: OrganizationRole;
      membershipStatus: MembershipStatus;
    };
  }> = {}
) {
  return {
    id: DEFAULT_USER_ID,
    name: "Test User",
    email: "user@example.com",
    role: Role.TACTICAL_BUYER,
    organizationId: DEFAULT_ORGANIZATION_ID,
    activeOrganizationId: DEFAULT_ORGANIZATION_ID,
    activeOrganization: {
      membershipId: "membership-1",
      organizationId: DEFAULT_ORGANIZATION_ID,
      membershipRole: OrganizationRole.MEMBER,
      membershipStatus: MembershipStatus.ACTIVE,
    },
    ...overrides,
  };
}

export function createAdminUser(
  overrides: Partial<{
    id: string;
    name: string;
    email: string;
    role: Role;
    organizationId: string;
  }> = {}
) {
  return createSessionUser({
    name: "Admin User",
    email: "admin@example.com",
    role: Role.HEAD_OF_GLOBAL_PROCUREMENT,
    ...overrides,
  });
}

export function createAuthSessionUser(
  overrides: Partial<{
    id: string;
    email: string | null;
    app_metadata: Record<string, unknown>;
    user_metadata: Record<string, unknown>;
  }> = {}
) {
  return {
    id: "auth-user-1",
    email: "user@example.com",
    app_metadata: {
      userId: DEFAULT_USER_ID,
      activeOrganizationId: DEFAULT_ORGANIZATION_ID,
      organizationId: DEFAULT_ORGANIZATION_ID,
    },
    user_metadata: {},
    ...overrides,
  };
}
