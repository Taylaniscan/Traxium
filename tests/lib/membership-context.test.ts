import { MembershipStatus, OrganizationRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_ORGANIZATION_ID,
  OTHER_ORGANIZATION_ID,
  createSessionUser,
} from "../helpers/security-fixtures";

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import {
  buildOrganizationUserWhere,
  getActiveOrganizationContext,
  resolveTenantContext,
} from "@/lib/organizations";

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

function createActiveOrganizationContextUserRecord(
  overrides: Partial<{
    activeOrganizationId: string | null;
    memberships: Array<ReturnType<typeof createMembership>>;
  }> = {}
) {
  return {
    activeOrganizationId: DEFAULT_ORGANIZATION_ID,
    memberships: [createMembership(DEFAULT_ORGANIZATION_ID)],
    ...overrides,
  };
}

describe("lib/organizations membership context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves the active organization context from the user's active membership", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      createActiveOrganizationContextUserRecord({
        memberships: [
          createMembership(DEFAULT_ORGANIZATION_ID, {
            role: OrganizationRole.ADMIN,
          }),
          createMembership(OTHER_ORGANIZATION_ID),
        ],
      })
    );

    await expect(getActiveOrganizationContext("user-1")).resolves.toEqual({
      organizationId: DEFAULT_ORGANIZATION_ID,
      activeOrganizationId: DEFAULT_ORGANIZATION_ID,
      activeOrganization: {
        membershipId: `membership-${DEFAULT_ORGANIZATION_ID}`,
        organizationId: DEFAULT_ORGANIZATION_ID,
        membershipRole: OrganizationRole.ADMIN,
        membershipStatus: MembershipStatus.ACTIVE,
      },
    });
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: {
        activeOrganizationId: true,
        memberships: {
          where: {
            status: MembershipStatus.ACTIVE,
          },
          select: {
            id: true,
            organizationId: true,
            role: true,
            status: true,
          },
          orderBy: [{ createdAt: "asc" }, { organizationId: "asc" }],
        },
      },
    });
  });

  it("rejects access when the user has no active membership for the selected organization", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      createActiveOrganizationContextUserRecord({
        activeOrganizationId: OTHER_ORGANIZATION_ID,
        memberships: [createMembership(DEFAULT_ORGANIZATION_ID)],
      })
    );

    await expect(getActiveOrganizationContext("user-1")).rejects.toThrow(
      "Active organization membership is required."
    );
  });

  it("builds tenant-scoped filters from different active organization contexts for the same user", () => {
    const orgOneUser = createSessionUser();
    const orgTwoUser = createSessionUser({
      organizationId: OTHER_ORGANIZATION_ID,
      activeOrganizationId: OTHER_ORGANIZATION_ID,
      activeOrganization: {
        membershipId: `membership-${OTHER_ORGANIZATION_ID}`,
        organizationId: OTHER_ORGANIZATION_ID,
        membershipRole: OrganizationRole.ADMIN,
        membershipStatus: MembershipStatus.ACTIVE,
      },
    });

    expect(resolveTenantContext(orgOneUser)).toEqual({
      organizationId: DEFAULT_ORGANIZATION_ID,
    });
    expect(resolveTenantContext(orgTwoUser)).toEqual({
      organizationId: OTHER_ORGANIZATION_ID,
    });
    expect(buildOrganizationUserWhere(orgOneUser)).toEqual({
      memberships: {
        some: {
          organizationId: DEFAULT_ORGANIZATION_ID,
          status: MembershipStatus.ACTIVE,
        },
      },
    });
    expect(buildOrganizationUserWhere(orgTwoUser)).toEqual({
      memberships: {
        some: {
          organizationId: OTHER_ORGANIZATION_ID,
          status: MembershipStatus.ACTIVE,
        },
      },
    });
  });
});
