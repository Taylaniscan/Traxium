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

function sleep(durationMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
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

  if (!handler) {
    const error = new Error(`No job handler registered for ${job.type}.`);
    const failedJob = await markJobFailed(job.id, error, {
      disableAutoRetry: true,
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
    await markJobCompleted(job.id);

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
    await markJobFailed(job.id, error);
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
  const idleDelayMs = Math.max(100, Math.trunc(input.idleDelayMs ?? 2_000) || 100);
  let processedJobs = 0;

  while (processedJobs < maxJobs) {
    const result = await processNextJob(input);

    if (result.outcome === "idle") {
      if (input.stopWhenIdle) {
        return {
          processedJobs,
          idle: true,
        };
      }

      await sleep(idleDelayMs);
      continue;
    }

    processedJobs += 1;
  }

  return {
    processedJobs,
    idle: false,
  };
}

export function clearJobHandlersForTests() {
  jobHandlers.clear();
}
