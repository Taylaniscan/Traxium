import { InvitationStatus, MembershipStatus, OrganizationRole, Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_ORGANIZATION_ID,
  DEFAULT_USER_ID,
  createAuthGuardJsonResponse,
  createSessionUser,
} from "../helpers/security-fixtures";

const requireOrganizationMock = vi.hoisted(() => vi.fn());

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireOrganization: requireOrganizationMock,
  createAuthGuardErrorResponse: createAuthGuardJsonResponse,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: vi.fn(),
  createSupabasePublicClient: vi.fn(),
}));

import { DELETE as revokeInvitationRoute } from "@/app/api/admin/invitations/[invitationId]/route";
import { PATCH as updateMemberRoleRoute } from "@/app/api/admin/members/[membershipId]/role/route";
import { PATCH as updateSettingsRoute } from "@/app/api/admin/settings/route";

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

function createMembershipRecord(
  overrides: Partial<{
    id: string;
    userId: string;
    organizationId: string;
    role: OrganizationRole;
    status: MembershipStatus;
    createdAt: Date;
    updatedAt: Date;
    user: {
      id: string;
      name: string;
      email: string;
      createdAt: Date;
      updatedAt: Date;
    };
  }> = {}
) {
  return {
    id: "membership-2",
    userId: "user-2",
    organizationId: DEFAULT_ORGANIZATION_ID,
    role: OrganizationRole.ADMIN,
    status: MembershipStatus.ACTIVE,
    createdAt: new Date("2026-03-20T09:00:00.000Z"),
    updatedAt: new Date("2026-03-21T09:00:00.000Z"),
    user: {
      id: "user-2",
      name: "Jamie Buyer",
      email: "jamie@example.com",
      createdAt: new Date("2026-03-18T09:00:00.000Z"),
      updatedAt: new Date("2026-03-21T09:00:00.000Z"),
    },
    ...overrides,
  };
}

function createInvitationRecord(
  overrides: Partial<{
    id: string;
    organizationId: string;
    email: string;
    role: OrganizationRole;
    token: string;
    status: InvitationStatus;
    expiresAt: Date;
    invitedByUserId: string;
    createdAt: Date;
    updatedAt: Date;
  }> = {}
) {
  return {
    id: "invite-1",
    organizationId: DEFAULT_ORGANIZATION_ID,
    email: "new.member@example.com",
    role: OrganizationRole.MEMBER,
    token: "token-123",
    status: InvitationStatus.REVOKED,
    expiresAt: new Date("2026-04-02T12:00:00.000Z"),
    invitedByUserId: DEFAULT_USER_ID,
    createdAt: new Date("2026-03-26T12:00:00.000Z"),
    updatedAt: new Date("2026-03-26T12:30:00.000Z"),
    organization: {
      id: DEFAULT_ORGANIZATION_ID,
      name: "Atlas Procurement",
      slug: "atlas-procurement",
    },
    invitedBy: {
      id: DEFAULT_USER_ID,
      name: "Admin User",
      email: "admin@example.com",
    },
    ...overrides,
  };
}

function createTransactionMock() {
  return {
    organization: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    organizationMembership: {
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    invitation: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };
}

describe("admin idempotence routes", () => {
  let tx: ReturnType<typeof createTransactionMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    tx = createTransactionMock();

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

    mockPrisma.$transaction.mockImplementation(async (callback: unknown) => {
      if (typeof callback !== "function") {
        throw new Error("Expected transaction callback.");
      }

      const transactionCallback = callback as (client: typeof tx) => Promise<unknown>;
      return transactionCallback(tx);
    });
  });

  it("returns a safe success when the requested member role is already set", async () => {
    tx.organizationMembership.findUnique.mockResolvedValueOnce(createMembershipRecord());

    const response = await updateMemberRoleRoute(
      new Request("http://localhost/api/admin/members/membership-2/role", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          role: "ADMIN",
        }),
      }),
      {
        params: Promise.resolve({ membershipId: "membership-2" }),
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      message: "Role is already set to Admin.",
      membership: {
        id: "membership-2",
        userId: "user-2",
        name: "Jamie Buyer",
        email: "jamie@example.com",
        role: OrganizationRole.ADMIN,
        membershipStatus: MembershipStatus.ACTIVE,
        joinedAt: "2026-03-20T09:00:00.000Z",
        createdAt: "2026-03-18T09:00:00.000Z",
        updatedAt: "2026-03-21T09:00:00.000Z",
      },
    });
    expect(tx.organizationMembership.update).not.toHaveBeenCalled();
  });

  it("returns a safe success when workspace settings are submitted unchanged", async () => {
    tx.organization.findUnique.mockResolvedValueOnce(createOrganizationRecord());

    const response = await updateSettingsRoute(
      new Request("http://localhost/api/admin/settings", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Atlas Procurement",
          description: "Global procurement savings governance workspace.",
        }),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      message: "Workspace settings were already up to date.",
      organization: {
        id: DEFAULT_ORGANIZATION_ID,
        name: "Atlas Procurement",
        description: "Global procurement savings governance workspace.",
        slug: "atlas-procurement",
        createdAt: "2026-03-20T09:00:00.000Z",
        updatedAt: "2026-03-26T12:00:00.000Z",
      },
    });
    expect(tx.organization.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("returns a safe success when a revoked invitation is cancelled again", async () => {
    tx.invitation.findUnique.mockResolvedValueOnce(createInvitationRecord());

    const response = await revokeInvitationRoute(new Request("http://localhost"), {
      params: Promise.resolve({ invitationId: "invite-1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      message: "Invitation was already cancelled.",
      invitation: {
        id: "invite-1",
        organizationId: DEFAULT_ORGANIZATION_ID,
        email: "new.member@example.com",
        role: OrganizationRole.MEMBER,
        status: InvitationStatus.REVOKED,
        expiresAt: "2026-04-02T12:00:00.000Z",
        createdAt: "2026-03-26T12:00:00.000Z",
        updatedAt: "2026-03-26T12:30:00.000Z",
        invitedBy: {
          id: DEFAULT_USER_ID,
          name: "Admin User",
          email: "admin@example.com",
        },
      },
    });
    expect(tx.invitation.update).not.toHaveBeenCalled();
  });
});
