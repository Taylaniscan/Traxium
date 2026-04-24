import { captureException, trackServerEvent } from "@/lib/observability";
import {
  markJobCompleted,
  markJobFailed,
  reserveNextJob,
  type ReserveNextJobInput,
} from "@/lib/jobs";

type ReservedJob = Awaited<ReturnType<typeof reserveNextJob>>;
type NonNullableReservedJob = NonNullable<ReservedJob>;

export type JobHandlerContext = {
  job: NonNullableReservedJob;
};

export type JobHandler = (
  context: JobHandlerContext
) => Promise<void> | void;

export type ProcessNextJobResult =
  | {
      ok: true;
      outcome: "completed";
      job: NonNullableReservedJob;
    }
  | {
      ok: true;
      outcome: "idle";
      job: null;
    }
  | {
      ok: false;
      outcome: "failed";
      job: NonNullableReservedJob;
      error: unknown;
    };

export type RunJobLoopInput = ReserveNextJobInput & {
  maxJobs?: number;
  idleDelayMs?: number;
  stopWhenIdle?: boolean;
};

const jobHandlers = new Map<string, JobHandler>();
const IDLE_POLL_LOG_INTERVAL = 10;

function sleep(durationMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unexpected job failure.";
}

function toIsoString(value: Date | null | undefined) {
  if (!(value instanceof Date)) {
    return null;
  }

  return value.toISOString();
}

function logJobRunnerEvent(
  level: "info" | "warn" | "error",
  event: string,
  payload: Record<string, unknown>
) {
  const logger =
    level === "error"
      ? console.error
      : level === "warn"
        ? console.warn
        : console.info;

  logger(
    JSON.stringify({
      event,
      ...payload,
    })
  );
}

function buildJobLogPayload(job: Partial<NonNullableReservedJob>) {
  return {
    jobId: job.id ?? null,
    jobType: job.type ?? null,
    organizationId: job.organizationId ?? null,
    attempts: job.attempts ?? null,
    maxAttempts: "maxAttempts" in job ? job.maxAttempts ?? null : null,
    scheduledAt:
      "scheduledAt" in job ? toIsoString(job.scheduledAt) : null,
    reservedAt: "reservedAt" in job ? toIsoString(job.reservedAt) : null,
    processedAt:
      "processedAt" in job ? toIsoString(job.processedAt) : null,
    status: "status" in job ? job.status ?? null : null,
  };
}

export function registerJobHandler(type: string, handler: JobHandler) {
  const normalizedType = type.trim();

  if (!normalizedType) {
    throw new Error("Job handler type is required.");
  }

  jobHandlers.set(normalizedType, handler);
}

export function registerJobHandlers(handlers: Record<string, JobHandler>) {
  for (const [type, handler] of Object.entries(handlers)) {
    registerJobHandler(type, handler);
  }
}

export function getRegisteredJobTypes() {
  return [...jobHandlers.keys()].sort((left, right) =>
    left.localeCompare(right)
  );
}

export async function processNextJob(
  input: ReserveNextJobInput = {}
): Promise<ProcessNextJobResult> {
  const job = await reserveNextJob(input);

  if (!job) {
    return {
      ok: true,
      outcome: "idle",
      job: null,
    };
  }

  const handler = jobHandlers.get(job.type);

  logJobRunnerEvent("info", "jobs.process.started", buildJobLogPayload(job));

  if (!handler) {
    const error = new Error(`No job handler registered for ${job.type}.`);
    const failedJob = await markJobFailed(job.id, error, {
      disableAutoRetry: true,
    });

    logJobRunnerEvent("error", "jobs.process.unhandled", {
      ...buildJobLogPayload(failedJob ?? job),
      willRetry: failedJob?.status === "QUEUED",
      retryAt:
        failedJob?.status === "QUEUED"
          ? toIsoString(failedJob.scheduledAt)
          : null,
      error: getErrorMessage(error),
    });

    captureException(error, {
      event: "jobs.process.failed",
      organizationId: job.organizationId,
      status: 500,
      payload: {
        jobId: failedJob?.id ?? job.id,
        jobType: job.type,
      },
    });

    return {
      ok: false,
      outcome: "failed",
      job,
      error,
    };
  }

  try {
    await handler({ job });
    const completedJob = await markJobCompleted(job.id);

    logJobRunnerEvent("info", "jobs.process.succeeded", {
      ...buildJobLogPayload(completedJob ?? job),
      attemptsUsed: job.attempts,
    });

    trackServerEvent({
      event: "jobs.process.completed",
      organizationId: job.organizationId,
      status: 200,
      payload: {
        jobId: job.id,
        jobType: job.type,
        attempts: job.attempts,
      },
    });

    return {
      ok: true,
      outcome: "completed",
      job,
    };
  } catch (error) {
    const failedJob = await markJobFailed(job.id, error);

    logJobRunnerEvent(
      failedJob?.status === "QUEUED" ? "warn" : "error",
      "jobs.process.failed",
      {
        ...buildJobLogPayload(failedJob ?? job),
        attemptsUsed: job.attempts,
        willRetry: failedJob?.status === "QUEUED",
        retryAt:
          failedJob?.status === "QUEUED"
            ? toIsoString(failedJob.scheduledAt)
            : null,
        error: getErrorMessage(error),
      }
    );

    captureException(error, {
      event: "jobs.process.failed",
      organizationId: job.organizationId,
      status: 500,
      payload: {
        jobId: job.id,
        jobType: job.type,
        attempts: job.attempts,
      },
    });

    return {
      ok: false,
      outcome: "failed",
      job,
      error,
    };
  }
}

export async function runJobLoop(
  input: RunJobLoopInput = {}
) {
  const maxJobs = Math.max(1, Math.trunc(input.maxJobs ?? 1) || 1);
  const idleDelayMs = Math.max(
    100,
    Math.trunc(input.idleDelayMs ?? 2_000) || 100
  );
  let processedJobs = 0;
  let consecutiveIdlePolls = 0;

  while (processedJobs < maxJobs) {
    const result = await processNextJob(input);

    if (result.outcome === "idle") {
      consecutiveIdlePolls += 1;

      if (input.stopWhenIdle) {
        logJobRunnerEvent("info", "jobs.worker.idle_exit", {
          consecutiveIdlePolls,
          processedJobs,
          maxJobs,
          idleDelayMs,
          organizationId: input.organizationId ?? null,
          types: input.types ?? [],
        });

        return {
          processedJobs,
          idle: true,
        };
      }

      if (
        consecutiveIdlePolls === 1 ||
        consecutiveIdlePolls % IDLE_POLL_LOG_INTERVAL === 0
      ) {
        logJobRunnerEvent("info", "jobs.worker.idle_poll", {
          consecutiveIdlePolls,
          processedJobs,
          maxJobs,
          idleDelayMs,
          organizationId: input.organizationId ?? null,
          types: input.types ?? [],
        });
      }

      await sleep(idleDelayMs);
      continue;
    }

    consecutiveIdlePolls = 0;
    processedJobs += 1;
  }

  logJobRunnerEvent("info", "jobs.worker.max_jobs_reached", {
    processedJobs,
    maxJobs,
    organizationId: input.organizationId ?? null,
    types: input.types ?? [],
  });

  return {
    processedJobs,
    idle: false,
  };
}

export function clearJobHandlersForTests() {
  jobHandlers.clear();
}
