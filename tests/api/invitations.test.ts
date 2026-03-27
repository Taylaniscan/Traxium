import {
  InvitationStatus,
  MembershipStatus,
  OrganizationRole,
} from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_ORGANIZATION_ID,
  DEFAULT_USER_ID,
  createSessionUser,
} from "../helpers/security-fixtures";

const requireOrganizationMock = vi.hoisted(() => vi.fn());
const createAuthGuardErrorResponseMock = vi.hoisted(() => vi.fn());
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
  invitation: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  requireOrganization: requireOrganizationMock,
  createAuthGuardErrorResponse: createAuthGuardErrorResponseMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: createSupabaseAdminClientMock,
  createSupabasePublicClient: createSupabasePublicClientMock,
}));

import { GET as getInvitationByTokenRoute } from "@/app/api/invitations/[token]/route";
import { POST as createInvitationRoute } from "@/app/api/invitations/route";

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
    email: "new.user@example.com",
    role: OrganizationRole.MEMBER,
    token: "token-123",
    status: InvitationStatus.PENDING,
    expiresAt: new Date("2026-03-31T12:00:00.000Z"),
    invitedByUserId: DEFAULT_USER_ID,
    createdAt: new Date("2026-03-24T12:00:00.000Z"),
    updatedAt: new Date("2026-03-24T12:00:00.000Z"),
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

function createInvitationTransactionMock() {
  return {
    invitation: {
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    },
  };
}

describe("invitations routes", () => {
  let tx: ReturnType<typeof createInvitationTransactionMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-24T12:00:00.000Z"));
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    tx = createInvitationTransactionMock();

    requireOrganizationMock.mockResolvedValue(
      createSessionUser({
        name: "Admin User",
        email: "admin@example.com",
        activeOrganization: {
          membershipId: "membership-admin",
          organizationId: DEFAULT_ORGANIZATION_ID,
          membershipRole: OrganizationRole.ADMIN,
          membershipStatus: MembershipStatus.ACTIVE,
        },
      })
    );
    createAuthGuardErrorResponseMock.mockReturnValue(null);
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
    createSupabaseAdminClientMock.mockReturnValue({
      auth: {
        admin: {
          generateLink: generateLinkMock,
          inviteUserByEmail: inviteUserByEmailMock,
        },
      },
    });
    createSupabasePublicClientMock.mockReturnValue({
      auth: {
        signInWithOtp: signInWithOtpMock,
      },
    });
    generateLinkMock.mockResolvedValue({
      data: {
        properties: {
          action_link: "https://kdsfmmwmpdhtezwdqbnk.supabase.co/auth/v1/verify?type=invite&token=generated",
          email_otp: "123456",
          hashed_token: "hashed-token",
          redirect_to: "http://localhost:3000/invite/token-123?mode=setup",
          verification_type: "invite",
        },
        user: {
          id: "auth-user-1",
        },
      },
      error: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates an invitation and sends a real invite email through Supabase Auth", async () => {
    const createdInvitation = createInvitationRecord();

    tx.invitation.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 });
    tx.user.findFirst.mockResolvedValueOnce(null);
    tx.invitation.create.mockResolvedValueOnce(createdInvitation);

    const response = await createInvitationRoute(
      new Request("http://localhost/api/invitations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: "New.User@Example.com",
          role: "MEMBER",
        }),
      })
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      invitation: {
        id: "invite-1",
        organizationId: DEFAULT_ORGANIZATION_ID,
        email: "new.user@example.com",
        role: OrganizationRole.MEMBER,
        token: "token-123",
        status: InvitationStatus.PENDING,
        expiresAt: "2026-03-31T12:00:00.000Z",
        invitedByUserId: DEFAULT_USER_ID,
        createdAt: "2026-03-24T12:00:00.000Z",
        updatedAt: "2026-03-24T12:00:00.000Z",
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
      },
      delivery: {
        channel: "invite",
        redirectTo: "http://localhost:3000/invite/token-123?mode=setup",
        transport: "supabase-auth",
      },
    });
    expect(inviteUserByEmailMock).toHaveBeenCalledWith("new.user@example.com", {
      redirectTo: "http://localhost:3000/invite/token-123?mode=setup",
      data: {
        invitation_email: "new.user@example.com",
        invitation_role: OrganizationRole.MEMBER,
        invitation_role_label: "Member",
        invitation_expires_at: "2026-03-31T12:00:00.000Z",
        invitation_workspace_name: "Atlas Procurement",
        invitation_workspace_slug: "atlas-procurement",
        invitation_token: "token-123",
      },
    });
    expect(signInWithOtpMock).not.toHaveBeenCalled();
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        organizationId: DEFAULT_ORGANIZATION_ID,
        userId: DEFAULT_USER_ID,
        actorUserId: DEFAULT_USER_ID,
        targetUserId: null,
        targetEntityId: "invite-1",
        eventType: "invite.created",
        action: "invite.created",
        detail: "Created a Member invitation.",
        payload: {
          invitationRole: OrganizationRole.MEMBER,
          deliveryChannel: "invite",
          deliveryTransport: "supabase-auth",
          requiresManualDelivery: false,
        },
      },
    });
  });

  it("falls back to an invite acceptance magic link when the invited email already has an auth account", async () => {
    const createdInvitation = createInvitationRecord();

    tx.invitation.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 });
    tx.user.findFirst.mockResolvedValueOnce(null);
    tx.invitation.create.mockResolvedValueOnce(createdInvitation);
    inviteUserByEmailMock.mockResolvedValueOnce({
      data: { user: null },
      error: {
        message: "A user has already been registered with this email address.",
      },
    });

    const response = await createInvitationRoute(
      new Request("http://localhost/api/invitations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: "new.user@example.com",
          role: "MEMBER",
        }),
      })
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      delivery: {
        channel: "magic_link",
        redirectTo: "http://localhost:3000/invite/token-123?mode=accept",
        transport: "supabase-auth",
      },
    });
    expect(signInWithOtpMock).toHaveBeenCalledWith({
      email: "new.user@example.com",
      options: {
        shouldCreateUser: false,
        emailRedirectTo: "http://localhost:3000/invite/token-123?mode=accept",
      },
    });
  });

  it("falls back to a generated invite action link when Supabase hosted email delivery is rate limited", async () => {
    const createdInvitation = createInvitationRecord();

    tx.invitation.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 });
    tx.user.findFirst.mockResolvedValueOnce(null);
    tx.invitation.create.mockResolvedValueOnce(createdInvitation);
    inviteUserByEmailMock.mockResolvedValueOnce({
      data: { user: null },
      error: {
        message: "Email rate limit exceeded",
      },
    });

    const response = await createInvitationRoute(
      new Request("http://localhost/api/invitations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: "new.user@example.com",
          role: "MEMBER",
        }),
      })
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      delivery: {
        channel: "invite",
        redirectTo: "http://localhost:3000/invite/token-123?mode=setup",
        transport: "generated-link",
        actionLink:
          "https://kdsfmmwmpdhtezwdqbnk.supabase.co/auth/v1/verify?type=invite&token=generated",
        requiresManualDelivery: true,
      },
    });
    expect(generateLinkMock).toHaveBeenCalledWith({
      type: "invite",
      email: "new.user@example.com",
      options: {
        redirectTo: "http://localhost:3000/invite/token-123?mode=setup",
        data: {
          invitation_email: "new.user@example.com",
          invitation_role: OrganizationRole.MEMBER,
          invitation_role_label: "Member",
          invitation_expires_at: "2026-03-31T12:00:00.000Z",
          invitation_workspace_name: "Atlas Procurement",
          invitation_workspace_slug: "atlas-procurement",
          invitation_token: "token-123",
        },
      },
    });
    expect(signInWithOtpMock).not.toHaveBeenCalled();
  });

  it("prevents a normal member from creating an invitation", async () => {
    requireOrganizationMock.mockResolvedValueOnce(createSessionUser());

    const response = await createInvitationRoute(
      new Request("http://localhost/api/invitations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: "teammate@example.com",
          role: "MEMBER",
        }),
      })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Forbidden.",
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("reads an invitation by token", async () => {
    mockPrisma.invitation.findUnique.mockResolvedValueOnce(createInvitationRecord());

    const response = await getInvitationByTokenRoute(new Request("http://localhost"), {
      params: Promise.resolve({ token: "token-123" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      invitation: {
        id: "invite-1",
        email: "new.user@example.com",
        role: OrganizationRole.MEMBER,
        status: InvitationStatus.PENDING,
        expiresAt: "2026-03-31T12:00:00.000Z",
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
        createdAt: "2026-03-24T12:00:00.000Z",
        updatedAt: "2026-03-24T12:00:00.000Z",
      },
    });
  });

  it("returns gone for an expired invitation token", async () => {
    mockPrisma.invitation.findUnique.mockResolvedValueOnce(
      createInvitationRecord({
        expiresAt: new Date("2026-03-20T12:00:00.000Z"),
      })
    );
    mockPrisma.invitation.update.mockResolvedValueOnce(
      createInvitationRecord({
        status: InvitationStatus.EXPIRED,
        expiresAt: new Date("2026-03-20T12:00:00.000Z"),
        updatedAt: new Date("2026-03-24T12:30:00.000Z"),
      })
    );

    const response = await getInvitationByTokenRoute(new Request("http://localhost"), {
      params: Promise.resolve({ token: "token-123" }),
    });

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toEqual({
      error: "This invitation has expired.",
      invitation: {
        id: "invite-1",
        email: "new.user@example.com",
        role: OrganizationRole.MEMBER,
        status: InvitationStatus.EXPIRED,
        expiresAt: "2026-03-20T12:00:00.000Z",
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
        createdAt: "2026-03-24T12:00:00.000Z",
        updatedAt: "2026-03-24T12:30:00.000Z",
      },
    });
  });
});
