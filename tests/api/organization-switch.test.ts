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

const createSupabaseServerClientMock = vi.hoisted(() => vi.fn());
const createSupabaseAdminClientMock = vi.hoisted(() => vi.fn());
const updateUserByIdMock = vi.hoisted(() => vi.fn());

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock,
  createSupabaseAdminClient: createSupabaseAdminClientMock,
}));

import { POST } from "@/app/api/organizations/switch/route";
import { getCurrentUser } from "@/lib/auth";

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
    memberships: [
      createMembership(DEFAULT_ORGANIZATION_ID),
      createMembership(OTHER_ORGANIZATION_ID, {
        role: OrganizationRole.ADMIN,
      }),
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

describe("organization switch route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticatedSession(createAuthSessionUser());
    mockPrisma.user.findUnique.mockResolvedValue(createResolvedUserRecord());
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.update.mockResolvedValue(
      createResolvedUserRecord({
        activeOrganizationId: OTHER_ORGANIZATION_ID,
      })
    );
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

  it("allows switching between organizations that belong to the current user", async () => {
    const request = new Request("http://localhost/api/organizations/switch", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        organizationId: OTHER_ORGANIZATION_ID,
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      organizationId: OTHER_ORGANIZATION_ID,
      activeOrganizationId: OTHER_ORGANIZATION_ID,
      activeOrganization: {
        membershipId: `membership-${OTHER_ORGANIZATION_ID}`,
        organizationId: OTHER_ORGANIZATION_ID,
        membershipRole: OrganizationRole.ADMIN,
        membershipStatus: MembershipStatus.ACTIVE,
      },
    });
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: DEFAULT_USER_ID },
      data: {
        activeOrganizationId: OTHER_ORGANIZATION_ID,
      },
      select: expect.any(Object),
    });
    expect(updateUserByIdMock).toHaveBeenCalledWith("auth-user-1", {
      app_metadata: {
        userId: DEFAULT_USER_ID,
        activeOrganizationId: OTHER_ORGANIZATION_ID,
      },
    });
  });

  it("rejects switching to an organization that is not an active membership", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      createResolvedUserRecord({
        memberships: [createMembership(DEFAULT_ORGANIZATION_ID)],
      })
    );

    const request = new Request("http://localhost/api/organizations/switch", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        organizationId: OTHER_ORGANIZATION_ID,
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "You are not an active member of the requested organization.",
    });
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("resolves auth from the user's active organization in the database", async () => {
    mockAuthenticatedSession(
      createAuthSessionUser({
        app_metadata: {
          userId: DEFAULT_USER_ID,
          activeOrganizationId: DEFAULT_ORGANIZATION_ID,
          organizationId: DEFAULT_ORGANIZATION_ID,
        },
      })
    );
    mockPrisma.user.findUnique.mockResolvedValue(
      createResolvedUserRecord({
        activeOrganizationId: OTHER_ORGANIZATION_ID,
      })
    );

    await expect(getCurrentUser()).resolves.toEqual({
      id: DEFAULT_USER_ID,
      name: "Test User",
      email: "user@example.com",
      role: Role.TACTICAL_BUYER,
      organizationId: OTHER_ORGANIZATION_ID,
      activeOrganizationId: OTHER_ORGANIZATION_ID,
      activeOrganization: {
        membershipId: `membership-${OTHER_ORGANIZATION_ID}`,
        organizationId: OTHER_ORGANIZATION_ID,
        membershipRole: OrganizationRole.ADMIN,
        membershipStatus: MembershipStatus.ACTIVE,
      },
    });
  });
});
