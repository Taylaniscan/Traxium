import { MembershipStatus, OrganizationRole, Role } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_ORGANIZATION_ID,
  MockAuthGuardError,
  OTHER_ORGANIZATION_ID,
  createAuthGuardJsonResponse,
  createSessionUser,
} from "../helpers/security-fixtures";

const requireOrganizationMock = vi.hoisted(() => vi.fn());

const mockPrisma = vi.hoisted(() => ({
  organization: {
    findUnique: vi.fn(),
  },
  organizationMembership: {
    count: vi.fn(),
  },
  invitation: {
    count: vi.fn(),
    findFirst: vi.fn(),
  },
  savingCard: {
    count: vi.fn(),
    findFirst: vi.fn(),
  },
  auditLog: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  requireOrganization: requireOrganizationMock,
  createAuthGuardErrorResponse: createAuthGuardJsonResponse,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { GET } from "@/app/api/admin/insights/route";

function createOrganizationRecord(
  overrides: Partial<{
    id: string;
    name: string;
    slug: string;
    createdAt: Date;
    updatedAt: Date;
  }> = {}
) {
  return {
    id: DEFAULT_ORGANIZATION_ID,
    name: "Atlas Procurement",
    slug: "atlas-procurement",
    createdAt: new Date("2026-03-20T09:00:00.000Z"),
    updatedAt: new Date("2026-03-26T12:00:00.000Z"),
    ...overrides,
  };
}

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

function queueDefaultInsightsResults(organizationId = DEFAULT_ORGANIZATION_ID) {
  mockPrisma.organization.findUnique.mockResolvedValueOnce(
    createOrganizationRecord({
      id: organizationId,
      name:
        organizationId === OTHER_ORGANIZATION_ID
          ? "Other Workspace"
          : "Atlas Procurement",
      slug:
        organizationId === OTHER_ORGANIZATION_ID
          ? "other-workspace"
          : "atlas-procurement",
    })
  );
  mockPrisma.organizationMembership.count.mockResolvedValueOnce(
    organizationId === OTHER_ORGANIZATION_ID ? 1 : 3
  );
  mockPrisma.invitation.count
    .mockResolvedValueOnce(organizationId === OTHER_ORGANIZATION_ID ? 0 : 2)
    .mockResolvedValueOnce(organizationId === OTHER_ORGANIZATION_ID ? 1 : 2)
    .mockResolvedValueOnce(organizationId === OTHER_ORGANIZATION_ID ? 1 : 4)
    .mockResolvedValueOnce(organizationId === OTHER_ORGANIZATION_ID ? 0 : 3);
  mockPrisma.savingCard.count.mockResolvedValueOnce(
    organizationId === OTHER_ORGANIZATION_ID ? 0 : 2
  );
  mockPrisma.savingCard.findFirst
    .mockResolvedValueOnce(
      organizationId === OTHER_ORGANIZATION_ID
        ? null
        : {
            createdAt: new Date("2026-03-22T08:00:00.000Z"),
          }
    )
    .mockResolvedValueOnce(
      organizationId === OTHER_ORGANIZATION_ID
        ? null
        : {
            updatedAt: new Date("2026-03-26T10:15:00.000Z"),
          }
    );
  mockPrisma.invitation.findFirst
    .mockResolvedValueOnce(
      organizationId === OTHER_ORGANIZATION_ID
        ? {
            createdAt: new Date("2026-03-25T10:00:00.000Z"),
          }
        : {
            createdAt: new Date("2026-03-26T08:30:00.000Z"),
          }
    )
    .mockResolvedValueOnce(
      organizationId === OTHER_ORGANIZATION_ID
        ? null
        : {
            updatedAt: new Date("2026-03-26T09:15:00.000Z"),
          }
    );
  mockPrisma.auditLog.findMany
    .mockResolvedValueOnce([
      createAuditEventRecord({
        organizationId,
      }),
      createAuditEventRecord({
        id: "audit-2",
        organizationId,
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
    .mockResolvedValueOnce(
      organizationId === OTHER_ORGANIZATION_ID
        ? []
        : [
            createAuditEventRecord({
              id: "audit-3",
              organizationId,
              eventType: "workspace.updated",
              action: "workspace.updated",
              detail: "Workspace settings updated for Atlas Procurement.",
              createdAt: new Date("2026-03-26T10:45:00.000Z"),
              targetUserId: null,
              targetEntityId: organizationId,
              payload: {
                changedFields: ["description"],
              },
            }),
          ]
    );
  mockPrisma.auditLog.count
    .mockResolvedValueOnce(organizationId === OTHER_ORGANIZATION_ID ? 0 : 2)
    .mockResolvedValueOnce(organizationId === OTHER_ORGANIZATION_ID ? 0 : 1);
}

describe("admin insights route", () => {
  const request = new Request("http://localhost/api/admin/insights", {
    method: "GET",
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-26T15:00:00.000Z"));

    requireOrganizationMock.mockResolvedValue(
      createSessionUser({
        role: Role.HEAD_OF_GLOBAL_PROCUREMENT,
        activeOrganization: {
          membershipId: "membership-admin",
          organizationId: DEFAULT_ORGANIZATION_ID,
          membershipRole: OrganizationRole.ADMIN,
          membershipStatus: MembershipStatus.ACTIVE,
        },
      })
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows an admin to read tenant-scoped insights", async () => {
    queueDefaultInsightsResults();

    const response = await GET(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      organizationId: DEFAULT_ORGANIZATION_ID,
      insights: {
        organization: {
          id: DEFAULT_ORGANIZATION_ID,
          name: "Atlas Procurement",
          slug: "atlas-procurement",
          createdAt: "2026-03-20T09:00:00.000Z",
          updatedAt: "2026-03-26T12:00:00.000Z",
        },
        metrics: {
          totalMembers: 3,
          pendingInvites: 2,
          invitesSentLast7Days: 2,
          invitesSentLast30Days: 4,
          acceptedInvites: 3,
          liveSavingCards: 2,
          recentErrorEventsLast7Days: 1,
          recentCriticalAdminActionsLast7Days: 2,
        },
        signals: {
          workspaceCreatedAt: "2026-03-20T09:00:00.000Z",
          firstValueReached: true,
          firstValueAt: "2026-03-22T08:00:00.000Z",
          firstValueSource: "saving_card",
          lastInviteSentAt: "2026-03-26T08:30:00.000Z",
          lastAcceptedInviteAt: "2026-03-26T09:15:00.000Z",
          lastSavingCardActivityAt: "2026-03-26T10:15:00.000Z",
        },
        recentAdminActions: [
          {
            id: "audit-1",
            organizationId: DEFAULT_ORGANIZATION_ID,
            eventType: "member.role_changed",
            action: "member.role_changed",
            detail: "Changed Jamie Buyer from Member to Admin.",
            createdAt: "2026-03-26T12:30:00.000Z",
            actorUserId: "admin-user-1",
            targetUserId: "user-2",
            targetEntityId: "membership-2",
            payload: {
              membershipId: "membership-2",
              previousRole: "MEMBER",
              nextRole: "ADMIN",
            },
            actor: {
              id: "admin-user-1",
              name: "Admin User",
              email: "admin@example.com",
            },
          },
          {
            id: "audit-2",
            organizationId: DEFAULT_ORGANIZATION_ID,
            eventType: "invite.revoked",
            action: "invite.revoked",
            detail: "Cancelled the pending invitation for supplier@example.com.",
            createdAt: "2026-03-26T11:00:00.000Z",
            actorUserId: "admin-user-1",
            targetUserId: null,
            targetEntityId: "invite-2",
            payload: {
              invitationId: "invite-2",
            },
            actor: {
              id: "admin-user-1",
              name: "Admin User",
              email: "admin@example.com",
            },
          },
        ],
        recentCriticalAdminActions: [
          {
            id: "audit-3",
            organizationId: DEFAULT_ORGANIZATION_ID,
            eventType: "workspace.updated",
            action: "workspace.updated",
            detail: "Workspace settings updated for Atlas Procurement.",
            createdAt: "2026-03-26T10:45:00.000Z",
            actorUserId: "admin-user-1",
            targetUserId: null,
            targetEntityId: DEFAULT_ORGANIZATION_ID,
            payload: {
              changedFields: ["description"],
            },
            actor: {
              id: "admin-user-1",
              name: "Admin User",
              email: "admin@example.com",
            },
          },
        ],
      },
    });
  });

  it("rejects a normal member", async () => {
    requireOrganizationMock.mockResolvedValueOnce(createSessionUser());

    const response = await GET(request);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Forbidden.",
    });
    expect(mockPrisma.organization.findUnique).not.toHaveBeenCalled();
  });

  it("scopes every insights query to the active organization", async () => {
    requireOrganizationMock.mockResolvedValueOnce(
      createSessionUser({
        organizationId: OTHER_ORGANIZATION_ID,
        activeOrganizationId: OTHER_ORGANIZATION_ID,
        activeOrganization: {
          membershipId: "membership-owner",
          organizationId: OTHER_ORGANIZATION_ID,
          membershipRole: OrganizationRole.OWNER,
          membershipStatus: MembershipStatus.ACTIVE,
        },
      })
    );
    queueDefaultInsightsResults(OTHER_ORGANIZATION_ID);

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith({
      where: {
        id: OTHER_ORGANIZATION_ID,
      },
      select: expect.any(Object),
    });
    expect(mockPrisma.organizationMembership.count).toHaveBeenCalledWith({
      where: {
        organizationId: OTHER_ORGANIZATION_ID,
      },
    });
    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: OTHER_ORGANIZATION_ID,
        }),
      })
    );
  });

  it("uses auth guard responses when no authenticated organization context exists", async () => {
    requireOrganizationMock.mockRejectedValueOnce(
      new MockAuthGuardError(
        "Authenticated session is required.",
        401,
        "UNAUTHENTICATED"
      )
    );

    const response = await GET(request);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized.",
    });
  });
});
