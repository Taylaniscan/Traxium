import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JobStatus, type Job } from "@prisma/client";

import { DEFAULT_ORGANIZATION_ID } from "../helpers/security-fixtures";

const mockPrisma = vi.hoisted(() => ({
  job: {
    create: vi.fn(),
    upsert: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import {
  enqueueJob,
  markJobCompleted,
  markJobFailed,
  reserveNextJob,
  retryJob,
} from "@/lib/jobs";

function createJobRecord(
  overrides: Partial<Job> = {}
): Job {
  return {
    id: "job-1",
    type: "analytics.flush",
    idempotencyKey: null,
    organizationId: DEFAULT_ORGANIZATION_ID,
    payload: {
      batchId: "batch-1",
    },
    status: JobStatus.QUEUED,
    attempts: 0,
    maxAttempts: 3,
    scheduledAt: new Date("2026-03-27T09:00:00.000Z"),
    reservedAt: null,
    processedAt: null,
    error: null,
    createdAt: new Date("2026-03-27T09:00:00.000Z"),
    updatedAt: new Date("2026-03-27T09:00:00.000Z"),
    ...overrides,
  };
}

describe("lib/jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("enqueues a persistent job with tenant scope and idempotency protection", async () => {
    const storedJob = createJobRecord({
      idempotencyKey: "analytics-batch-1",
    });
    mockPrisma.job.upsert.mockResolvedValueOnce(storedJob);

    const result = await enqueueJob({
      type: "analytics.flush",
      organizationId: DEFAULT_ORGANIZATION_ID,
      idempotencyKey: "analytics-batch-1",
      payload: {
        batchId: "batch-1",
        token: "secret-token",
      },
    });

    expect(mockPrisma.job.upsert).toHaveBeenCalledWith({
      where: {
        type_idempotencyKey: {
          type: "analytics.flush",
          idempotencyKey: "analytics-batch-1",
        },
      },
      update: {},
      create: {
        type: "analytics.flush",
        idempotencyKey: "analytics-batch-1",
        organizationId: DEFAULT_ORGANIZATION_ID,
        payload: {
          batchId: "batch-1",
          token: "[REDACTED]",
        },
        scheduledAt: expect.any(Date),
        maxAttempts: 3,
      },
    });
    expect(result).toEqual(storedJob);
  });

  it("reserves only due jobs for the requested tenant and marks them running", async () => {
    const now = new Date("2026-03-27T10:00:00.000Z");
    const candidate = createJobRecord();
    const reservedJob = createJobRecord({
      status: JobStatus.RUNNING,
      attempts: 1,
      reservedAt: now,
      updatedAt: now,
    });
    mockPrisma.job.findFirst.mockResolvedValueOnce(candidate);
    mockPrisma.job.updateMany.mockResolvedValueOnce({ count: 1 });
    mockPrisma.job.findUnique.mockResolvedValueOnce(reservedJob);

    const result = await reserveNextJob({
      now,
      organizationId: DEFAULT_ORGANIZATION_ID,
    });

    expect(mockPrisma.job.findFirst).toHaveBeenCalledWith({
      where: {
        status: JobStatus.QUEUED,
        scheduledAt: {
          lte: now,
        },
        organizationId: DEFAULT_ORGANIZATION_ID,
      },
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
    });
    expect(mockPrisma.job.updateMany).toHaveBeenCalledWith({
      where: {
        id: "job-1",
        status: JobStatus.QUEUED,
        attempts: 0,
      },
      data: {
        status: JobStatus.RUNNING,
        attempts: {
          increment: 1,
        },
        reservedAt: expect.any(Date),
        processedAt: null,
        error: null,
      },
    });
    expect(result).toEqual(reservedJob);
  });

  it("requeues failed running jobs when retry budget remains", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-03-27T10:00:00.000Z");
    vi.setSystemTime(now);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const runningJob = createJobRecord({
      status: JobStatus.RUNNING,
      attempts: 1,
      reservedAt: new Date("2026-03-27T09:59:00.000Z"),
    });
    const retriedJob = createJobRecord({
      status: JobStatus.QUEUED,
      attempts: 1,
      scheduledAt: new Date("2026-03-27T10:05:00.000Z"),
      processedAt: now,
      reservedAt: null,
      error: "Remote API timed out.",
    });
    mockPrisma.job.findUnique
      .mockResolvedValueOnce(runningJob)
      .mockResolvedValueOnce(retriedJob);
    mockPrisma.job.updateMany.mockResolvedValueOnce({ count: 1 });

    const result = await markJobFailed(
      "job-1",
      new Error("Remote API timed out."),
      {
        retryDelayMs: 5 * 60_000,
      }
    );

    expect(mockPrisma.job.updateMany).toHaveBeenCalledWith({
      where: {
        id: "job-1",
        status: JobStatus.RUNNING,
      },
      data: {
        status: JobStatus.QUEUED,
        scheduledAt: new Date("2026-03-27T10:05:00.000Z"),
        processedAt: now,
        reservedAt: null,
        error: "Remote API timed out.",
      },
    });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('"event":"jobs.retry.scheduled"')
    );
    expect(result).toEqual(retriedJob);
  });

  it("marks a running job as completed and clears reservation state", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-03-27T10:30:00.000Z");
    vi.setSystemTime(now);
    const completedJob = createJobRecord({
      status: JobStatus.COMPLETED,
      attempts: 1,
      processedAt: now,
      reservedAt: null,
      error: null,
    });
    mockPrisma.job.updateMany.mockResolvedValueOnce({ count: 1 });
    mockPrisma.job.findUnique.mockResolvedValueOnce(completedJob);

    const result = await markJobCompleted("job-1");

    expect(mockPrisma.job.updateMany).toHaveBeenCalledWith({
      where: {
        id: "job-1",
        status: JobStatus.RUNNING,
      },
      data: {
        status: JobStatus.COMPLETED,
        processedAt: now,
        reservedAt: null,
        error: null,
      },
    });
    expect(result).toEqual(completedJob);
  });

  it("supports manual retry by resetting attempts and clearing error state", async () => {
    const scheduledAt = new Date("2026-03-27T11:00:00.000Z");
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const retriedJob = createJobRecord({
      status: JobStatus.QUEUED,
      attempts: 0,
      scheduledAt,
      processedAt: null,
      error: null,
    });
    mockPrisma.job.updateMany.mockResolvedValueOnce({ count: 1 });
    mockPrisma.job.findUnique.mockResolvedValueOnce(retriedJob);

    const result = await retryJob("job-1", scheduledAt);

    expect(mockPrisma.job.updateMany).toHaveBeenCalledWith({
      where: {
        id: "job-1",
        status: {
          in: [JobStatus.FAILED, JobStatus.CANCELED],
        },
      },
      data: {
        status: JobStatus.QUEUED,
        attempts: 0,
        scheduledAt,
        reservedAt: null,
        processedAt: null,
        error: null,
      },
    });
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('"event":"jobs.retry.manually_queued"')
    );
    expect(result).toEqual(retriedJob);
  });

  it("reduces duplicate execution risk by retrying reservation when a competing worker wins the first lock", async () => {
    const firstCandidate = createJobRecord({
      id: "job-1",
    });
    const secondCandidate = createJobRecord({
      id: "job-2",
      type: "invitation.email.send",
      payload: {
        invitationId: "invite-2",
      },
    });
    const reservedSecondJob = createJobRecord({
      id: "job-2",
      type: "invitation.email.send",
      payload: {
        invitationId: "invite-2",
      },
      status: JobStatus.RUNNING,
      attempts: 1,
      reservedAt: new Date("2026-03-27T10:00:00.000Z"),
    });
    mockPrisma.job.findFirst
      .mockResolvedValueOnce(firstCandidate)
      .mockResolvedValueOnce(secondCandidate);
    mockPrisma.job.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    mockPrisma.job.findUnique.mockResolvedValueOnce(reservedSecondJob);

    const result = await reserveNextJob({
      maxScanAttempts: 2,
    });

    expect(mockPrisma.job.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: "job-1",
        status: JobStatus.QUEUED,
        attempts: 0,
      },
      data: {
        status: JobStatus.RUNNING,
        attempts: {
          increment: 1,
        },
        reservedAt: expect.any(Date),
        processedAt: null,
        error: null,
      },
    });
    expect(result).toEqual(reservedSecondJob);
  });
});
