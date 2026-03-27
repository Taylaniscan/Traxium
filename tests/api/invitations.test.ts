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
const enforceRateLimitMock = vi.hoisted(() => vi.fn());
const createRateLimitErrorResponseMock = vi.hoisted(() => vi.fn());
const RateLimitExceededErrorMock = vi.hoisted(
  () =>
    class RateLimitExceededError extends Error {
      constructor(message: string, readonly status = 429) {
        super(message);
        this.name = "RateLimitExceededError";
      }
    }
);
const enforceUsageQuotaMock = vi.hoisted(() => vi.fn());
const recordUsageEventMock = vi.hoisted(() => vi.fn());
const UsageQuotaExceededErrorMock = vi.hoisted(
  () =>
    class UsageQuotaExceededError extends Error {
      constructor(
        message: string,
        readonly feature = "INVITATIONS_SENT",
        readonly remaining = 0,
        readonly requestedQuantity = 1,
        readonly status = 429
      ) {
        super(message);
        this.name = "UsageQuotaExceededError";
      }
    }
);
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
  job: {
    create: vi.fn(),
    upsert: vi.fn(),
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

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: enforceRateLimitMock,
  createRateLimitErrorResponse: createRateLimitErrorResponseMock,
  RateLimitExceededError: RateLimitExceededErrorMock,
}));

vi.mock("@/lib/usage", () => ({
  enforceUsageQuota: enforceUsageQuotaMock,
  recordUsageEvent: recordUsageEventMock,
  UsageQuotaExceededError: UsageQuotaExceededErrorMock,
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
    enforceRateLimitMock.mockResolvedValue(undefined);
    createRateLimitErrorResponseMock.mockImplementation((error: { message: string; status?: number }) =>
      Response.json(
        { error: error.message, code: "RATE_LIMITED" },
        { status: error.status ?? 429 }
      )
    );
    enforceUsageQuotaMock.mockResolvedValue(undefined);
    recordUsageEventMock.mockResolvedValue(undefined);
    createAuthGuardErrorResponseMock.mockReturnValue(null);
    mockPrisma.$transaction.mockImplementation(async (callback: unknown) => {
      if (typeof callback !== "function") {
        throw new Error("Expected transaction callback.");
      }

      const transactionCallback = callback as (client: typeof tx) => Promise<unknown>;
      return transactionCallback(tx);
    });
    mockPrisma.job.upsert.mockResolvedValue({
      id: "job-invite-delivery-1",
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
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates an invitation and queues email delivery instead of calling Supabase inline", async () => {
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
        transport: "job-queued",
        state: "queued",
        jobId: "job-invite-delivery-1",
      },
    });
    expect(mockPrisma.job.upsert).toHaveBeenCalledWith({
      where: {
        type_idempotencyKey: {
          type: "auth_email.invitation_delivery",
          idempotencyKey:
            "invitation-delivery:invite-1:created:2026-03-24T12:00:00.000Z",
        },
      },
      update: {},
      create: {
        type: "auth_email.invitation_delivery",
        idempotencyKey:
          "invitation-delivery:invite-1:created:2026-03-24T12:00:00.000Z",
        organizationId: DEFAULT_ORGANIZATION_ID,
        payload: {
          invitationId: "invite-1",
        },
        scheduledAt: expect.any(Date),
        maxAttempts: 3,
      },
    });
    expect(inviteUserByEmailMock).not.toHaveBeenCalled();
    expect(signInWithOtpMock).not.toHaveBeenCalled();
    expect(generateLinkMock).not.toHaveBeenCalled();
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
          deliveryChannel: null,
          deliveryTransport: "job-queued",
          requiresManualDelivery: false,
        },
      },
    });
  });

  it("keeps invitation creation successful when job scheduling is unavailable", async () => {
    const createdInvitation = createInvitationRecord();

    tx.invitation.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 });
    tx.user.findFirst.mockResolvedValueOnce(null);
    tx.invitation.create.mockResolvedValueOnce(createdInvitation);
    mockPrisma.job.upsert.mockRejectedValueOnce(new Error("Queue storage is unavailable."));

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
        transport: "queue-unavailable",
        state: "unavailable",
      },
    });
    expect(inviteUserByEmailMock).not.toHaveBeenCalled();
    expect(signInWithOtpMock).not.toHaveBeenCalled();
    expect(generateLinkMock).not.toHaveBeenCalled();
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
          deliveryChannel: null,
          deliveryTransport: "queue-unavailable",
          requiresManualDelivery: false,
        },
      },
    });
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
