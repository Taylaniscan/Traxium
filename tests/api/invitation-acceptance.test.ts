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
  createAuthSessionUser,
} from "../helpers/security-fixtures";

const ACTIVE_INVITATION_EXPIRES_AT = new Date("2099-03-31T12:00:00.000Z");
const ACTIVE_INVITATION_EXPIRES_AT_ISO =
  ACTIVE_INVITATION_EXPIRES_AT.toISOString();

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

import { POST } from "@/app/api/invitations/[token]/accept/route";

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
    name: "Invited User",
    email: "new.user@example.com",
    role: Role.TACTICAL_BUYER,
    activeOrganizationId: null,
    memberships: [],
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
    email: "new.user@example.com",
    role: OrganizationRole.MEMBER,
    token: "token-123",
    status: InvitationStatus.PENDING,
    expiresAt: ACTIVE_INVITATION_EXPIRES_AT,
    invitedByUserId: "admin-user-1",
    createdAt: new Date("2026-03-24T12:00:00.000Z"),
    updatedAt: new Date("2026-03-24T12:00:00.000Z"),
    organization: {
      id: DEFAULT_ORGANIZATION_ID,
      name: "Atlas Procurement",
      slug: "atlas-procurement",
    },
    invitedBy: {
      id: "admin-user-1",
      name: "Admin User",
      email: "admin@example.com",
    },
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
    invitation: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    organizationMembership: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    user: {
      update: vi.fn(),
    },
  };
}

describe("invitation acceptance route", () => {
  let tx: ReturnType<typeof createTransactionMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    tx = createTransactionMock();

    mockAuthenticatedSession(
      createAuthSessionUser({
        email: "new.user@example.com",
        app_metadata: {
          userId: DEFAULT_USER_ID,
        },
      })
    );
    mockPrisma.user.findUnique.mockResolvedValue(createResolvedUserRecord());
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

  it("accepts an invitation when the signed-in email matches", async () => {
    tx.invitation.findUnique
      .mockResolvedValueOnce(createInvitationRecord())
      .mockResolvedValueOnce(
        createInvitationRecord({
          status: InvitationStatus.ACCEPTED,
        })
      );
    tx.organizationMembership.upsert.mockResolvedValueOnce({
      id: "membership-org-1",
      organizationId: DEFAULT_ORGANIZATION_ID,
      role: OrganizationRole.MEMBER,
      status: MembershipStatus.ACTIVE,
      createdAt: new Date("2026-03-24T12:05:00.000Z"),
      updatedAt: new Date("2026-03-24T12:05:00.000Z"),
    });
    tx.invitation.updateMany.mockResolvedValueOnce({ count: 1 });
    tx.user.update.mockResolvedValueOnce({
      id: DEFAULT_USER_ID,
      activeOrganizationId: DEFAULT_ORGANIZATION_ID,
    });

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ token: "token-123" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      invitation: {
        id: "invite-1",
        email: "new.user@example.com",
        role: OrganizationRole.MEMBER,
        status: InvitationStatus.ACCEPTED,
        expiresAt: ACTIVE_INVITATION_EXPIRES_AT_ISO,
        organization: {
          id: DEFAULT_ORGANIZATION_ID,
          name: "Atlas Procurement",
          slug: "atlas-procurement",
        },
        invitedBy: {
          id: "admin-user-1",
          name: "Admin User",
          email: "admin@example.com",
        },
      },
      membership: {
        id: "membership-org-1",
        organizationId: DEFAULT_ORGANIZATION_ID,
        role: OrganizationRole.MEMBER,
        status: MembershipStatus.ACTIVE,
        createdAt: "2026-03-24T12:05:00.000Z",
        updatedAt: "2026-03-24T12:05:00.000Z",
      },
      activeOrganizationId: DEFAULT_ORGANIZATION_ID,
    });
    expect(updateUserByIdMock).toHaveBeenCalledWith("auth-user-1", {
      app_metadata: {
        userId: DEFAULT_USER_ID,
        activeOrganizationId: DEFAULT_ORGANIZATION_ID,
      },
    });
  });

  it("rejects acceptance when the signed-in email does not match the invitation email", async () => {
    mockAuthenticatedSession(
      createAuthSessionUser({
        email: "someone.else@example.com",
        app_metadata: {
          userId: DEFAULT_USER_ID,
        },
      })
    );
    mockPrisma.user.findUnique.mockResolvedValueOnce(
      createResolvedUserRecord({
        email: "someone.else@example.com",
      })
    );
    tx.invitation.findUnique.mockResolvedValueOnce(createInvitationRecord());

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ token: "token-123" }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "This invitation does not match the signed-in account.",
    });
    expect(tx.organizationMembership.upsert).not.toHaveBeenCalled();
    expect(updateUserByIdMock).not.toHaveBeenCalled();
  });

  it("treats a second acceptance attempt as a safe idempotent success when membership already exists", async () => {
    tx.invitation.findUnique.mockResolvedValueOnce(
      createInvitationRecord({
        status: InvitationStatus.ACCEPTED,
      })
    );
    tx.organizationMembership.findUnique.mockResolvedValueOnce({
      id: "membership-org-1",
      organizationId: DEFAULT_ORGANIZATION_ID,
      role: OrganizationRole.MEMBER,
      status: MembershipStatus.ACTIVE,
      createdAt: new Date("2026-03-24T12:05:00.000Z"),
      updatedAt: new Date("2026-03-24T12:05:00.000Z"),
    });

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ token: "token-123" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      invitation: {
        id: "invite-1",
        email: "new.user@example.com",
        role: OrganizationRole.MEMBER,
        status: InvitationStatus.ACCEPTED,
        expiresAt: ACTIVE_INVITATION_EXPIRES_AT_ISO,
        organization: {
          id: DEFAULT_ORGANIZATION_ID,
          name: "Atlas Procurement",
          slug: "atlas-procurement",
        },
        invitedBy: {
          id: "admin-user-1",
          name: "Admin User",
          email: "admin@example.com",
        },
      },
      membership: {
        id: "membership-org-1",
        organizationId: DEFAULT_ORGANIZATION_ID,
        role: OrganizationRole.MEMBER,
        status: MembershipStatus.ACTIVE,
        createdAt: "2026-03-24T12:05:00.000Z",
        updatedAt: "2026-03-24T12:05:00.000Z",
      },
      activeOrganizationId: DEFAULT_ORGANIZATION_ID,
    });
    expect(tx.organizationMembership.upsert).not.toHaveBeenCalled();
  });

  it("does not allow an expired invitation to be accepted", async () => {
    tx.invitation.findUnique.mockResolvedValueOnce(
      createInvitationRecord({
        status: InvitationStatus.EXPIRED,
        expiresAt: new Date("2026-03-20T12:00:00.000Z"),
      })
    );

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ token: "token-123" }),
    });

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toEqual({
      error: "This invitation has expired.",
    });
    expect(tx.organizationMembership.upsert).not.toHaveBeenCalled();
  });
});
