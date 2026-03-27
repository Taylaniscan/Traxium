import {
  JobStatus,
  MembershipStatus,
  OrganizationRole,
  Role,
} from "@prisma/client";
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
  job: {
    groupBy: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  requireOrganization: requireOrganizationMock,
  createAuthGuardErrorResponse: createAuthGuardJsonResponse,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { GET as listJobsRoute } from "@/app/api/admin/jobs/route";
import { POST as retryJobRoute } from "@/app/api/admin/jobs/[jobId]/retry/route";
import { jobTypes } from "@/lib/jobs";

function createJobRecord(
  overrides: Partial<{
    id: string;
    type: string;
    organizationId: string | null;
    status: JobStatus;
    attempts: number;
    maxAttempts: number;
    scheduledAt: Date;
    reservedAt: Date | null;
    processedAt: Date | null;
    error: string | null;
    createdAt: Date;
    updatedAt: Date;
    payload: Record<string, unknown>;
  }> = {}
) {
  return {
    id: "job-1",
    type: jobTypes.INVITATION_EMAIL_DELIVERY,
    idempotencyKey: null,
    organizationId: DEFAULT_ORGANIZATION_ID,
    status: JobStatus.FAILED,
    attempts: 2,
    maxAttempts: 3,
    scheduledAt: new Date("2026-03-27T09:00:00.000Z"),
    reservedAt: null,
    processedAt: new Date("2026-03-27T09:03:00.000Z"),
    error: "SMTP delivery timed out.",
    createdAt: new Date("2026-03-27T09:00:00.000Z"),
    updatedAt: new Date("2026-03-27T09:03:00.000Z"),
    payload: {
      invitationId: "invite-1",
      token: "secret-token",
      email: "supplier@example.com",
      sendKind: "created",
    },
    ...overrides,
  };
}

describe("admin jobs routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-27T12:00:00.000Z"));

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

  it("allows an admin to read active-organization jobs with sanitized payload metadata", async () => {
    mockPrisma.job.groupBy.mockResolvedValueOnce([
      {
        status: JobStatus.QUEUED,
        _count: {
          _all: 2,
        },
      },
      {
        status: JobStatus.FAILED,
        _count: {
          _all: 1,
        },
      },
      {
        status: JobStatus.COMPLETED,
        _count: {
          _all: 4,
        },
      },
    ]);
    mockPrisma.job.findMany.mockResolvedValueOnce([
      createJobRecord(),
      createJobRecord({
        id: "job-2",
        type: jobTypes.ANALYTICS_TRACK,
        status: JobStatus.COMPLETED,
        attempts: 1,
        processedAt: new Date("2026-03-27T08:10:00.000Z"),
        error: null,
        payload: {
          event: "invitation.sent",
          organizationId: DEFAULT_ORGANIZATION_ID,
          token: "should-not-surface",
        },
      }),
    ]);

    const response = await listJobsRoute(
      new Request("http://localhost/api/admin/jobs?take=10", {
        method: "GET",
      })
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.job.groupBy).toHaveBeenCalledWith({
      by: ["status"],
      where: {
        organizationId: DEFAULT_ORGANIZATION_ID,
      },
      orderBy: {
        status: "asc",
      },
      _count: {
        _all: true,
      },
    });
    expect(mockPrisma.job.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: DEFAULT_ORGANIZATION_ID,
      },
      select: expect.any(Object),
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 10,
    });
    await expect(response.json()).resolves.toEqual({
      organizationId: DEFAULT_ORGANIZATION_ID,
      summary: {
        queued: 2,
        running: 0,
        failed: 1,
        completed: 4,
        canceled: 0,
      },
      jobs: [
        {
          id: "job-1",
          type: "auth_email.invitation_delivery",
          status: "FAILED",
          attempts: 2,
          maxAttempts: 3,
          scheduledAt: "2026-03-27T09:00:00.000Z",
          reservedAt: null,
          processedAt: "2026-03-27T09:03:00.000Z",
          error: "SMTP delivery timed out.",
          createdAt: "2026-03-27T09:00:00.000Z",
          updatedAt: "2026-03-27T09:03:00.000Z",
          payloadKeys: ["invitationId", "sendKind"],
          retryable: true,
        },
        {
          id: "job-2",
          type: "analytics.track",
          status: "COMPLETED",
          attempts: 1,
          maxAttempts: 3,
          scheduledAt: "2026-03-27T09:00:00.000Z",
          reservedAt: null,
          processedAt: "2026-03-27T08:10:00.000Z",
          error: null,
          createdAt: "2026-03-27T09:00:00.000Z",
          updatedAt: "2026-03-27T09:03:00.000Z",
          payloadKeys: ["event", "organizationId"],
          retryable: false,
        },
      ],
    });
  });

  it("rejects a normal user from the admin jobs endpoint", async () => {
    requireOrganizationMock.mockResolvedValueOnce(createSessionUser());

    const response = await listJobsRoute(
      new Request("http://localhost/api/admin/jobs", {
        method: "GET",
      })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Forbidden.",
    });
    expect(mockPrisma.job.findMany).not.toHaveBeenCalled();
  });

  it("retries a failed job once and stays idempotent when retried again", async () => {
    mockPrisma.job.findUnique
      .mockResolvedValueOnce(createJobRecord())
      .mockResolvedValueOnce(
        createJobRecord({
          status: JobStatus.QUEUED,
          attempts: 0,
          scheduledAt: new Date("2026-03-27T12:00:00.000Z"),
          processedAt: null,
          error: null,
          updatedAt: new Date("2026-03-27T12:00:00.000Z"),
        })
      )
      .mockResolvedValueOnce(
        createJobRecord({
          status: JobStatus.QUEUED,
          attempts: 0,
          scheduledAt: new Date("2026-03-27T12:00:00.000Z"),
          processedAt: null,
          error: null,
          updatedAt: new Date("2026-03-27T12:00:00.000Z"),
        })
      );
    mockPrisma.job.updateMany.mockResolvedValueOnce({ count: 1 });

    const firstResponse = await retryJobRoute(
      new Request("http://localhost/api/admin/jobs/job-1/retry", {
        method: "POST",
      }),
      {
        params: Promise.resolve({ jobId: "job-1" }),
      }
    );

    expect(firstResponse.status).toBe(200);
    await expect(firstResponse.json()).resolves.toEqual({
      success: true,
      retryQueued: true,
      message: "Job retry queued.",
      job: {
        id: "job-1",
        type: "auth_email.invitation_delivery",
        status: "QUEUED",
        attempts: 0,
        maxAttempts: 3,
        scheduledAt: "2026-03-27T12:00:00.000Z",
        reservedAt: null,
        processedAt: null,
        error: null,
        createdAt: "2026-03-27T09:00:00.000Z",
        updatedAt: "2026-03-27T12:00:00.000Z",
        payloadKeys: ["invitationId", "sendKind"],
        retryable: false,
      },
    });
    expect(mockPrisma.job.updateMany).toHaveBeenCalledWith({
      where: {
        id: "job-1",
        organizationId: DEFAULT_ORGANIZATION_ID,
        status: {
          in: [JobStatus.FAILED, JobStatus.CANCELED],
        },
      },
      data: {
        status: JobStatus.QUEUED,
        attempts: 0,
        scheduledAt: new Date("2026-03-27T12:00:00.000Z"),
        reservedAt: null,
        processedAt: null,
        error: null,
      },
    });

    const secondResponse = await retryJobRoute(
      new Request("http://localhost/api/admin/jobs/job-1/retry", {
        method: "POST",
      }),
      {
        params: Promise.resolve({ jobId: "job-1" }),
      }
    );

    expect(secondResponse.status).toBe(200);
    await expect(secondResponse.json()).resolves.toEqual({
      success: true,
      retryQueued: false,
      message: "Job is already queued.",
      job: {
        id: "job-1",
        type: "auth_email.invitation_delivery",
        status: "QUEUED",
        attempts: 0,
        maxAttempts: 3,
        scheduledAt: "2026-03-27T12:00:00.000Z",
        reservedAt: null,
        processedAt: null,
        error: null,
        createdAt: "2026-03-27T09:00:00.000Z",
        updatedAt: "2026-03-27T12:00:00.000Z",
        payloadKeys: ["invitationId", "sendKind"],
        retryable: false,
      },
    });
    expect(mockPrisma.job.updateMany).toHaveBeenCalledTimes(1);
  });

  it("blocks retry attempts for jobs outside the active organization", async () => {
    mockPrisma.job.findUnique.mockResolvedValueOnce(
      createJobRecord({
        organizationId: OTHER_ORGANIZATION_ID,
      })
    );

    const response = await retryJobRoute(
      new Request("http://localhost/api/admin/jobs/job-1/retry", {
        method: "POST",
      }),
      {
        params: Promise.resolve({ jobId: "job-1" }),
      }
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Job not found in the active organization.",
    });
    expect(mockPrisma.job.updateMany).not.toHaveBeenCalled();
  });

  it("uses auth guard responses when no active organization exists", async () => {
    requireOrganizationMock.mockRejectedValueOnce(
      new MockAuthGuardError(
        "Authenticated session is required.",
        401,
        "UNAUTHENTICATED"
      )
    );

    const response = await listJobsRoute(
      new Request("http://localhost/api/admin/jobs", {
        method: "GET",
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized.",
    });
  });
});
