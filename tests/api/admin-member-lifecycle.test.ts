import {
  InvitationStatus,
  MembershipStatus,
  OrganizationRole,
  Role,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_ORGANIZATION_ID,
  DEFAULT_USER_ID,
  createAuthGuardJsonResponse,
  createSessionUser,
} from "../helpers/security-fixtures";

const requireOrganizationMock = vi.hoisted(() => vi.fn());
const createSupabaseAdminClientMock = vi.hoisted(() => vi.fn());
const createSupabasePublicClientMock = vi.hoisted(() => vi.fn());
const inviteUserByEmailMock = vi.hoisted(() => vi.fn());
const generateLinkMock = vi.hoisted(() => vi.fn());
const signInWithOtpMock = vi.hoisted(() => vi.fn());

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  auditLog: {
    create: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  requireOrganization: requireOrganizationMock,
  createAuthGuardErrorResponse: createAuthGuardJsonResponse,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: createSupabaseAdminClientMock,
  createSupabasePublicClient: createSupabasePublicClientMock,
}));

import { DELETE as removeMemberRoute } from "@/app/api/admin/members/[membershipId]/route";
import { DELETE as revokeInvitationRoute } from "@/app/api/admin/invitations/[invitationId]/route";
import { POST as resendInvitationRoute } from "@/app/api/admin/invitations/[invitationId]/resend/route";

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
    role: OrganizationRole.MEMBER,
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
    status: InvitationStatus.PENDING,
    expiresAt: new Date("2026-04-02T12:00:00.000Z"),
    invitedByUserId: DEFAULT_USER_ID,
    createdAt: new Date("2026-03-26T12:00:00.000Z"),
    updatedAt: new Date("2026-03-26T12:00:00.000Z"),
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

function createLifecycleTransactionMock() {
  return {
    organizationMembership: {
      findUnique: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
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

describe("admin member lifecycle routes", () => {
  let tx: ReturnType<typeof createLifecycleTransactionMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    tx = createLifecycleTransactionMock();

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

    inviteUserByEmailMock.mockResolvedValue({
      data: { user: { id: "auth-user-1" } },
      error: null,
    });
    signInWithOtpMock.mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    });
    generateLinkMock.mockResolvedValue({
      data: {
        properties: {
          action_link: "http://localhost:3000/generated-invite-link",
          redirect_to: "http://localhost:3000/invite/token-123?mode=setup",
          verification_type: "invite",
        },
      },
      error: null,
    });
    createSupabaseAdminClientMock.mockReturnValue({
      auth: {
        admin: {
          inviteUserByEmail: inviteUserByEmailMock,
          generateLink: generateLinkMock,
        },
      },
    });
    createSupabasePublicClientMock.mockReturnValue({
      auth: {
        signInWithOtp: signInWithOtpMock,
      },
    });
  });

  it("allows an admin to remove a member from the active organization", async () => {
    tx.organizationMembership.findUnique.mockResolvedValueOnce(
      createMembershipRecord()
    );
    tx.user.findUnique.mockResolvedValueOnce({
      activeOrganizationId: DEFAULT_ORGANIZATION_ID,
      memberships: [{ organizationId: DEFAULT_ORGANIZATION_ID }],
    });
    tx.organizationMembership.delete.mockResolvedValueOnce({ id: "membership-2" });
    tx.user.update.mockResolvedValueOnce({
      id: "user-2",
      activeOrganizationId: null,
    });

    const response = await removeMemberRoute(new Request("http://localhost"), {
      params: Promise.resolve({ membershipId: "membership-2" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      message: "Jamie Buyer was removed from the workspace.",
      membership: {
        id: "membership-2",
        userId: "user-2",
        name: "Jamie Buyer",
        email: "jamie@example.com",
        role: OrganizationRole.MEMBER,
        membershipStatus: MembershipStatus.ACTIVE,
        joinedAt: "2026-03-20T09:00:00.000Z",
        createdAt: "2026-03-18T09:00:00.000Z",
        updatedAt: "2026-03-21T09:00:00.000Z",
      },
    });
    expect(tx.organizationMembership.delete).toHaveBeenCalledWith({
      where: {
        id: "membership-2",
      },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        organizationId: DEFAULT_ORGANIZATION_ID,
        userId: DEFAULT_USER_ID,
        actorUserId: DEFAULT_USER_ID,
        targetUserId: "user-2",
        targetEntityId: "membership-2",
        eventType: "member.removed",
        action: "member.removed",
        detail: "Removed Jamie Buyer from the workspace.",
        payload: {
          membershipId: "membership-2",
          removedRole: OrganizationRole.MEMBER,
        },
      },
    });
  });

  it("does not allow a normal member to remove someone", async () => {
    requireOrganizationMock.mockResolvedValueOnce(createSessionUser());

    const response = await removeMemberRoute(new Request("http://localhost"), {
      params: Promise.resolve({ membershipId: "membership-2" }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Forbidden.",
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("prevents removing the last active owner", async () => {
    requireOrganizationMock.mockResolvedValueOnce(
      createSessionUser({
        role: Role.HEAD_OF_GLOBAL_PROCUREMENT,
        activeOrganization: {
          membershipId: "membership-owner-actor",
          organizationId: DEFAULT_ORGANIZATION_ID,
          membershipRole: OrganizationRole.OWNER,
          membershipStatus: MembershipStatus.ACTIVE,
        },
      })
    );
    tx.organizationMembership.findUnique.mockResolvedValueOnce(
      createMembershipRecord({
        id: "membership-owner-target",
        role: OrganizationRole.OWNER,
        user: {
          id: "user-owner",
          name: "Owner User",
          email: "owner@example.com",
          createdAt: new Date("2026-03-18T09:00:00.000Z"),
          updatedAt: new Date("2026-03-21T09:00:00.000Z"),
        },
      })
    );
    tx.organizationMembership.count.mockResolvedValueOnce(1);

    const response = await removeMemberRoute(new Request("http://localhost"), {
      params: Promise.resolve({ membershipId: "membership-owner-target" }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "The last active owner cannot be removed. Add another owner first.",
    });
    expect(tx.organizationMembership.delete).not.toHaveBeenCalled();
  });

  it("revokes a pending invite inside the active organization", async () => {
    tx.invitation.findUnique.mockResolvedValueOnce(createInvitationRecord());
    tx.invitation.update.mockResolvedValueOnce(
      createInvitationRecord({
        status: InvitationStatus.REVOKED,
        updatedAt: new Date("2026-03-26T12:30:00.000Z"),
      })
    );

    const response = await revokeInvitationRoute(new Request("http://localhost"), {
      params: Promise.resolve({ invitationId: "invite-1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      message: "Invitation cancelled.",
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
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        organizationId: DEFAULT_ORGANIZATION_ID,
        userId: DEFAULT_USER_ID,
        actorUserId: DEFAULT_USER_ID,
        targetUserId: null,
        targetEntityId: "invite-1",
        eventType: "invite.revoked",
        action: "invite.revoked",
        detail: "Cancelled a pending invitation.",
        payload: {
          invitationRole: OrganizationRole.MEMBER,
          status: InvitationStatus.REVOKED,
        },
      },
    });
  });

  it("resends a pending invite with the existing email delivery flow", async () => {
    tx.invitation.findUnique.mockResolvedValueOnce(createInvitationRecord());
    tx.user.findFirst.mockResolvedValueOnce(null);
    tx.invitation.update.mockResolvedValueOnce(
      createInvitationRecord({
        expiresAt: new Date("2026-04-05T12:00:00.000Z"),
        updatedAt: new Date("2026-03-26T12:45:00.000Z"),
      })
    );

    const response = await resendInvitationRoute(new Request("http://localhost"), {
      params: Promise.resolve({ invitationId: "invite-1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      message: "Invitation email sent again.",
      invitation: {
        id: "invite-1",
        organizationId: DEFAULT_ORGANIZATION_ID,
        email: "new.member@example.com",
        role: OrganizationRole.MEMBER,
        status: InvitationStatus.PENDING,
        expiresAt: "2026-04-05T12:00:00.000Z",
        createdAt: "2026-03-26T12:00:00.000Z",
        updatedAt: "2026-03-26T12:45:00.000Z",
        invitedBy: {
          id: DEFAULT_USER_ID,
          name: "Admin User",
          email: "admin@example.com",
        },
      },
      delivery: {
        channel: "invite",
        redirectTo: "http://localhost:3000/invite/token-123?mode=setup",
        transport: "supabase-auth",
      },
    });
    expect(inviteUserByEmailMock).toHaveBeenCalledWith("new.member@example.com", {
      redirectTo: "http://localhost:3000/invite/token-123?mode=setup",
      data: {
        invitation_email: "new.member@example.com",
        invitation_role: OrganizationRole.MEMBER,
        invitation_role_label: "Member",
        invitation_expires_at: "2026-04-05T12:00:00.000Z",
        invitation_workspace_name: "Atlas Procurement",
        invitation_workspace_slug: "atlas-procurement",
        invitation_token: "token-123",
      },
    });
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        organizationId: DEFAULT_ORGANIZATION_ID,
        userId: DEFAULT_USER_ID,
        actorUserId: DEFAULT_USER_ID,
        targetUserId: null,
        targetEntityId: "invite-1",
        eventType: "invite.resent",
        action: "invite.resent",
        detail: "Resent a workspace invitation.",
        payload: {
          invitationRole: OrganizationRole.MEMBER,
          deliveryChannel: "invite",
          deliveryTransport: "supabase-auth",
          requiresManualDelivery: false,
        },
      },
    });
  });
});
