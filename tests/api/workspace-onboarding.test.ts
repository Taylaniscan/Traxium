import {
  MembershipStatus,
  OrganizationRole,
  Prisma,
  Role,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_ORGANIZATION_ID,
  DEFAULT_USER_ID,
  createAuthSessionUser,
} from "../helpers/security-fixtures";

const createSupabaseServerClientMock = vi.hoisted(() => vi.fn());
const createSupabaseAdminClientMock = vi.hoisted(() => vi.fn());
const updateUserByIdMock = vi.hoisted(() => vi.fn());
const captureExceptionMock = vi.hoisted(() => vi.fn());
const writeStructuredLogMock = vi.hoisted(() => vi.fn());

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock,
  createSupabaseAdminClient: createSupabaseAdminClientMock,
}));

vi.mock("@/lib/logger", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/logger")>();

  return {
    ...actual,
    writeStructuredLog: writeStructuredLogMock,
  };
});

vi.mock("@/lib/observability", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/observability")>();

  return {
    ...actual,
    captureException: captureExceptionMock,
  };
});

import { POST } from "@/app/api/onboarding/workspace/route";

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
    activeOrganizationId: string | null;
    memberships: Array<ReturnType<typeof createMembership>>;
  }> = {}
) {
  return {
    id: DEFAULT_USER_ID,
    name: "Test User",
    email: "user@example.com",
    role: Role.TACTICAL_BUYER,
    activeOrganizationId: null,
    memberships: [],
    ...overrides,
  };
}

function createExistingWorkspaceTransactionUser(
  organizationId = "org-new",
  overrides: Partial<{
    activeOrganizationId: string | null;
    memberships: Array<{
      id: string;
      organizationId: string;
      role: OrganizationRole;
      status: MembershipStatus;
      createdAt: Date;
      updatedAt: Date;
      organization: {
        id: string;
        name: string;
        slug: string;
        createdAt: Date;
        updatedAt: Date;
      };
    }>;
  }> = {}
) {
  return {
    activeOrganizationId: organizationId,
    memberships: [
      {
        id: `membership-${organizationId}`,
        organizationId,
        role: OrganizationRole.OWNER,
        status: MembershipStatus.ACTIVE,
        createdAt: new Date("2026-03-24T00:00:00.000Z"),
        updatedAt: new Date("2026-03-24T00:00:00.000Z"),
        organization: {
          id: organizationId,
          name: "Atlas Procurement",
          slug: "atlas-procurement",
          createdAt: new Date("2026-03-24T00:00:00.000Z"),
          updatedAt: new Date("2026-03-24T00:00:00.000Z"),
        },
      },
    ],
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

function createTransactionMock() {
  return {
    $queryRaw: vi.fn(),
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    organization: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    organizationMembership: {
      upsert: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };
}

describe("workspace onboarding route", () => {
  let tx: ReturnType<typeof createTransactionMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    tx = createTransactionMock();
    tx.$queryRaw.mockResolvedValue([{ exists: true }]);

    mockAuthenticatedSession(
      createAuthSessionUser({
        app_metadata: {
          userId: DEFAULT_USER_ID,
        },
      })
    );
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.$transaction.mockImplementation(async (callback: unknown) => {
      if (typeof callback !== "function") {
        throw new Error("Expected transaction callback.");
      }

      const transactionCallback = callback as (client: typeof tx) => Promise<unknown>;
      return transactionCallback(tx);
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

  it("allows an authenticated user without memberships to create the first workspace", async () => {
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(createResolvedUserRecord())
      .mockResolvedValueOnce(
        createResolvedUserRecord({
          activeOrganizationId: "org-new",
          memberships: [
            createMembership("org-new", {
              role: OrganizationRole.OWNER,
            }),
          ],
        })
      );
    tx.user.findUnique.mockResolvedValueOnce({
      id: DEFAULT_USER_ID,
      memberships: [],
    });
    tx.organization.findMany.mockResolvedValueOnce([]);
    tx.organization.create.mockResolvedValueOnce({
      id: "org-new",
      name: "Atlas Procurement",
      slug: "atlas-procurement",
      createdAt: new Date("2026-03-24T00:00:00.000Z"),
      updatedAt: new Date("2026-03-24T00:00:00.000Z"),
    });
    tx.organizationMembership.upsert.mockResolvedValueOnce({
      id: "membership-org-new",
      organizationId: "org-new",
      role: OrganizationRole.OWNER,
      status: MembershipStatus.ACTIVE,
      createdAt: new Date("2026-03-24T00:00:00.000Z"),
      updatedAt: new Date("2026-03-24T00:00:00.000Z"),
    });
    tx.user.update.mockResolvedValueOnce({
      id: DEFAULT_USER_ID,
      organizationId: "org-new",
      activeOrganizationId: "org-new",
    });

    const response = await POST(
      new Request("http://localhost/api/onboarding/workspace", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Atlas Procurement",
          description: "SME procurement savings pilot.",
        }),
      })
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      success: true,
      organization: {
        id: "org-new",
        name: "Atlas Procurement",
        slug: "atlas-procurement",
        createdAt: "2026-03-24T00:00:00.000Z",
        updatedAt: "2026-03-24T00:00:00.000Z",
      },
      membership: {
        id: "membership-org-new",
        organizationId: "org-new",
        role: OrganizationRole.OWNER,
        status: MembershipStatus.ACTIVE,
        createdAt: "2026-03-24T00:00:00.000Z",
        updatedAt: "2026-03-24T00:00:00.000Z",
      },
      activeOrganizationId: "org-new",
      user: {
        id: DEFAULT_USER_ID,
        name: "Test User",
        email: "user@example.com",
        role: Role.TACTICAL_BUYER,
        organizationId: "org-new",
        activeOrganizationId: "org-new",
        activeOrganization: {
          membershipId: "membership-org-new",
          organizationId: "org-new",
          membershipRole: OrganizationRole.OWNER,
          membershipStatus: MembershipStatus.ACTIVE,
        },
      },
    });
    expect(tx.organization.create).toHaveBeenCalledWith({
      data: {
        name: "Atlas Procurement",
        description: "SME procurement savings pilot.",
        slug: "atlas-procurement",
        workspaceTrialEndsAt: expect.any(Date),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    expect(tx.organizationMembership.upsert).toHaveBeenCalledWith({
      where: {
        userId_organizationId: {
          userId: DEFAULT_USER_ID,
          organizationId: "org-new",
        },
      },
      update: {
        role: OrganizationRole.OWNER,
        status: MembershipStatus.ACTIVE,
      },
      create: {
        userId: DEFAULT_USER_ID,
        organizationId: "org-new",
        role: OrganizationRole.OWNER,
        status: MembershipStatus.ACTIVE,
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
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: DEFAULT_USER_ID },
      data: {
        organizationId: "org-new",
        activeOrganizationId: "org-new",
      },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        organizationId: "org-new",
        userId: DEFAULT_USER_ID,
        actorUserId: DEFAULT_USER_ID,
        targetUserId: DEFAULT_USER_ID,
        targetEntityId: "org-new",
        eventType: "onboarding.workspace_created",
        action: "onboarding.workspace_created",
        detail: "Workspace Atlas Procurement was created.",
        payload: {
          membershipRole: OrganizationRole.OWNER,
          organizationSlug: "atlas-procurement",
        },
      },
    });
    expect(updateUserByIdMock).toHaveBeenCalledWith("auth-user-1", {
      app_metadata: {
        userId: DEFAULT_USER_ID,
        activeOrganizationId: "org-new",
      },
    });
  });

  it("provisions a new app user during first-login workspace creation", async () => {
    mockAuthenticatedSession(
      createAuthSessionUser({
        email: "new.user@example.com",
        app_metadata: {},
        user_metadata: {
          full_name: "New User",
        },
      })
    );
    mockPrisma.user.findUnique.mockResolvedValueOnce(
      createResolvedUserRecord({
        id: "user-new",
        name: "New User",
        email: "new.user@example.com",
        activeOrganizationId: "org-new",
        memberships: [
          createMembership("org-new", {
            role: OrganizationRole.OWNER,
          }),
        ],
      })
    );
    mockPrisma.user.findMany.mockResolvedValueOnce([]);
    tx.organization.findMany.mockResolvedValueOnce([]);
    tx.organization.create.mockResolvedValueOnce({
      id: "org-new",
      name: "Atlas Procurement",
      slug: "atlas-procurement",
      createdAt: new Date("2026-03-24T00:00:00.000Z"),
      updatedAt: new Date("2026-03-24T00:00:00.000Z"),
    });
    tx.user.create.mockResolvedValueOnce({
      id: "user-new",
    });
    tx.organizationMembership.upsert.mockResolvedValueOnce({
      id: "membership-org-new",
      organizationId: "org-new",
      role: OrganizationRole.OWNER,
      status: MembershipStatus.ACTIVE,
      createdAt: new Date("2026-03-24T00:00:00.000Z"),
      updatedAt: new Date("2026-03-24T00:00:00.000Z"),
    });

    const response = await POST(
      new Request("http://localhost/api/onboarding/workspace", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Atlas Procurement",
        }),
      })
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      success: true,
      organization: {
        id: "org-new",
        name: "Atlas Procurement",
        slug: "atlas-procurement",
        createdAt: "2026-03-24T00:00:00.000Z",
        updatedAt: "2026-03-24T00:00:00.000Z",
      },
      membership: {
        id: "membership-org-new",
        organizationId: "org-new",
        role: OrganizationRole.OWNER,
        status: MembershipStatus.ACTIVE,
        createdAt: "2026-03-24T00:00:00.000Z",
        updatedAt: "2026-03-24T00:00:00.000Z",
      },
      activeOrganizationId: "org-new",
      user: {
        id: "user-new",
        name: "New User",
        email: "new.user@example.com",
        role: Role.TACTICAL_BUYER,
        organizationId: "org-new",
        activeOrganizationId: "org-new",
        activeOrganization: {
          membershipId: "membership-org-new",
          organizationId: "org-new",
          membershipRole: OrganizationRole.OWNER,
          membershipStatus: MembershipStatus.ACTIVE,
        },
      },
    });
    expect(tx.user.create).toHaveBeenCalledWith({
      data: {
        organizationId: "org-new",
        activeOrganizationId: "org-new",
        name: "New User",
        email: "new.user@example.com",
        role: Role.TACTICAL_BUYER,
      },
      select: {
        id: true,
      },
    });
    expect(tx.organizationMembership.upsert).toHaveBeenCalledWith({
      where: {
        userId_organizationId: {
          userId: "user-new",
          organizationId: "org-new",
        },
      },
      update: {
        role: OrganizationRole.OWNER,
        status: MembershipStatus.ACTIVE,
      },
      create: {
        userId: "user-new",
        organizationId: "org-new",
        role: OrganizationRole.OWNER,
        status: MembershipStatus.ACTIVE,
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
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        organizationId: "org-new",
        userId: "user-new",
        actorUserId: "user-new",
        targetUserId: "user-new",
        targetEntityId: "org-new",
        eventType: "onboarding.workspace_created",
        action: "onboarding.workspace_created",
        detail: "Workspace Atlas Procurement was created.",
        payload: {
          membershipRole: OrganizationRole.OWNER,
          organizationSlug: "atlas-procurement",
        },
      },
    });
    expect(updateUserByIdMock).toHaveBeenCalledWith("auth-user-1", {
      app_metadata: {
        userId: "user-new",
        activeOrganizationId: "org-new",
      },
    });
  });

  it("returns the existing workspace when onboarding is submitted again for the same membership", async () => {
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(
        createResolvedUserRecord({
          activeOrganizationId: DEFAULT_ORGANIZATION_ID,
          memberships: [
            createMembership(DEFAULT_ORGANIZATION_ID, {
              role: OrganizationRole.ADMIN,
            }),
          ],
        })
      )
      .mockResolvedValueOnce(
        createResolvedUserRecord({
          activeOrganizationId: DEFAULT_ORGANIZATION_ID,
          memberships: [
            createMembership(DEFAULT_ORGANIZATION_ID, {
              role: OrganizationRole.ADMIN,
            }),
          ],
        })
      );
    tx.user.findUnique.mockResolvedValueOnce(
      createExistingWorkspaceTransactionUser(DEFAULT_ORGANIZATION_ID, {
        memberships: [
          {
            id: `membership-${DEFAULT_ORGANIZATION_ID}`,
            organizationId: DEFAULT_ORGANIZATION_ID,
            role: OrganizationRole.ADMIN,
            status: MembershipStatus.ACTIVE,
            createdAt: new Date("2026-03-24T00:00:00.000Z"),
            updatedAt: new Date("2026-03-24T00:00:00.000Z"),
            organization: {
              id: DEFAULT_ORGANIZATION_ID,
              name: "Atlas Procurement",
              slug: "atlas-procurement",
              createdAt: new Date("2026-03-24T00:00:00.000Z"),
              updatedAt: new Date("2026-03-24T00:00:00.000Z"),
            },
          },
        ],
      })
    );

    const response = await POST(
      new Request("http://localhost/api/onboarding/workspace", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Second Workspace",
        }),
      })
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      success: true,
      organization: {
        id: DEFAULT_ORGANIZATION_ID,
        name: "Atlas Procurement",
        slug: "atlas-procurement",
        createdAt: "2026-03-24T00:00:00.000Z",
        updatedAt: "2026-03-24T00:00:00.000Z",
      },
      membership: {
        id: `membership-${DEFAULT_ORGANIZATION_ID}`,
        organizationId: DEFAULT_ORGANIZATION_ID,
        role: OrganizationRole.ADMIN,
        status: MembershipStatus.ACTIVE,
        createdAt: "2026-03-24T00:00:00.000Z",
        updatedAt: "2026-03-24T00:00:00.000Z",
      },
      activeOrganizationId: DEFAULT_ORGANIZATION_ID,
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
    expect(tx.organization.create).not.toHaveBeenCalled();
    expect(tx.organizationMembership.upsert).not.toHaveBeenCalled();
    expect(updateUserByIdMock).toHaveBeenCalledWith("auth-user-1", {
      app_metadata: {
        userId: DEFAULT_USER_ID,
        activeOrganizationId: DEFAULT_ORGANIZATION_ID,
      },
    });
  });

  it("returns validation errors for blank workspace names", async () => {
    const response = await POST(
      new Request("http://localhost/api/onboarding/workspace", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: " ",
        }),
      })
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "Workspace name is required.",
      code: "VALIDATION_ERROR",
    });
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("creates a unique slug when the requested workspace name already exists", async () => {
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(createResolvedUserRecord())
      .mockResolvedValueOnce(
        createResolvedUserRecord({
          activeOrganizationId: "org-new",
          memberships: [
            createMembership("org-new", {
              role: OrganizationRole.OWNER,
            }),
          ],
        })
      );
    tx.user.findUnique.mockResolvedValueOnce({
      id: DEFAULT_USER_ID,
      memberships: [],
    });
    tx.organization.findMany.mockResolvedValueOnce([
      { slug: "atlas-procurement" },
      { slug: "atlas-procurement-2" },
    ]);
    tx.organization.create.mockResolvedValueOnce({
      id: "org-new",
      name: "Atlas Procurement",
      slug: "atlas-procurement-3",
      createdAt: new Date("2026-03-24T00:00:00.000Z"),
      updatedAt: new Date("2026-03-24T00:00:00.000Z"),
    });
    tx.organizationMembership.upsert.mockResolvedValueOnce({
      id: "membership-org-new",
      organizationId: "org-new",
      role: OrganizationRole.OWNER,
      status: MembershipStatus.ACTIVE,
      createdAt: new Date("2026-03-24T00:00:00.000Z"),
      updatedAt: new Date("2026-03-24T00:00:00.000Z"),
    });
    tx.user.update.mockResolvedValueOnce({
      id: DEFAULT_USER_ID,
      organizationId: "org-new",
      activeOrganizationId: "org-new",
    });

    const response = await POST(
      new Request("http://localhost/api/onboarding/workspace", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Atlas Procurement",
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(tx.organization.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          slug: "atlas-procurement-3",
          workspaceTrialEndsAt: expect.any(Date),
        }),
      })
    );
  });

  it("skips workspaceTrialEndsAt in development when the local database column is missing", async () => {
    const previousAppEnv = process.env.APP_ENV;
    process.env.APP_ENV = "development";

    mockPrisma.user.findUnique
      .mockResolvedValueOnce(createResolvedUserRecord())
      .mockResolvedValueOnce(
        createResolvedUserRecord({
          activeOrganizationId: "org-new",
          memberships: [
            createMembership("org-new", {
              role: OrganizationRole.OWNER,
            }),
          ],
        })
      );
    tx.user.findUnique.mockResolvedValueOnce({
      id: DEFAULT_USER_ID,
      memberships: [],
    });
    tx.organization.findMany.mockResolvedValueOnce([]);
    tx.$queryRaw.mockResolvedValueOnce([{ exists: false }]);
    tx.organization.create.mockResolvedValueOnce({
      id: "org-new",
      name: "Atlas Procurement",
      slug: "atlas-procurement",
      createdAt: new Date("2026-03-24T00:00:00.000Z"),
      updatedAt: new Date("2026-03-24T00:00:00.000Z"),
    });
    tx.organizationMembership.upsert.mockResolvedValueOnce({
      id: "membership-org-new",
      organizationId: "org-new",
      role: OrganizationRole.OWNER,
      status: MembershipStatus.ACTIVE,
      createdAt: new Date("2026-03-24T00:00:00.000Z"),
      updatedAt: new Date("2026-03-24T00:00:00.000Z"),
    });
    tx.user.update.mockResolvedValueOnce({
      id: DEFAULT_USER_ID,
      organizationId: "org-new",
      activeOrganizationId: "org-new",
    });

    try {
      const response = await POST(
        new Request("http://localhost/api/onboarding/workspace", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            name: "Atlas Procurement",
          }),
        })
      );

      expect(response.status).toBe(201);
      expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
      expect(tx.organization.create).toHaveBeenCalledWith({
        data: {
          name: "Atlas Procurement",
          slug: "atlas-procurement",
        },
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      expect(writeStructuredLogMock).toHaveBeenCalledWith(
        "warn",
        expect.objectContaining({
          event: "workspace.onboarding.workspace_trial_fallback_used",
        })
      );
    } finally {
      if (previousAppEnv === undefined) {
        delete process.env.APP_ENV;
      } else {
        process.env.APP_ENV = previousAppEnv;
      }
    }
  });

  it("captures the first failing step when organization creation fails for an existing user", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(createResolvedUserRecord());
    tx.user.findUnique.mockResolvedValueOnce({
      id: DEFAULT_USER_ID,
      memberships: [],
    });
    tx.organization.findMany.mockResolvedValueOnce([]);
    tx.organization.create.mockRejectedValueOnce(
      new Error("Organization insert failed.")
    );

    const response = await POST(
      new Request("http://localhost/api/onboarding/workspace", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Atlas Procurement",
        }),
      })
    );

    expect(response.status).toBe(500);
    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        event: "onboarding.workspace.organization_create_failed",
        userId: DEFAULT_USER_ID,
        payload: expect.objectContaining({
          flow: "existing_user",
          workspaceName: "Atlas Procurement",
        }),
      })
    );
  });

  it("captures the first failing step when first-login user creation fails", async () => {
    mockAuthenticatedSession(
      createAuthSessionUser({
        email: "new.user@example.com",
        app_metadata: {},
        user_metadata: {
          full_name: "New User",
        },
      })
    );
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    mockPrisma.user.findMany.mockResolvedValueOnce([]);
    tx.organization.findMany.mockResolvedValueOnce([]);
    tx.organization.create.mockResolvedValueOnce({
      id: "org-new",
      name: "Atlas Procurement",
      slug: "atlas-procurement",
      createdAt: new Date("2026-03-24T00:00:00.000Z"),
      updatedAt: new Date("2026-03-24T00:00:00.000Z"),
    });
    tx.user.create.mockRejectedValueOnce(new Error("User insert failed."));

    const response = await POST(
      new Request("http://localhost/api/onboarding/workspace", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Atlas Procurement",
        }),
      })
    );

    expect(response.status).toBe(500);
    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        event: "onboarding.workspace.first_login_user_create_failed",
        organizationId: "org-new",
        payload: expect.objectContaining({
          flow: "first_login",
          workspaceName: "Atlas Procurement",
          email: "new.user@example.com",
        }),
      })
    );
  });
});
