import {
  InvitationStatus,
  MembershipStatus,
  OrganizationRole,
  Role,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_ORGANIZATION_ID,
  createAuthSessionUser,
} from "../helpers/security-fixtures";

const ACTIVE_INVITATION_EXPIRES_AT = new Date("2099-03-31T12:00:00.000Z");
const ACTIVE_INVITATION_EXPIRES_AT_ISO =
  ACTIVE_INVITATION_EXPIRES_AT.toISOString();

const createSupabaseServerClientMock = vi.hoisted(() => vi.fn());
const createSupabaseAdminClientMock = vi.hoisted(() => vi.fn());
const updateUserByIdMock = vi.hoisted(() => vi.fn());
const authUpdateUserMock = vi.hoisted(() => vi.fn());
const createAuthUserMock = vi.hoisted(() => vi.fn());
const listUsersMock = vi.hoisted(() => vi.fn());

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  invitation: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock,
  createSupabaseAdminClient: createSupabaseAdminClientMock,
}));

import { POST } from "@/app/api/invitations/[token]/complete/route";

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

function createTransactionMock() {
  return {
    invitation: {
      findUnique: vi.fn(),
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

describe("invitation account setup route", () => {
  let tx: ReturnType<typeof createTransactionMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    tx = createTransactionMock();

    createSupabaseServerClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: null,
          },
          error: null,
        }),
        updateUser: authUpdateUserMock,
      },
    });
    authUpdateUserMock.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    createSupabaseAdminClientMock.mockReturnValue({
      auth: {
        admin: {
          createUser: createAuthUserMock,
          listUsers: listUsersMock,
          updateUserById: updateUserByIdMock,
        },
      },
    });
    updateUserByIdMock.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    createAuthUserMock.mockResolvedValue({
      data: {
        user: createAuthSessionUser({
          email: "new.user@example.com",
          app_metadata: {},
          user_metadata: {},
        }),
      },
      error: null,
    });
    listUsersMock.mockResolvedValue({
      data: {
        users: [],
        nextPage: null,
      },
      error: null,
    });
    mockPrisma.$transaction.mockImplementation(async (callback: unknown) => {
      if (typeof callback !== "function") {
        throw new Error("Expected transaction callback.");
      }

      const transactionCallback = callback as (client: typeof tx) => Promise<unknown>;
      return transactionCallback(tx);
    });
  });

  it("lets a newly invited user create a password and complete account setup", async () => {
    mockPrisma.invitation.findUnique.mockResolvedValueOnce(createInvitationRecord());
    mockPrisma.user.findMany.mockResolvedValueOnce([]);
    mockPrisma.user.create.mockResolvedValueOnce({
      id: "user-new",
      name: "New User",
      email: "new.user@example.com",
      role: Role.TACTICAL_BUYER,
      activeOrganizationId: DEFAULT_ORGANIZATION_ID,
    });
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

    const response = await POST(
      new Request("http://localhost/api/invitations/token-123/complete", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "New User",
          password: "Stronger12345",
          confirmPassword: "Stronger12345",
        }),
      }),
      {
        params: Promise.resolve({ token: "token-123" }),
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      email: "new.user@example.com",
      userId: "user-new",
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
    expect(createAuthUserMock).toHaveBeenCalledWith({
      email: "new.user@example.com",
      password: "Stronger12345",
      email_confirm: true,
      user_metadata: {
        name: "New User",
        full_name: "New User",
      },
      app_metadata: {
        userId: "user-new",
        activeOrganizationId: DEFAULT_ORGANIZATION_ID,
      },
    });
    expect(authUpdateUserMock).not.toHaveBeenCalled();
    expect(updateUserByIdMock).not.toHaveBeenCalled();
  });

  it("rejects setup when the authenticated email does not match the invitation email", async () => {
    createSupabaseServerClientMock.mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: createAuthSessionUser({
              email: "wrong.user@example.com",
              app_metadata: {},
              user_metadata: {},
            }),
          },
          error: null,
        }),
        updateUser: authUpdateUserMock,
      },
    });
    mockPrisma.invitation.findUnique.mockResolvedValueOnce(createInvitationRecord());

    const response = await POST(
      new Request("http://localhost/api/invitations/token-123/complete", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Wrong User",
          password: "Stronger12345",
          confirmPassword: "Stronger12345",
        }),
      }),
      {
        params: Promise.resolve({ token: "token-123" }),
      }
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error:
        "This invitation belongs to new.user@example.com. Sign in with that email to continue.",
    });
  });

  it("treats a second setup submission as an idempotent success when the membership already exists", async () => {
    createSupabaseServerClientMock.mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: createAuthSessionUser({
              email: "new.user@example.com",
              app_metadata: {},
              user_metadata: {},
            }),
          },
          error: null,
        }),
        updateUser: authUpdateUserMock,
      },
    });
    mockPrisma.invitation.findUnique.mockResolvedValueOnce(
      createInvitationRecord({
        status: InvitationStatus.ACCEPTED,
      })
    );
    mockPrisma.user.findMany.mockResolvedValueOnce([
      {
        id: "user-existing",
        name: "Existing User",
        email: "new.user@example.com",
        role: Role.TACTICAL_BUYER,
        activeOrganizationId: DEFAULT_ORGANIZATION_ID,
      },
    ]);
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

    const response = await POST(
      new Request("http://localhost/api/invitations/token-123/complete", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Existing User",
          password: "Stronger12345",
          confirmPassword: "Stronger12345",
        }),
      }),
      {
        params: Promise.resolve({ token: "token-123" }),
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      userId: "user-existing",
      membership: {
        id: "membership-org-1",
        organizationId: DEFAULT_ORGANIZATION_ID,
      },
    });
    expect(tx.organizationMembership.upsert).not.toHaveBeenCalled();
  });

  it("requires sign-in instead of resetting an already existing auth account from a bare invite link", async () => {
    mockPrisma.invitation.findUnique.mockResolvedValueOnce(createInvitationRecord());
    listUsersMock.mockResolvedValueOnce({
      data: {
        users: [
          createAuthSessionUser({
            email: "new.user@example.com",
            app_metadata: {},
            user_metadata: {},
          }),
        ],
        nextPage: null,
      },
      error: null,
    });

    const response = await POST(
      new Request("http://localhost/api/invitations/token-123/complete", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Existing User",
          password: "Stronger12345",
          confirmPassword: "Stronger12345",
        }),
      }),
      {
        params: Promise.resolve({ token: "token-123" }),
      }
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error:
        "An account already exists for new.user@example.com. Sign in with that email to accept the invitation.",
    });
    expect(createAuthUserMock).not.toHaveBeenCalled();
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });
});
