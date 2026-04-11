import {
  MembershipStatus,
  OrganizationRole,
  Role,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_ORGANIZATION_ID,
  DEFAULT_USER_ID,
  OTHER_ORGANIZATION_ID,
  createAuthSessionUser,
} from "../helpers/security-fixtures";

const redirectMock = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  })
);

const createSupabaseServerClientMock = vi.hoisted(() => vi.fn());
const createSupabaseAdminClientMock = vi.hoisted(() => vi.fn());
const updateUserByIdMock = vi.hoisted(() => vi.fn());
const getOrganizationAccessStateMock = vi.hoisted(() => vi.fn());

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/billing/access", () => ({
  getOrganizationAccessState: getOrganizationAccessStateMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock,
  createSupabaseAdminClient: createSupabaseAdminClientMock,
}));

import {
  AuthGuardError,
  bootstrapCurrentUser,
  getCurrentUser,
  getWorkspaceOnboardingState,
  requireOrganization,
  requirePermission,
  requireRole,
  requireUser,
} from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

function createMembership(
  organizationId = DEFAULT_ORGANIZATION_ID,
  overrides: Partial<{
    id: string;
    organizationId: string;
    role: OrganizationRole;
    status: MembershipStatus;
  }> = {}
) {
  return {
    id: `membership-${organizationId}`,
    organizationId,
    role: OrganizationRole.MEMBER,
    status: MembershipStatus.ACTIVE,
    ...overrides,
  };
}

function createResolvedUserRecord(
  overrides: Partial<{
    id: string;
    name: string;
    email: string;
    role: Role;
    organizationId: string;
    activeOrganizationId: string | null;
    memberships: Array<ReturnType<typeof createMembership>>;
  }> = {}
) {
  return {
    id: DEFAULT_USER_ID,
    name: "Test User",
    email: "user@example.com",
    role: Role.TACTICAL_BUYER,
    organizationId: DEFAULT_ORGANIZATION_ID,
    activeOrganizationId: DEFAULT_ORGANIZATION_ID,
    memberships: [createMembership(DEFAULT_ORGANIZATION_ID)],
    ...overrides,
  };
}

function mockAuthenticatedSession(authUser: ReturnType<typeof createAuthSessionUser> | null) {
  const getUser = vi.fn().mockResolvedValue({
    data: { user: authUser },
    error: null,
  });

  createSupabaseServerClientMock.mockResolvedValue({
    auth: {
      getUser,
    },
  });

  return getUser;
}

function mockResolvedUserRecord(
  overrides: Partial<{
    id: string;
    name: string;
    email: string;
    role: Role;
    organizationId: string;
    activeOrganizationId: string | null;
    memberships: Array<ReturnType<typeof createMembership>>;
  }> = {}
) {
  mockPrisma.user.findUnique.mockResolvedValue(createResolvedUserRecord(overrides));
}

describe("lib/auth guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticatedSession(createAuthSessionUser());
    mockResolvedUserRecord();
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.update.mockResolvedValue(createResolvedUserRecord());
    getOrganizationAccessStateMock.mockResolvedValue({
      organizationId: DEFAULT_ORGANIZATION_ID,
      subscriptionId: "sub_1",
      stripeSubscriptionId: "sub_1",
      rawSubscriptionStatus: "ACTIVE",
      accessState: "active",
      isBlocked: false,
      reasonCode: "active",
      currentPeriodEnd: new Date("2026-04-01T00:00:00.000Z"),
      plan: null,
    });
    updateUserByIdMock.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    createSupabaseAdminClientMock.mockReturnValue({
      auth: {
        admin: {
          updateUserById: updateUserByIdMock,
        },
      },
    });
  });

  it("returns null without an authenticated session and redirects in requireUser", async () => {
    mockAuthenticatedSession(null);

    await expect(getCurrentUser()).resolves.toBeNull();
    await expect(requireUser()).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("treats an authenticated first-login account as an onboarding candidate", async () => {
    mockAuthenticatedSession(
      createAuthSessionUser({
        app_metadata: {},
        user_metadata: {},
      })
    );
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    mockPrisma.user.findMany.mockResolvedValueOnce([]);

    await expect(getWorkspaceOnboardingState()).resolves.toEqual({
      ok: true,
      needsWorkspace: true,
      user: {
        id: "auth-user-1",
        name: "User",
        email: "user@example.com",
      },
    });

    await expect(bootstrapCurrentUser()).resolves.toEqual({
      ok: false,
      code: "ORGANIZATION_ACCESS_REQUIRED",
      message:
        "Your account is authenticated but does not yet belong to a Traxium workspace.",
    });
  });

  it("resolves the current user from active organization membership instead of metadata organization", async () => {
    mockAuthenticatedSession(
      createAuthSessionUser({
        app_metadata: {
          userId: DEFAULT_USER_ID,
          activeOrganizationId: OTHER_ORGANIZATION_ID,
          organizationId: OTHER_ORGANIZATION_ID,
        },
      })
    );

    await expect(getCurrentUser()).resolves.toEqual({
      id: DEFAULT_USER_ID,
      name: "Test User",
      email: "user@example.com",
      role: Role.TACTICAL_BUYER,
      organizationId: DEFAULT_ORGANIZATION_ID,
      activeOrganizationId: DEFAULT_ORGANIZATION_ID,
      activeOrganization: {
        membershipId: `membership-${DEFAULT_ORGANIZATION_ID}`,
        organizationId: DEFAULT_ORGANIZATION_ID,
        membershipRole: OrganizationRole.MEMBER,
        membershipStatus: MembershipStatus.ACTIVE,
      },
    });
  });

  it("checks billing access against the active organization only when multiple memberships exist", async () => {
    mockAuthenticatedSession(
      createAuthSessionUser({
        app_metadata: {
          userId: DEFAULT_USER_ID,
          activeOrganizationId: OTHER_ORGANIZATION_ID,
          organizationId: OTHER_ORGANIZATION_ID,
        },
      })
    );
    mockResolvedUserRecord({
      activeOrganizationId: DEFAULT_ORGANIZATION_ID,
      memberships: [
        createMembership(DEFAULT_ORGANIZATION_ID),
        createMembership(OTHER_ORGANIZATION_ID),
      ],
    });

    await expect(requireOrganization({ redirectTo: null })).resolves.toMatchObject({
      organizationId: DEFAULT_ORGANIZATION_ID,
      activeOrganizationId: DEFAULT_ORGANIZATION_ID,
      activeOrganization: {
        organizationId: DEFAULT_ORGANIZATION_ID,
      },
    });
    expect(getOrganizationAccessStateMock).toHaveBeenCalledWith(
      DEFAULT_ORGANIZATION_ID
    );
  });

  it("blocks access when the active organization is switched to a blocked workspace membership", async () => {
    mockAuthenticatedSession(
      createAuthSessionUser({
        app_metadata: {
          userId: DEFAULT_USER_ID,
          activeOrganizationId: OTHER_ORGANIZATION_ID,
          organizationId: OTHER_ORGANIZATION_ID,
        },
      })
    );
    mockResolvedUserRecord({
      activeOrganizationId: OTHER_ORGANIZATION_ID,
      memberships: [
        createMembership(DEFAULT_ORGANIZATION_ID),
        createMembership(OTHER_ORGANIZATION_ID),
      ],
    });
    getOrganizationAccessStateMock.mockResolvedValueOnce({
      organizationId: OTHER_ORGANIZATION_ID,
      subscriptionId: "sub_other",
      stripeSubscriptionId: "sub_other",
      rawSubscriptionStatus: "CANCELED",
      accessState: "blocked_canceled",
      isBlocked: true,
      reasonCode: "canceled",
      currentPeriodEnd: new Date("2026-03-01T00:00:00.000Z"),
      plan: null,
    });

    await expect(
      requireOrganization({ redirectTo: null })
    ).rejects.toMatchObject({
      name: "AuthGuardError",
      status: 402,
      code: "BILLING_REQUIRED",
      accessState: expect.objectContaining({
        organizationId: OTHER_ORGANIZATION_ID,
        accessState: "blocked_canceled",
        reasonCode: "canceled",
      }),
    } satisfies Partial<AuthGuardError>);
    expect(getOrganizationAccessStateMock).toHaveBeenCalledWith(
      OTHER_ORGANIZATION_ID
    );
  });

  it("falls back to the first active membership when the stored active organization is stale", async () => {
    mockResolvedUserRecord({
      activeOrganizationId: OTHER_ORGANIZATION_ID,
      memberships: [createMembership(DEFAULT_ORGANIZATION_ID)],
    });

    await expect(getCurrentUser()).resolves.toMatchObject({
      organizationId: DEFAULT_ORGANIZATION_ID,
      activeOrganizationId: DEFAULT_ORGANIZATION_ID,
      activeOrganization: {
        organizationId: DEFAULT_ORGANIZATION_ID,
      },
    });
    await expect(requireOrganization({ redirectTo: null })).resolves.toMatchObject({
      organizationId: DEFAULT_ORGANIZATION_ID,
      activeOrganizationId: DEFAULT_ORGANIZATION_ID,
    });
  });

  it("redirects blocked billing access to the billing-required page by default", async () => {
    getOrganizationAccessStateMock.mockResolvedValueOnce({
      organizationId: DEFAULT_ORGANIZATION_ID,
      subscriptionId: "sub_1",
      stripeSubscriptionId: "sub_1",
      rawSubscriptionStatus: "PAST_DUE",
      accessState: "blocked_past_due",
      isBlocked: true,
      reasonCode: "past_due_blocked",
      currentPeriodEnd: new Date("2026-03-01T00:00:00.000Z"),
      plan: null,
    });

    await expect(requireUser()).rejects.toThrow(
      "NEXT_REDIRECT:/billing-required"
    );
    expect(redirectMock).toHaveBeenCalledWith("/billing-required");
  });

  it("returns a structured billing guard error for blocked API access and allows explicit recovery paths", async () => {
    getOrganizationAccessStateMock.mockResolvedValue({
      organizationId: DEFAULT_ORGANIZATION_ID,
      subscriptionId: null,
      stripeSubscriptionId: null,
      rawSubscriptionStatus: null,
      accessState: "no_subscription",
      isBlocked: true,
      reasonCode: "no_subscription",
      currentPeriodEnd: null,
      plan: null,
    });

    await expect(
      requireOrganization({ redirectTo: null })
    ).rejects.toMatchObject({
      name: "AuthGuardError",
      status: 402,
      code: "BILLING_REQUIRED",
      accessState: expect.objectContaining({
        accessState: "no_subscription",
        reasonCode: "no_subscription",
      }),
    } satisfies Partial<AuthGuardError>);

    await expect(
      requireOrganization({
        redirectTo: null,
        allowBillingBlocked: true,
      })
    ).resolves.toMatchObject({
      organizationId: DEFAULT_ORGANIZATION_ID,
      activeOrganizationId: DEFAULT_ORGANIZATION_ID,
    });
  });

  it("enforces role and permission checks against the active organization context", async () => {
    mockResolvedUserRecord({
      role: Role.FINANCIAL_CONTROLLER,
    });

    await expect(
      requireRole([Role.FINANCIAL_CONTROLLER], { redirectTo: null })
    ).resolves.toMatchObject({
      role: Role.FINANCIAL_CONTROLLER,
      organizationId: DEFAULT_ORGANIZATION_ID,
      activeOrganizationId: DEFAULT_ORGANIZATION_ID,
      activeOrganization: {
        organizationId: DEFAULT_ORGANIZATION_ID,
      },
    });

    await expect(
      requirePermission("lockFinance", { redirectTo: null })
    ).resolves.toMatchObject({
      role: Role.FINANCIAL_CONTROLLER,
      organizationId: DEFAULT_ORGANIZATION_ID,
    });

    expect(hasPermission(Role.FINANCIAL_CONTROLLER, "lockFinance")).toBe(true);
    expect(hasPermission(Role.FINANCIAL_CONTROLLER, "manageWorkspace")).toBe(true);
  });

  it("rejects missing roles and permissions with a forbidden error", async () => {
    mockResolvedUserRecord({
      role: Role.TACTICAL_BUYER,
    });

    await expect(
      requireRole([Role.HEAD_OF_GLOBAL_PROCUREMENT], { redirectTo: null })
    ).rejects.toMatchObject({
      name: "AuthGuardError",
      status: 403,
      code: "FORBIDDEN",
    } satisfies Partial<AuthGuardError>);

    await expect(
      requirePermission("lockFinance", { redirectTo: null })
    ).rejects.toMatchObject({
      name: "AuthGuardError",
      status: 403,
      code: "FORBIDDEN",
    } satisfies Partial<AuthGuardError>);

    expect(hasPermission(Role.TACTICAL_BUYER, "manageSavingCards")).toBe(true);
    expect(hasPermission(Role.TACTICAL_BUYER, "lockFinance")).toBe(false);
  });

  it("bootstraps a unique user and repairs session metadata from active organization membership", async () => {
    mockAuthenticatedSession(
      createAuthSessionUser({
        app_metadata: {},
      })
    );
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.findMany.mockResolvedValue([createResolvedUserRecord()]);

    const result = await bootstrapCurrentUser();

    expect(result).toEqual({
      ok: true,
      repaired: true,
      user: {
        id: DEFAULT_USER_ID,
        name: "Test User",
        email: "user@example.com",
        role: Role.TACTICAL_BUYER,
        organizationId: DEFAULT_ORGANIZATION_ID,
        activeOrganizationId: DEFAULT_ORGANIZATION_ID,
        activeOrganization: {
          membershipId: `membership-${DEFAULT_ORGANIZATION_ID}`,
          organizationId: DEFAULT_ORGANIZATION_ID,
          membershipRole: OrganizationRole.MEMBER,
          membershipStatus: MembershipStatus.ACTIVE,
        },
      },
    });
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
      where: {
        email: {
          equals: "user@example.com",
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        organizationId: true,
        activeOrganizationId: true,
      },
      orderBy: [{ id: "asc" }],
      take: 2,
    });
    expect(updateUserByIdMock).toHaveBeenCalledWith("auth-user-1", {
      app_metadata: {
        userId: DEFAULT_USER_ID,
        activeOrganizationId: DEFAULT_ORGANIZATION_ID,
      },
    });
  });

  it("bootstraps and repairs a missing active organization from the first active membership", async () => {
    mockAuthenticatedSession(
      createAuthSessionUser({
        app_metadata: {
          userId: DEFAULT_USER_ID,
        },
      })
    );
    mockResolvedUserRecord({
      activeOrganizationId: null,
      memberships: [
        createMembership(DEFAULT_ORGANIZATION_ID, {
          role: OrganizationRole.ADMIN,
        }),
        createMembership(OTHER_ORGANIZATION_ID),
      ],
    });
    mockPrisma.user.update.mockResolvedValue(
      createResolvedUserRecord({
        activeOrganizationId: DEFAULT_ORGANIZATION_ID,
        memberships: [
          createMembership(DEFAULT_ORGANIZATION_ID, {
            role: OrganizationRole.ADMIN,
          }),
          createMembership(OTHER_ORGANIZATION_ID),
        ],
      })
    );

    const result = await bootstrapCurrentUser();

    expect(result).toEqual({
      ok: true,
      repaired: true,
      user: {
        id: DEFAULT_USER_ID,
        name: "Test User",
        email: "user@example.com",
        role: Role.TACTICAL_BUYER,
        organizationId: DEFAULT_ORGANIZATION_ID,
        activeOrganizationId: DEFAULT_ORGANIZATION_ID,
        activeOrganization: {
          membershipId: `membership-${DEFAULT_ORGANIZATION_ID}`,
          organizationId: DEFAULT_ORGANIZATION_ID,
          membershipRole: OrganizationRole.ADMIN,
          membershipStatus: MembershipStatus.ACTIVE,
        },
      },
    });
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: DEFAULT_USER_ID },
      data: {
        activeOrganizationId: DEFAULT_ORGANIZATION_ID,
      },
      select: expect.any(Object),
    });
  });

  it("continues bootstrap with the resolved membership when persisting the active organization repair fails", async () => {
    mockAuthenticatedSession(
      createAuthSessionUser({
        app_metadata: {
          userId: DEFAULT_USER_ID,
          activeOrganizationId: DEFAULT_ORGANIZATION_ID,
        },
      })
    );
    mockResolvedUserRecord({
      activeOrganizationId: OTHER_ORGANIZATION_ID,
      memberships: [createMembership(DEFAULT_ORGANIZATION_ID)],
    });
    mockPrisma.user.update.mockRejectedValueOnce(
      new Error("Unable to update the active Traxium organization.")
    );

    await expect(bootstrapCurrentUser()).resolves.toEqual({
      ok: true,
      repaired: false,
      user: {
        id: DEFAULT_USER_ID,
        name: "Test User",
        email: "user@example.com",
        role: Role.TACTICAL_BUYER,
        organizationId: DEFAULT_ORGANIZATION_ID,
        activeOrganizationId: DEFAULT_ORGANIZATION_ID,
        activeOrganization: {
          membershipId: `membership-${DEFAULT_ORGANIZATION_ID}`,
          organizationId: DEFAULT_ORGANIZATION_ID,
          membershipRole: OrganizationRole.MEMBER,
          membershipStatus: MembershipStatus.ACTIVE,
        },
      },
    });
  });

  it("continues bootstrap when auth metadata sync fails but the resolved membership is valid", async () => {
    mockAuthenticatedSession(
      createAuthSessionUser({
        app_metadata: {},
      })
    );
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    mockPrisma.user.findMany.mockResolvedValueOnce([createResolvedUserRecord()]);
    updateUserByIdMock.mockResolvedValueOnce({
      data: { user: null },
      error: {
        message: "Service role metadata sync failed.",
      },
    });

    await expect(bootstrapCurrentUser()).resolves.toEqual({
      ok: true,
      repaired: false,
      user: {
        id: DEFAULT_USER_ID,
        name: "Test User",
        email: "user@example.com",
        role: Role.TACTICAL_BUYER,
        organizationId: DEFAULT_ORGANIZATION_ID,
        activeOrganizationId: DEFAULT_ORGANIZATION_ID,
        activeOrganization: {
          membershipId: `membership-${DEFAULT_ORGANIZATION_ID}`,
          organizationId: DEFAULT_ORGANIZATION_ID,
          membershipRole: OrganizationRole.MEMBER,
          membershipStatus: MembershipStatus.ACTIVE,
        },
      },
    });
  });

  it("rejects bootstrap when the email maps to multiple app users", async () => {
    mockAuthenticatedSession(
      createAuthSessionUser({
        app_metadata: {},
      })
    );
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.findMany.mockResolvedValue([
      createResolvedUserRecord(),
      createResolvedUserRecord({
        id: "user-2",
        organizationId: OTHER_ORGANIZATION_ID,
        activeOrganizationId: OTHER_ORGANIZATION_ID,
        memberships: [createMembership(OTHER_ORGANIZATION_ID)],
      }),
    ]);

    await expect(bootstrapCurrentUser()).resolves.toEqual({
      ok: false,
      code: "AMBIGUOUS_USER",
      message:
        "Your account matches multiple Traxium users. Contact an administrator to complete workspace consolidation.",
    });
    expect(updateUserByIdMock).not.toHaveBeenCalled();
  });

  it("returns billing-required during bootstrap when the active workspace is blocked", async () => {
    getOrganizationAccessStateMock.mockResolvedValueOnce({
      organizationId: DEFAULT_ORGANIZATION_ID,
      subscriptionId: "sub_1",
      stripeSubscriptionId: "sub_1",
      rawSubscriptionStatus: "UNPAID",
      accessState: "blocked_unpaid",
      isBlocked: true,
      reasonCode: "unpaid",
      currentPeriodEnd: new Date("2026-03-01T00:00:00.000Z"),
      plan: null,
    });

    await expect(bootstrapCurrentUser()).resolves.toEqual({
      ok: false,
      code: "BILLING_REQUIRED",
      message:
        "Your workspace subscription is unpaid. Resolve billing before product access can continue.",
      accessState: expect.objectContaining({
        accessState: "blocked_unpaid",
        reasonCode: "unpaid",
      }),
    });
  });
});
