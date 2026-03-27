import {
  MembershipStatus,
  OrganizationRole,
  Role,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_ORGANIZATION_ID,
  MockAuthGuardError,
  OTHER_ORGANIZATION_ID,
  createAuthGuardJsonResponse,
  createSessionUser,
} from "../helpers/security-fixtures";

const requireOrganizationMock = vi.hoisted(() => vi.fn());

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  organization: {
    findUnique: vi.fn(),
  },
  auditLog: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  requireOrganization: requireOrganizationMock,
  createAuthGuardErrorResponse: createAuthGuardJsonResponse,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { GET as getAdminAuditRoute } from "@/app/api/admin/audit/route";
import {
  GET as getAdminSettingsRoute,
  PATCH as patchAdminSettingsRoute,
} from "@/app/api/admin/settings/route";

function createOrganizationRecord(
  overrides: Partial<{
    id: string;
    name: string;
    description: string | null;
    slug: string;
    createdAt: Date;
    updatedAt: Date;
  }> = {}
) {
  return {
    id: DEFAULT_ORGANIZATION_ID,
    name: "Atlas Procurement",
    description: "Global procurement savings governance workspace.",
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

function createSettingsTransactionMock() {
  return {
    organization: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };
}

describe("admin settings and audit routes", () => {
  const settingsRequest = new Request("http://localhost/api/admin/settings", {
    method: "GET",
  });
  const auditRequest = new Request("http://localhost/api/admin/audit", {
    method: "GET",
  });

  let tx: ReturnType<typeof createSettingsTransactionMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    tx = createSettingsTransactionMock();

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

    mockPrisma.organization.findUnique.mockResolvedValue(createOrganizationRecord());
    mockPrisma.auditLog.findMany.mockResolvedValue([
      createAuditEventRecord(),
    ]);
    mockPrisma.$transaction.mockImplementation(async (callback: unknown) => {
      if (typeof callback !== "function") {
        throw new Error("Expected transaction callback.");
      }

      const transactionCallback = callback as (client: typeof tx) => Promise<unknown>;
      return transactionCallback(tx);
    });
  });

  it("allows an admin to read workspace settings", async () => {
    const response = await getAdminSettingsRoute(settingsRequest);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      organization: {
        id: DEFAULT_ORGANIZATION_ID,
        name: "Atlas Procurement",
        description: "Global procurement savings governance workspace.",
        slug: "atlas-procurement",
        createdAt: "2026-03-20T09:00:00.000Z",
        updatedAt: "2026-03-26T12:00:00.000Z",
      },
    });
  });

  it("allows an admin to update workspace settings", async () => {
    tx.organization.findUnique.mockResolvedValueOnce(createOrganizationRecord());
    tx.organization.update.mockResolvedValueOnce(
      createOrganizationRecord({
        name: "Atlas Procurement Europe",
        description: "European sourcing governance workspace.",
        updatedAt: new Date("2026-03-26T13:00:00.000Z"),
      })
    );

    const response = await patchAdminSettingsRoute(
      new Request("http://localhost/api/admin/settings", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Atlas Procurement Europe",
          description: "European sourcing governance workspace.",
        }),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      message: "Workspace settings saved.",
      organization: {
        id: DEFAULT_ORGANIZATION_ID,
        name: "Atlas Procurement Europe",
        description: "European sourcing governance workspace.",
        slug: "atlas-procurement",
        createdAt: "2026-03-20T09:00:00.000Z",
        updatedAt: "2026-03-26T13:00:00.000Z",
      },
    });
    expect(tx.organization.update).toHaveBeenCalledWith({
      where: {
        id: DEFAULT_ORGANIZATION_ID,
      },
      data: {
        name: "Atlas Procurement Europe",
        description: "European sourcing governance workspace.",
      },
      select: expect.any(Object),
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        organizationId: DEFAULT_ORGANIZATION_ID,
        userId: "user-1",
        actorUserId: "user-1",
        targetUserId: null,
        targetEntityId: DEFAULT_ORGANIZATION_ID,
        eventType: "workspace.updated",
        action: "workspace.updated",
        detail: "Workspace settings updated for Atlas Procurement Europe.",
        payload: {
          changedFields: ["name", "description"],
        },
      },
    });
  });

  it("does not allow a normal member to access admin settings", async () => {
    requireOrganizationMock.mockResolvedValueOnce(createSessionUser());

    const response = await getAdminSettingsRoute(settingsRequest);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Forbidden.",
    });
    expect(mockPrisma.organization.findUnique).not.toHaveBeenCalled();
  });

  it("returns only active-organization admin audit events", async () => {
    const response = await getAdminAuditRoute(auditRequest);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      organizationId: DEFAULT_ORGANIZATION_ID,
      events: [
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
      ],
    });
    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: DEFAULT_ORGANIZATION_ID,
        OR: [
          {
            eventType: {
              in: [
                "member.role_changed",
                "member.removed",
                "invite.created",
                "invite.revoked",
                "invite.resent",
                "workspace.updated",
                "onboarding.workspace_created",
              ],
            },
          },
          {
            action: {
              in: [
                "member.role_changed",
                "member.removed",
                "invite.created",
                "invite.revoked",
                "invite.resent",
                "workspace.updated",
                "onboarding.workspace_created",
                "membership.role_updated",
                "membership.removed",
                "invitation.created",
                "invitation.revoked",
                "invitation.resent",
                "workspace.settings_updated",
              ],
            },
          },
        ],
      },
      select: expect.any(Object),
      orderBy: [{ createdAt: "desc" }],
      take: 20,
    });
  });

  it("does not leak tenant-external audit records", async () => {
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
    mockPrisma.auditLog.findMany.mockResolvedValueOnce([
      createAuditEventRecord({
        id: "audit-2",
        organizationId: OTHER_ORGANIZATION_ID,
        eventType: "workspace.updated",
        action: "workspace.updated",
        detail: "Workspace settings updated for Other Org.",
      }),
    ]);

    const response = await getAdminAuditRoute(auditRequest);

    expect(response.status).toBe(200);
    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: OTHER_ORGANIZATION_ID,
        OR: [
          {
            eventType: {
              in: [
                "member.role_changed",
                "member.removed",
                "invite.created",
                "invite.revoked",
                "invite.resent",
                "workspace.updated",
                "onboarding.workspace_created",
              ],
            },
          },
          {
            action: {
              in: [
                "member.role_changed",
                "member.removed",
                "invite.created",
                "invite.revoked",
                "invite.resent",
                "workspace.updated",
                "onboarding.workspace_created",
                "membership.role_updated",
                "membership.removed",
                "invitation.created",
                "invitation.revoked",
                "invitation.resent",
                "workspace.settings_updated",
              ],
            },
          },
        ],
      },
      select: expect.any(Object),
      orderBy: [{ createdAt: "desc" }],
      take: 20,
    });
  });

  it("uses auth guard responses when no authenticated organization context exists", async () => {
    requireOrganizationMock.mockRejectedValueOnce(
      new MockAuthGuardError("Authenticated session is required.", 401, "UNAUTHENTICATED")
    );

    const response = await getAdminAuditRoute(auditRequest);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized.",
    });
  });
});
