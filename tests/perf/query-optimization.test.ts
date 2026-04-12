import { Role } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_ORGANIZATION_ID,
  OTHER_ORGANIZATION_ID,
} from "../helpers/security-fixtures";

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  organization: {
    findUnique: vi.fn(),
  },
  organizationMembership: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
  invitation: {
    count: vi.fn(),
    findMany: vi.fn(),
    groupBy: vi.fn(),
    aggregate: vi.fn(),
  },
  savingCard: {
    findMany: vi.fn(),
    aggregate: vi.fn(),
  },
  user: {
    count: vi.fn(),
    groupBy: vi.fn(),
  },
  buyer: {
    count: vi.fn(),
  },
  supplier: {
    count: vi.fn(),
  },
  material: {
    count: vi.fn(),
  },
  category: {
    count: vi.fn(),
  },
  plant: {
    count: vi.fn(),
  },
  businessUnit: {
    count: vi.fn(),
  },
  auditLog: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { getOrganizationAdminInsights } from "@/lib/admin-insights";
import { clearScopedCacheForTests } from "@/lib/cache";
import { getDashboardData, getWorkspaceReadiness } from "@/lib/data";
import { getOrganizationMembersDirectory } from "@/lib/organizations";

function createAuditEventRecord(
  overrides: Partial<{
    id: string;
    organizationId: string;
    eventType: string | null;
    action: string;
    detail: string;
    createdAt: Date;
    actorUserId: string | null;
    targetUserId: string | null;
    targetEntityId: string | null;
    payload: Record<string, unknown> | null;
    user: {
      id: string;
      name: string;
      email: string;
    } | null;
  }> = {}
) {
  return {
    id: "audit-1",
    organizationId: DEFAULT_ORGANIZATION_ID,
    eventType: "member.role_changed",
    action: "member.role_changed",
    detail: "Changed Jamie Buyer from Member to Admin.",
    createdAt: new Date("2026-03-26T12:30:00.000Z"),
    actorUserId: "admin-user-1",
    targetUserId: "user-2",
    targetEntityId: "membership-2",
    payload: {
      membershipId: "membership-2",
      previousRole: "MEMBER",
      nextRole: "ADMIN",
    },
    user: {
      id: "admin-user-1",
      name: "Admin User",
      email: "admin@example.com",
    },
    ...overrides,
  };
}

describe("query optimization helpers", () => {
  const originalCacheEnv = process.env.ENABLE_SHORT_LIVED_CACHE_IN_TESTS;

  beforeEach(() => {
    vi.clearAllMocks();
    clearScopedCacheForTests();
    delete process.env.ENABLE_SHORT_LIVED_CACHE_IN_TESTS;
    mockPrisma.$transaction.mockImplementation(
      (operations: Array<Promise<unknown>>) => Promise.all(operations)
    );
  });

  afterEach(() => {
    process.env.ENABLE_SHORT_LIVED_CACHE_IN_TESTS = originalCacheEnv;
    clearScopedCacheForTests();
  });

  it("returns a slim members directory shape without broad nested selects", async () => {
    mockPrisma.organizationMembership.findMany.mockResolvedValueOnce([
      {
        id: "membership-1",
        userId: "user-1",
        role: "ADMIN",
        status: "ACTIVE",
        createdAt: new Date("2026-03-20T09:00:00.000Z"),
        updatedAt: new Date("2026-03-26T12:00:00.000Z"),
        user: {
          name: "Admin User",
          email: "admin@example.com",
          createdAt: new Date("2026-03-18T09:00:00.000Z"),
        },
      },
    ]);
    mockPrisma.invitation.findMany.mockResolvedValueOnce([
      {
        id: "invite-1",
        email: "new.member@example.com",
        role: "MEMBER",
        status: "PENDING",
        expiresAt: new Date("2026-03-31T12:00:00.000Z"),
        createdAt: new Date("2026-03-26T08:30:00.000Z"),
        updatedAt: new Date("2026-03-26T08:30:00.000Z"),
        invitedBy: {
          id: "admin-user-1",
          name: "Admin User",
          email: "admin@example.com",
        },
      },
    ]);

    const directory = await getOrganizationMembersDirectory(DEFAULT_ORGANIZATION_ID);

    expect(mockPrisma.organizationMembership.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: DEFAULT_ORGANIZATION_ID,
      },
      select: {
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
      },
      orderBy: [{ status: "asc" }, { role: "asc" }, { createdAt: "asc" }],
    });
    expect(mockPrisma.invitation.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: DEFAULT_ORGANIZATION_ID,
        status: "PENDING",
      },
      select: {
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
      },
      orderBy: [{ createdAt: "desc" }],
    });
    expect(directory).toEqual({
      members: [
        {
          id: "membership-1",
          userId: "user-1",
          name: "Admin User",
          email: "admin@example.com",
          role: "ADMIN",
          membershipStatus: "ACTIVE",
          joinedAt: new Date("2026-03-20T09:00:00.000Z"),
          createdAt: new Date("2026-03-18T09:00:00.000Z"),
          updatedAt: new Date("2026-03-26T12:00:00.000Z"),
        },
      ],
      pendingInvites: [
        {
          id: "invite-1",
          email: "new.member@example.com",
          role: "MEMBER",
          inviteStatus: "PENDING",
          invitedAt: new Date("2026-03-26T08:30:00.000Z"),
          expiresAt: new Date("2026-03-31T12:00:00.000Z"),
          updatedAt: new Date("2026-03-26T08:30:00.000Z"),
          invitedBy: {
            id: "admin-user-1",
            name: "Admin User",
            email: "admin@example.com",
          },
        },
      ],
    });
  });

  it("computes admin insights with grouped invitation counts and aggregate card activity", async () => {
    mockPrisma.organization.findUnique.mockResolvedValueOnce({
      id: DEFAULT_ORGANIZATION_ID,
      name: "Atlas Procurement",
      slug: "atlas-procurement",
      createdAt: new Date("2026-03-20T09:00:00.000Z"),
      updatedAt: new Date("2026-03-26T12:00:00.000Z"),
    });
    mockPrisma.organizationMembership.count.mockResolvedValueOnce(3);
    mockPrisma.invitation.groupBy.mockResolvedValueOnce([
      {
        status: "PENDING",
        _count: {
          _all: 2,
        },
      },
      {
        status: "ACCEPTED",
        _count: {
          _all: 3,
        },
      },
    ]);
    mockPrisma.invitation.count.mockResolvedValueOnce(2).mockResolvedValueOnce(4);
    mockPrisma.invitation.aggregate
      .mockResolvedValueOnce({
        _max: {
          createdAt: new Date("2026-03-26T08:30:00.000Z"),
        },
      })
      .mockResolvedValueOnce({
        _max: {
          updatedAt: new Date("2026-03-26T09:15:00.000Z"),
        },
      });
    mockPrisma.savingCard.aggregate.mockResolvedValueOnce({
      _count: {
        _all: 2,
      },
      _min: {
        createdAt: new Date("2026-03-22T08:00:00.000Z"),
      },
      _max: {
        updatedAt: new Date("2026-03-26T10:15:00.000Z"),
      },
    });
    mockPrisma.auditLog.findMany
      .mockResolvedValueOnce([
        createAuditEventRecord(),
        createAuditEventRecord({
          id: "audit-2",
          eventType: "invite.revoked",
          action: "invite.revoked",
          detail: "Cancelled the pending invitation for supplier@example.com.",
          createdAt: new Date("2026-03-26T11:00:00.000Z"),
          targetUserId: null,
          targetEntityId: "invite-2",
          payload: {
            invitationId: "invite-2",
          },
        }),
      ])
      .mockResolvedValueOnce([
        createAuditEventRecord({
          id: "audit-3",
          eventType: "workspace.updated",
          action: "workspace.updated",
          detail: "Workspace settings updated for Atlas Procurement.",
          createdAt: new Date("2026-03-26T10:45:00.000Z"),
          targetUserId: null,
          targetEntityId: DEFAULT_ORGANIZATION_ID,
          payload: {
            changedFields: ["description"],
          },
        }),
      ]);
    mockPrisma.auditLog.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1);

    const insights = await getOrganizationAdminInsights(DEFAULT_ORGANIZATION_ID);

    expect(mockPrisma.invitation.groupBy).toHaveBeenCalledWith({
      by: ["status"],
      where: {
        organizationId: DEFAULT_ORGANIZATION_ID,
        status: {
          in: ["PENDING", "ACCEPTED"],
        },
      },
      orderBy: {
        status: "asc",
      },
      _count: {
        _all: true,
      },
    });
    expect(mockPrisma.savingCard.aggregate).toHaveBeenCalledWith({
      where: {
        organizationId: DEFAULT_ORGANIZATION_ID,
      },
      _count: {
        _all: true,
      },
      _min: {
        createdAt: true,
      },
      _max: {
        updatedAt: true,
      },
    });
    expect(insights.metrics).toEqual({
      totalMembers: 3,
      pendingInvites: 2,
      invitesSentLast7Days: 2,
      invitesSentLast30Days: 4,
      acceptedInvites: 3,
      liveSavingCards: 2,
      recentErrorEventsLast7Days: 1,
      recentCriticalAdminActionsLast7Days: 2,
    });
    expect(insights.signals).toEqual({
      workspaceCreatedAt: new Date("2026-03-20T09:00:00.000Z"),
      firstValueReached: true,
      firstValueAt: new Date("2026-03-22T08:00:00.000Z"),
      firstValueSource: "saving_card",
      lastInviteSentAt: new Date("2026-03-26T08:30:00.000Z"),
      lastAcceptedInviteAt: new Date("2026-03-26T09:15:00.000Z"),
      lastSavingCardActivityAt: new Date("2026-03-26T10:15:00.000Z"),
    });
  });

  it("builds workspace readiness from grouped workflow counts and aggregate card stats", async () => {
    mockPrisma.organization.findUnique.mockResolvedValueOnce({
      id: DEFAULT_ORGANIZATION_ID,
      name: "Atlas Procurement",
      slug: "atlas-procurement",
      createdAt: new Date("2026-03-20T09:00:00.000Z"),
      updatedAt: new Date("2026-03-26T12:00:00.000Z"),
    });
    mockPrisma.user.count.mockResolvedValueOnce(5);
    mockPrisma.buyer.count.mockResolvedValueOnce(2);
    mockPrisma.supplier.count.mockResolvedValueOnce(4);
    mockPrisma.material.count.mockResolvedValueOnce(6);
    mockPrisma.category.count.mockResolvedValueOnce(3);
    mockPrisma.plant.count.mockResolvedValueOnce(2);
    mockPrisma.businessUnit.count.mockResolvedValueOnce(2);
    mockPrisma.user.groupBy.mockResolvedValueOnce([
      {
        role: Role.HEAD_OF_GLOBAL_PROCUREMENT,
        _count: {
          _all: 1,
        },
      },
      {
        role: Role.GLOBAL_CATEGORY_LEADER,
        _count: {
          _all: 1,
        },
      },
      {
        role: Role.FINANCIAL_CONTROLLER,
        _count: {
          _all: 1,
        },
      },
    ]);
    mockPrisma.savingCard.aggregate.mockResolvedValueOnce({
      _count: {
        _all: 4,
      },
      _min: {
        createdAt: new Date("2026-03-21T10:00:00.000Z"),
      },
      _max: {
        updatedAt: new Date("2026-03-26T10:30:00.000Z"),
      },
    });

    const readiness = await getWorkspaceReadiness(DEFAULT_ORGANIZATION_ID);

    expect(mockPrisma.user.groupBy).toHaveBeenCalledWith({
      by: ["role"],
      where: {
        memberships: {
          some: {
            organizationId: DEFAULT_ORGANIZATION_ID,
            status: "ACTIVE",
          },
        },
        role: {
          in: [
            Role.HEAD_OF_GLOBAL_PROCUREMENT,
            Role.GLOBAL_CATEGORY_LEADER,
            Role.FINANCIAL_CONTROLLER,
          ],
        },
      },
      _count: {
        _all: true,
      },
    });
    expect(readiness.counts).toEqual({
      users: 5,
      buyers: 2,
      suppliers: 4,
      materials: 6,
      categories: 3,
      plants: 2,
      businessUnits: 2,
      savingCards: 4,
    });
    expect(readiness.activity).toEqual({
      firstSavingCardCreatedAt: new Date("2026-03-21T10:00:00.000Z"),
      lastPortfolioUpdateAt: new Date("2026-03-26T10:30:00.000Z"),
    });
  });

  it("keeps short-lived dashboard caching tenant-scoped", async () => {
    process.env.ENABLE_SHORT_LIVED_CACHE_IN_TESTS = "true";
    mockPrisma.savingCard.findMany
      .mockResolvedValueOnce([
        {
          id: "card-1",
          title: "Atlas Card",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "card-2",
          title: "Other Card",
        },
      ]);

    const firstDashboard = await getDashboardData(DEFAULT_ORGANIZATION_ID);
    const secondDashboard = await getDashboardData(DEFAULT_ORGANIZATION_ID);
    const otherDashboard = await getDashboardData(OTHER_ORGANIZATION_ID);

    expect(firstDashboard).toEqual(secondDashboard);
    expect(otherDashboard).toEqual({
      cards: [
        {
          id: "card-2",
          title: "Other Card",
        },
      ],
    });
    expect(mockPrisma.savingCard.findMany).toHaveBeenCalledTimes(2);
    expect(mockPrisma.savingCard.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        organizationId: DEFAULT_ORGANIZATION_ID,
      },
      select: expect.any(Object),
    });
    expect(mockPrisma.savingCard.findMany).toHaveBeenNthCalledWith(2, {
      where: {
        organizationId: OTHER_ORGANIZATION_ID,
      },
      select: expect.any(Object),
    });
  });
});
