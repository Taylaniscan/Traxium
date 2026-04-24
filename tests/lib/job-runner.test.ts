import { beforeEach, describe, expect, it, vi } from "vitest";

const reserveNextJobMock = vi.hoisted(() => vi.fn());
const markJobCompletedMock = vi.hoisted(() => vi.fn());
const markJobFailedMock = vi.hoisted(() => vi.fn());
const trackServerEventMock = vi.hoisted(() => vi.fn());
const captureExceptionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/jobs", () => ({
  reserveNextJob: reserveNextJobMock,
  markJobCompleted: markJobCompletedMock,
  markJobFailed: markJobFailedMock,
}));

vi.mock("@/lib/observability", () => ({
  trackServerEvent: trackServerEventMock,
  captureException: captureExceptionMock,
}));

import {
  clearJobHandlersForTests,
  processNextJob,
  registerJobHandler,
  runJobLoop,
} from "@/lib/job-runner";

function createReservedJob(
  overrides: Partial<{
    id: string;
    type: string;
    organizationId: string | null;
    attempts: number;
    maxAttempts: number;
    scheduledAt: Date;
    reservedAt: Date | null;
    processedAt: Date | null;
    payload: Record<string, unknown>;
  }> = {}
) {
  return {
    id: "job-1",
    type: "analytics.track",
    organizationId: "org-1",
    attempts: 1,
    maxAttempts: 3,
    scheduledAt: new Date("2026-03-27T09:00:00.000Z"),
    reservedAt: new Date("2026-03-27T09:01:00.000Z"),
    processedAt: null,
    payload: {
      event: "invitation.sent",
    },
    ...overrides,
  };
}

describe("lib/job-runner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearJobHandlersForTests();
  });

  it("processes a reserved job with its registered handler and marks it completed", async () => {
    const reservedJob = createReservedJob();
    const handler = vi.fn().mockResolvedValue(undefined);
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    reserveNextJobMock.mockResolvedValueOnce(reservedJob);
    markJobCompletedMock.mockResolvedValueOnce({
      ...reservedJob,
      status: "COMPLETED",
      processedAt: new Date("2026-03-27T09:02:00.000Z"),
    });
    registerJobHandler(reservedJob.type, handler);

    const result = await processNextJob();

    expect(handler).toHaveBeenCalledWith({
      job: reservedJob,
    });
    expect(markJobCompletedMock).toHaveBeenCalledWith("job-1");
    expect(trackServerEventMock).toHaveBeenCalledWith({
      event: "jobs.process.completed",
      organizationId: "org-1",
      status: 200,
      payload: {
        jobId: "job-1",
        jobType: "analytics.track",
        attempts: 1,
      },
    });
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('"event":"jobs.process.started"')
    );
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('"event":"jobs.process.succeeded"')
    );
    expect(result).toEqual({
      ok: true,
      outcome: "completed",
      job: reservedJob,
    });
  });

  it("marks a job failed when no handler is registered", async () => {
    const reservedJob = createReservedJob({
      type: "unknown.job",
    });
    reserveNextJobMock.mockResolvedValueOnce(reservedJob);
    markJobFailedMock.mockResolvedValueOnce({
      ...reservedJob,
      status: "FAILED",
    });

    const result = await processNextJob();

    expect(markJobFailedMock).toHaveBeenCalledWith(
      "job-1",
      expect.any(Error),
      {
        disableAutoRetry: true,
      }
    );
    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.any(Error),
      {
        event: "jobs.process.failed",
        organizationId: "org-1",
        status: 500,
        payload: {
          jobId: "job-1",
          jobType: "unknown.job",
        },
      }
    );
    expect(result.ok).toBe(false);
    expect(result.outcome).toBe("failed");
  });

  it("marks a job failed when its handler throws", async () => {
    const reservedJob = createReservedJob();
    const handlerError = new Error("SMTP provider timed out.");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    reserveNextJobMock.mockResolvedValueOnce(reservedJob);
    markJobFailedMock.mockResolvedValueOnce({
      ...reservedJob,
      status: "QUEUED",
      scheduledAt: new Date("2026-03-27T09:06:00.000Z"),
      error: "SMTP provider timed out.",
    });
    registerJobHandler(
      reservedJob.type,
      vi.fn().mockRejectedValueOnce(handlerError)
    );

    const result = await processNextJob();

    expect(markJobFailedMock).toHaveBeenCalledWith("job-1", handlerError);
    expect(captureExceptionMock).toHaveBeenCalledWith(
      handlerError,
      {
        event: "jobs.process.failed",
        organizationId: "org-1",
        status: 500,
        payload: {
          jobId: "job-1",
          jobType: "analytics.track",
          attempts: 1,
        },
      }
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('"event":"jobs.process.failed"')
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('"willRetry":true')
    );
    expect(result).toEqual({
      ok: false,
      outcome: "failed",
      job: reservedJob,
      error: handlerError,
    });
  });

  it("stops the worker loop when the queue is idle and stopWhenIdle is enabled", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    reserveNextJobMock.mockResolvedValueOnce(null);

    const result = await runJobLoop({
      maxJobs: 3,
      stopWhenIdle: true,
    });

    expect(result).toEqual({
      processedJobs: 0,
      idle: true,
    });
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('"event":"jobs.worker.idle_exit"')
    );
  });

  it("logs idle polling and resumes processing when a later reservation succeeds", async () => {
    vi.useFakeTimers();
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const reservedJob = createReservedJob();
    reserveNextJobMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(reservedJob);
    markJobCompletedMock.mockResolvedValueOnce({
      ...reservedJob,
      status: "COMPLETED",
      processedAt: new Date("2026-03-27T09:03:00.000Z"),
    });
    registerJobHandler(reservedJob.type, vi.fn().mockResolvedValue(undefined));

    const loopPromise = runJobLoop({
      maxJobs: 1,
      idleDelayMs: 100,
    });

    await vi.advanceTimersByTimeAsync(100);
    const result = await loopPromise;

    expect(result).toEqual({
      processedJobs: 1,
      idle: false,
    });
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('"event":"jobs.worker.idle_poll"')
    );
  });
});
