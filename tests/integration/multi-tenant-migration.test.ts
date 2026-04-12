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

const mockPrisma = vi.hoisted(() => ({
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
  createSupabaseAdminClient: vi.fn(),
}));

import { getCurrentUser } from "@/lib/auth";
import { buildLegacyUserBackfill } from "@/lib/organization-membership-backfill";

function createMembership(
  organizationId = DEFAULT_ORGANIZATION_ID,
  overrides: Partial<{
    id: string;
    organizationId: string;
    role: OrganizationRole;
    status: MembershipStatus;
    createdAt: Date;
  }> = {}
) {
  return {
    id: `membership-${organizationId}`,
    organizationId,
    role: OrganizationRole.MEMBER,
    status: MembershipStatus.ACTIVE,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function createAuthenticatedAppUserRecord(
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
    name: "Migrated User",
    email: "user@example.com",
    role: Role.GLOBAL_CATEGORY_LEADER,
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

describe("multi-tenant legacy migration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticatedSession(
      createAuthSessionUser({
        app_metadata: {
          userId: DEFAULT_USER_ID,
          activeOrganizationId: DEFAULT_ORGANIZATION_ID,
          organizationId: DEFAULT_ORGANIZATION_ID,
        },
      })
    );
    mockPrisma.user.findUnique.mockResolvedValue(createAuthenticatedAppUserRecord());
    mockPrisma.user.findMany.mockResolvedValue([]);
  });

  it("backfills a legacy single-organization user into membership rows and an active organization", () => {
    const result = buildLegacyUserBackfill({
      id: DEFAULT_USER_ID,
      role: Role.GLOBAL_CATEGORY_LEADER,
      organizationId: DEFAULT_ORGANIZATION_ID,
      activeOrganizationId: null,
      memberships: [],
    });

    expect(result).toEqual({
      membershipRows: [
        {
          userId: DEFAULT_USER_ID,
          organizationId: DEFAULT_ORGANIZATION_ID,
          role: OrganizationRole.ADMIN,
          status: MembershipStatus.ACTIVE,
        },
      ],
      activeOrganizationId: DEFAULT_ORGANIZATION_ID,
    });
  });

  it("resolves auth successfully after applying the backfilled membership state", async () => {
    const backfill = buildLegacyUserBackfill({
      id: DEFAULT_USER_ID,
      role: Role.GLOBAL_CATEGORY_LEADER,
      organizationId: DEFAULT_ORGANIZATION_ID,
      activeOrganizationId: null,
      memberships: [],
    });

    mockPrisma.user.findUnique.mockResolvedValueOnce(
      createAuthenticatedAppUserRecord({
        role: Role.GLOBAL_CATEGORY_LEADER,
        activeOrganizationId: backfill.activeOrganizationId,
        memberships: backfill.membershipRows.map((membership) =>
          createMembership(membership.organizationId, {
            role: membership.role,
            status: membership.status,
          })
        ),
      })
    );

    await expect(getCurrentUser()).resolves.toEqual({
      id: DEFAULT_USER_ID,
      name: "Migrated User",
      email: "user@example.com",
      role: Role.GLOBAL_CATEGORY_LEADER,
      organizationId: DEFAULT_ORGANIZATION_ID,
      activeOrganizationId: DEFAULT_ORGANIZATION_ID,
      activeOrganization: {
        membershipId: `membership-${DEFAULT_ORGANIZATION_ID}`,
        organizationId: DEFAULT_ORGANIZATION_ID,
        membershipRole: OrganizationRole.ADMIN,
        membershipStatus: MembershipStatus.ACTIVE,
      },
    });
  });

  it("keeps existing membership state stable when legacy data is already migrated", () => {
    const result = buildLegacyUserBackfill({
      id: DEFAULT_USER_ID,
      role: Role.TACTICAL_BUYER,
      organizationId: DEFAULT_ORGANIZATION_ID,
      activeOrganizationId: OTHER_ORGANIZATION_ID,
      memberships: [
        createMembership(OTHER_ORGANIZATION_ID, {
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        }),
        createMembership(DEFAULT_ORGANIZATION_ID, {
          createdAt: new Date("2026-01-02T00:00:00.000Z"),
        }),
      ],
    });

    expect(result).toEqual({
      membershipRows: [],
      activeOrganizationId: OTHER_ORGANIZATION_ID,
    });
  });
});
