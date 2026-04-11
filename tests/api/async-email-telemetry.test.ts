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
const enqueueJobMock = vi.hoisted(() => vi.fn());
const resetPasswordForEmailMock = vi.hoisted(() => vi.fn());
const inviteUserByEmailMock = vi.hoisted(() => vi.fn());
const signInWithOtpMock = vi.hoisted(() => vi.fn());
const sentryState = vi.hoisted(() => ({
  addBreadcrumb: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  withScope: vi.fn((callback: (scope: {
    setTag: ReturnType<typeof vi.fn>;
    setUser: ReturnType<typeof vi.fn>;
    setContext: ReturnType<typeof vi.fn>;
    setFingerprint: ReturnType<typeof vi.fn>;
    setLevel: ReturnType<typeof vi.fn>;
  }) => void) =>
    callback({
      setTag: vi.fn(),
      setUser: vi.fn(),
      setContext: vi.fn(),
      setFingerprint: vi.fn(),
      setLevel: vi.fn(),
    })),
}));

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  auditLog: {
    create: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  requireOrganization: requireOrganizationMock,
  createAuthGuardErrorResponse: createAuthGuardErrorResponseMock,
}));

vi.mock("@/lib/jobs", () => ({
  enqueueJob: enqueueJobMock,
  jobTypes: {
    INVITATION_EMAIL_DELIVERY: "auth_email.invitation_delivery",
    PASSWORD_RECOVERY_EMAIL_DELIVERY: "auth_email.password_recovery_delivery",
    ANALYTICS_TRACK: "analytics.track",
    ANALYTICS_IDENTIFY: "analytics.identify",
    OBSERVABILITY_MESSAGE: "observability.message",
    OBSERVABILITY_EXCEPTION: "observability.exception",
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
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

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: () => ({
    auth: {
      admin: {
        inviteUserByEmail: inviteUserByEmailMock,
        generateLink: vi.fn(),
      },
    },
  }),
  createSupabasePublicClient: () => ({
    auth: {
      signInWithOtp: signInWithOtpMock,
      resetPasswordForEmail: resetPasswordForEmailMock,
    },
  }),
}));

vi.mock("@sentry/nextjs", () => ({
  addBreadcrumb: sentryState.addBreadcrumb,
  captureException: sentryState.captureException,
  captureMessage: sentryState.captureMessage,
  withScope: sentryState.withScope,
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    fmt: vi.fn(),
  },
  captureRequestError: vi.fn(),
  captureRouterTransitionStart: vi.fn(),
}));

import { POST as createInvitationRoute } from "@/app/api/invitations/route";
import { POST as resendInvitationRoute } from "@/app/api/admin/invitations/[invitationId]/resend/route";
import { POST as forgotPasswordRoute } from "@/app/api/auth/forgot-password/route";
import { trackEvent } from "@/lib/analytics";
import { captureException } from "@/lib/observability";

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

function createInvitationTransactionMock() {
  return {
    invitation: {
      updateMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    },
  };
}

describe("async email and telemetry flows", () => {
  let tx: ReturnType<typeof createInvitationTransactionMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-26T12:00:00.000Z"));
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    process.env.SENTRY_DSN = "https://public@example.ingest.sentry.io/1";
    delete process.env.JOB_WORKER;
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
    enqueueJobMock.mockResolvedValue({
      id: "job-1",
    });
    mockPrisma.$transaction.mockImplementation(async (callback: unknown) => {
      if (typeof callback !== "function") {
        throw new Error("Expected transaction callback.");
      }

      const transactionCallback = callback as (client: typeof tx) => Promise<unknown>;
      return transactionCallback(tx);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("queues an invitation delivery job when an invite is created", async () => {
    tx.invitation.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 });
    tx.user.findFirst.mockResolvedValueOnce(null);
    tx.invitation.create.mockResolvedValueOnce(createInvitationRecord());

    const response = await createInvitationRoute(
      new Request("http://localhost/api/invitations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: "new.member@example.com",
          role: "MEMBER",
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(enqueueJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "auth_email.invitation_delivery",
        organizationId: DEFAULT_ORGANIZATION_ID,
        payload: {
          invitationId: "invite-1",
        },
      })
    );
    expect(inviteUserByEmailMock).not.toHaveBeenCalled();
    expect(signInWithOtpMock).not.toHaveBeenCalled();
  });

  it("queues an invitation delivery job when a pending invite is resent", async () => {
    tx.invitation.findUnique.mockResolvedValueOnce(createInvitationRecord());
    tx.user.findFirst.mockResolvedValueOnce(null);
    tx.invitation.update.mockResolvedValueOnce(
      createInvitationRecord({
        updatedAt: new Date("2026-03-26T12:45:00.000Z"),
        expiresAt: new Date("2026-04-05T12:00:00.000Z"),
      })
    );

    const response = await resendInvitationRoute(new Request("http://localhost"), {
      params: Promise.resolve({ invitationId: "invite-1" }),
    });

    expect(response.status).toBe(200);
    expect(enqueueJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "auth_email.invitation_delivery",
        organizationId: DEFAULT_ORGANIZATION_ID,
        payload: {
          invitationId: "invite-1",
        },
      })
    );
    expect(inviteUserByEmailMock).not.toHaveBeenCalled();
    expect(signInWithOtpMock).not.toHaveBeenCalled();
  });

  it("returns forgot-password success without waiting for hosted email delivery", async () => {
    const response = await forgotPasswordRoute(
      new Request("http://localhost/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: "user@example.com",
        }),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      delivery: {
        transport: "job-queued",
        state: "queued",
        jobId: "job-1",
      },
    });
    expect(enqueueJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "auth_email.password_recovery_delivery",
        payload: {
          email: "user@example.com",
          redirectTo: "http://localhost:3000/reset-password",
        },
      })
    );
    expect(resetPasswordForEmailMock).not.toHaveBeenCalled();
  });

  it("queues server-side telemetry jobs instead of sending them inline", async () => {
    await trackEvent({
      event: "workspace.sample_data_loaded",
      runtime: "server",
      organizationId: DEFAULT_ORGANIZATION_ID,
      userId: DEFAULT_USER_ID,
      properties: {
        createdCardsCount: 2,
      },
    });

    captureException(new Error("Remote analytics host failed."), {
      event: "api.telemetry.failed",
      organizationId: DEFAULT_ORGANIZATION_ID,
      userId: DEFAULT_USER_ID,
      status: 500,
    });

    expect(enqueueJobMock).toHaveBeenCalledTimes(1);
    expect(enqueueJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "analytics.track",
        organizationId: DEFAULT_ORGANIZATION_ID,
        idempotencyKey: null,
        payload: expect.objectContaining({
          event: "workspace.sample_data_loaded",
          type: "track",
          runtime: "server",
          organizationId: DEFAULT_ORGANIZATION_ID,
          userId: DEFAULT_USER_ID,
          properties: expect.objectContaining({
            createdCardsCount: 2,
          }),
          occurredAt: expect.any(String),
        }),
      })
    );
    expect(sentryState.captureException).not.toHaveBeenCalled();
  });
});
