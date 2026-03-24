import {
  MembershipStatus,
  OrganizationRole,
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
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    organization: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    organizationMembership: {
      create: vi.fn(),
    },
  };
}

describe("workspace onboarding route", () => {
  let tx: ReturnType<typeof createTransactionMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    tx = createTransactionMock();

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
    tx.organizationMembership.create.mockResolvedValueOnce({
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
    expect(tx.organizationMembership.create).toHaveBeenCalledWith({
      data: {
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
    expect(updateUserByIdMock).toHaveBeenCalledWith("auth-user-1", {
      app_metadata: {
        userId: DEFAULT_USER_ID,
        activeOrganizationId: "org-new",
      },
    });
  });

  it("does not create a duplicate initial organization once the user already has a membership", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(
      createResolvedUserRecord({
        activeOrganizationId: DEFAULT_ORGANIZATION_ID,
        memberships: [
          createMembership(DEFAULT_ORGANIZATION_ID, {
            role: OrganizationRole.ADMIN,
          }),
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

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Initial workspace onboarding is already complete for this account.",
      code: "WORKSPACE_ONBOARDING_ERROR",
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(updateUserByIdMock).not.toHaveBeenCalled();
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
    tx.organizationMembership.create.mockResolvedValueOnce({
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
        }),
      })
    );
  });
});
