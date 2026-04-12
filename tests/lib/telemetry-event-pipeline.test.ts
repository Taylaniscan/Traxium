import {
  InvitationStatus,
  MembershipStatus,
  OrganizationRole,
  Role,
} from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_ORGANIZATION_ID,
  DEFAULT_USER_ID,
  createAuthSessionUser,
  createSessionUser,
} from "../helpers/security-fixtures";

const ACTIVE_INVITATION_EXPIRES_AT = new Date("2099-03-31T12:00:00.000Z");

const trackEventMock = vi.hoisted(() => vi.fn());
const createSupabaseServerClientMock = vi.hoisted(() => vi.fn());
const createSupabaseAdminClientMock = vi.hoisted(() => vi.fn());
const createSupabasePublicClientMock = vi.hoisted(() => vi.fn());
const inviteUserByEmailMock = vi.hoisted(() => vi.fn());
const signInWithOtpMock = vi.hoisted(() => vi.fn());
const updateUserByIdMock = vi.hoisted(() => vi.fn());

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  auditLog: {
    create: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/analytics", () => ({
  analyticsEventNames: {
    AUTH_LOGIN_SUCCEEDED: "auth.login.succeeded",
    ONBOARDING_WORKSPACE_CREATED: "onboarding.workspace_created",
    INVITATION_SENT: "invitation.sent",
    INVITATION_ACCEPTED: "invitation.accepted",
    WORKSPACE_SAMPLE_DATA_LOADED: "workspace.sample_data_loaded",
    ADMIN_MEMBER_ROLE_CHANGED: "admin.member_role_changed",
  },
  trackEvent: trackEventMock,
  identifyUser: vi.fn(),
  initializeAnalytics: vi.fn(),
  trackSuccessfulLogin: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock,
  createSupabaseAdminClient: createSupabaseAdminClientMock,
  createSupabasePublicClient: createSupabasePublicClientMock,
}));

import { createInitialWorkspaceOnboarding } from "@/lib/auth";
import {
  acceptOrganizationInvitation,
  createOrganizationInvitation,
  resendOrganizationInvitation,
} from "@/lib/invitations";
import { updateOrganizationMembershipRole } from "@/lib/organizations";

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
    email: "new.user@example.com",
    role: OrganizationRole.MEMBER,
    token: "token-123",
    status: InvitationStatus.PENDING,
    expiresAt: ACTIVE_INVITATION_EXPIRES_AT,
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

function createSessionUserRecord(
  overrides: Partial<{
    id: string;
    name: string;
    email: string;
    role: Role;
    activeOrganizationId: string | null;
    memberships: Array<{
      id: string;
      organizationId: string;
      role: OrganizationRole;
      status: MembershipStatus;
    }>;
  }> = {}
) {
  return {
    id: DEFAULT_USER_ID,
    name: "Test User",
    email: "user@example.com",
    role: Role.TACTICAL_BUYER,
    activeOrganizationId: null,
    memberships: [],
    ...overrides,
  };
}

function createInitialWorkspaceUserRecord(
  overrides: Partial<{
    activeOrganizationId: string | null;
    memberships: Array<{
      id: string;
      organizationId: string;
      role: OrganizationRole;
      status: MembershipStatus;
      createdAt: Date;
      updatedAt: Date;
      organization: {
        id: string;
        name: string;
        slug: string;
        createdAt: Date;
        updatedAt: Date;
      };
    }>;
  }> = {}
) {
  return {
    activeOrganizationId: null,
    memberships: [],
    ...overrides,
  };
}

function createTransactionMock() {
  return {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    organization: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    organizationMembership: {
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    invitation: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };
}

function mockAuthenticatedSession(
  authUser: ReturnType<typeof createAuthSessionUser> | null
) {
  createSupabaseServerClientMock.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: authUser },
        error: null,
      }),
    },
  });
}

describe("step 8 telemetry event pipeline", () => {
  const env = process.env as Record<string, string | undefined>;
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  let tx: ReturnType<typeof createTransactionMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    tx = createTransactionMock();
    env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

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
    updateUserByIdMock.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    createSupabaseAdminClientMock.mockReturnValue({
      auth: {
        admin: {
          inviteUserByEmail: inviteUserByEmailMock,
          updateUserById: updateUserByIdMock,
        },
      },
    });
    createSupabasePublicClientMock.mockReturnValue({
      auth: {
        signInWithOtp: signInWithOtpMock,
      },
    });
  });

  afterEach(() => {
    env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  });

  it("emits admin.member_role_changed only when a membership role actually changes", async () => {
    tx.organizationMembership.findUnique.mockResolvedValueOnce(
      createMembershipRecord()
    );
    tx.organizationMembership.update.mockResolvedValueOnce(
      createMembershipRecord({
        role: OrganizationRole.ADMIN,
        updatedAt: new Date("2026-03-26T10:30:00.000Z"),
      })
    );

    await updateOrganizationMembershipRole({
      actor: createSessionUser({
        role: Role.HEAD_OF_GLOBAL_PROCUREMENT,
        activeOrganization: {
          membershipId: "membership-admin",
          organizationId: DEFAULT_ORGANIZATION_ID,
          membershipRole: OrganizationRole.ADMIN,
          membershipStatus: MembershipStatus.ACTIVE,
        },
      }),
      membershipId: "membership-2",
      nextRole: OrganizationRole.ADMIN,
    });

    expect(trackEventMock).toHaveBeenCalledWith({
      event: "admin.member_role_changed",
      organizationId: DEFAULT_ORGANIZATION_ID,
      userId: DEFAULT_USER_ID,
      properties: {
        membershipId: "membership-2",
        targetUserId: "user-2",
        previousRole: OrganizationRole.MEMBER,
        nextRole: OrganizationRole.ADMIN,
      },
    });

    trackEventMock.mockClear();
    tx.organizationMembership.findUnique.mockResolvedValueOnce(
      createMembershipRecord({
        role: OrganizationRole.ADMIN,
      })
    );

    const idempotentResult = await updateOrganizationMembershipRole({
      actor: createSessionUser({
        role: Role.HEAD_OF_GLOBAL_PROCUREMENT,
        activeOrganization: {
          membershipId: "membership-admin",
          organizationId: DEFAULT_ORGANIZATION_ID,
          membershipRole: OrganizationRole.ADMIN,
          membershipStatus: MembershipStatus.ACTIVE,
        },
      }),
      membershipId: "membership-2",
      nextRole: OrganizationRole.ADMIN,
    });

    expect(idempotentResult.changed).toBe(false);
    expect(trackEventMock).not.toHaveBeenCalled();
  });

  it("emits invitation.sent for created and resent workspace invitations", async () => {
    tx.invitation.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 });
    tx.user.findFirst.mockResolvedValueOnce(null);
    tx.invitation.create.mockResolvedValueOnce(createInvitationRecord());

    await createOrganizationInvitation(
      createSessionUser({
        name: "Admin User",
        email: "admin@example.com",
        role: Role.HEAD_OF_GLOBAL_PROCUREMENT,
        activeOrganization: {
          membershipId: "membership-admin",
          organizationId: DEFAULT_ORGANIZATION_ID,
          membershipRole: OrganizationRole.ADMIN,
          membershipStatus: MembershipStatus.ACTIVE,
        },
      }),
      {
        email: "New.User@Example.com",
        role: OrganizationRole.MEMBER,
      }
    );

    expect(trackEventMock).toHaveBeenCalledWith({
      event: "invitation.sent",
      organizationId: DEFAULT_ORGANIZATION_ID,
      userId: DEFAULT_USER_ID,
      properties: {
        invitationId: "invite-1",
        invitationRole: OrganizationRole.MEMBER,
        deliveryChannel: "invite",
        deliveryTransport: "supabase-auth",
        requiresManualDelivery: false,
        sendKind: "created",
      },
    });

    trackEventMock.mockClear();
    tx.invitation.findUnique.mockResolvedValueOnce(createInvitationRecord());
    tx.user.findFirst.mockResolvedValueOnce(null);
    tx.invitation.update.mockResolvedValueOnce(
      createInvitationRecord({
        updatedAt: new Date("2026-03-25T12:00:00.000Z"),
      })
    );

    await resendOrganizationInvitation({
      actor: createSessionUser({
        role: Role.HEAD_OF_GLOBAL_PROCUREMENT,
        activeOrganization: {
          membershipId: "membership-admin",
          organizationId: DEFAULT_ORGANIZATION_ID,
          membershipRole: OrganizationRole.ADMIN,
          membershipStatus: MembershipStatus.ACTIVE,
        },
      }),
      invitationId: "invite-1",
    });

    expect(trackEventMock).toHaveBeenCalledWith({
      event: "invitation.sent",
      organizationId: DEFAULT_ORGANIZATION_ID,
      userId: DEFAULT_USER_ID,
      properties: {
        invitationId: "invite-1",
        invitationRole: OrganizationRole.MEMBER,
        deliveryChannel: "invite",
        deliveryTransport: "supabase-auth",
        requiresManualDelivery: false,
        sendKind: "resent",
      },
    });
  });

  it("emits invitation.accepted only on the first successful acceptance", async () => {
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

    await acceptOrganizationInvitation({
      token: "token-123",
      userId: DEFAULT_USER_ID,
      userEmail: "new.user@example.com",
      activeOrganizationId: null,
      source: "authenticated_user",
    });

    expect(trackEventMock).toHaveBeenCalledWith({
      event: "invitation.accepted",
      organizationId: DEFAULT_ORGANIZATION_ID,
      userId: DEFAULT_USER_ID,
      properties: {
        invitationId: "invite-1",
        invitationRole: OrganizationRole.MEMBER,
        acceptanceSource: "authenticated_user",
      },
    });

    trackEventMock.mockClear();
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

    await acceptOrganizationInvitation({
      token: "token-123",
      userId: DEFAULT_USER_ID,
      userEmail: "new.user@example.com",
      activeOrganizationId: DEFAULT_ORGANIZATION_ID,
      source: "authenticated_user",
    });

    expect(trackEventMock).not.toHaveBeenCalled();
  });

  it("emits onboarding.workspace_created only for newly created workspaces", async () => {
    mockAuthenticatedSession(
      createAuthSessionUser({
        email: "user@example.com",
        app_metadata: {
          userId: DEFAULT_USER_ID,
        },
      })
    );
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(createSessionUserRecord())
      .mockResolvedValueOnce(
        createSessionUserRecord({
          activeOrganizationId: "org-new",
          memberships: [
            {
              id: "membership-org-new",
              organizationId: "org-new",
              role: OrganizationRole.OWNER,
              status: MembershipStatus.ACTIVE,
            },
          ],
        })
      );
    tx.user.findUnique.mockResolvedValueOnce(createInitialWorkspaceUserRecord());
    tx.organization.findMany.mockResolvedValueOnce([]);
    tx.organization.create.mockResolvedValueOnce({
      id: "org-new",
      name: "Atlas Procurement",
      slug: "atlas-procurement",
      createdAt: new Date("2026-03-24T00:00:00.000Z"),
      updatedAt: new Date("2026-03-24T00:00:00.000Z"),
    });
    tx.organizationMembership.upsert.mockResolvedValueOnce({
      id: "membership-org-new",
      organizationId: "org-new",
      role: OrganizationRole.OWNER,
      status: MembershipStatus.ACTIVE,
      createdAt: new Date("2026-03-24T00:00:00.000Z"),
      updatedAt: new Date("2026-03-24T00:00:00.000Z"),
    });
    tx.user.update.mockResolvedValueOnce({
      id: DEFAULT_USER_ID,
      organizationId: "org-new",
      activeOrganizationId: "org-new",
    });

    await createInitialWorkspaceOnboarding("Atlas Procurement");

    expect(trackEventMock).toHaveBeenCalledWith({
      event: "onboarding.workspace_created",
      organizationId: "org-new",
      userId: DEFAULT_USER_ID,
      properties: {
        creationMode: "existing_user",
        membershipRole: OrganizationRole.OWNER,
      },
    });

    trackEventMock.mockClear();
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(
        createSessionUserRecord({
          activeOrganizationId: DEFAULT_ORGANIZATION_ID,
          memberships: [
            {
              id: "membership-existing",
              organizationId: DEFAULT_ORGANIZATION_ID,
              role: OrganizationRole.OWNER,
              status: MembershipStatus.ACTIVE,
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        createSessionUserRecord({
          activeOrganizationId: DEFAULT_ORGANIZATION_ID,
          memberships: [
            {
              id: "membership-existing",
              organizationId: DEFAULT_ORGANIZATION_ID,
              role: OrganizationRole.OWNER,
              status: MembershipStatus.ACTIVE,
            },
          ],
        })
      );
    tx.user.findUnique.mockResolvedValueOnce(
      createInitialWorkspaceUserRecord({
        activeOrganizationId: DEFAULT_ORGANIZATION_ID,
        memberships: [
          {
            id: "membership-existing",
            organizationId: DEFAULT_ORGANIZATION_ID,
            role: OrganizationRole.OWNER,
            status: MembershipStatus.ACTIVE,
            createdAt: new Date("2026-03-24T00:00:00.000Z"),
            updatedAt: new Date("2026-03-24T00:00:00.000Z"),
            organization: {
              id: DEFAULT_ORGANIZATION_ID,
              name: "Atlas Procurement",
              slug: "atlas-procurement",
              createdAt: new Date("2026-03-24T00:00:00.000Z"),
              updatedAt: new Date("2026-03-24T00:00:00.000Z"),
            },
          },
        ],
      })
    );

    await createInitialWorkspaceOnboarding("Atlas Procurement");

    expect(trackEventMock).not.toHaveBeenCalled();
  });
});
