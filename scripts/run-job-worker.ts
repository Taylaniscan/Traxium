import { JobStatus } from "@prisma/client";

import { prisma } from "../lib/prisma";
import {
  getRegisteredJobTypes,
  registerJobHandlers,
  runJobLoop,
} from "../lib/job-runner";
import {
  processInvitationEmailJob,
  processPasswordRecoveryEmailJob,
} from "../lib/auth-email";
import {
  processAnalyticsIdentifyJob,
  processAnalyticsTrackJob,
} from "../lib/analytics";
import {
  processObservabilityExceptionJob,
  processObservabilityMessageJob,
} from "../lib/observability";
import { getJobWorkerEnvironment } from "../lib/env";
import { jobTypes } from "../lib/jobs";

function logWorkerEvent(
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

function buildWorkerScopeMetadata(input: {
  stopWhenIdle: boolean;
  maxJobs: number;
  idleDelayMs: number;
  organizationId?: string;
  types?: string[];
  registeredJobTypes: string[];
  mode: "continuous" | "one_shot" | "health_check";
}) {
  return {
    pid: process.pid,
    nodeEnv: process.env.NODE_ENV ?? null,
    requiresSeparateWorkerProcess: true,
    mode: input.mode,
    stopWhenIdle: input.stopWhenIdle,
    maxJobs: input.maxJobs,
    idleDelayMs: input.idleDelayMs,
    organizationId: input.organizationId ?? null,
    types: input.types ?? [],
    registeredJobTypes: input.registeredJobTypes,
  };
}

async function runWorkerHealthCheck(input: {
  organizationId?: string;
  types?: string[];
  stopWhenIdle: boolean;
  maxJobs: number;
  idleDelayMs: number;
  registeredJobTypes: string[];
}) {
  if (!input.registeredJobTypes.length) {
    throw new Error(
      "No job handlers are registered. The worker cannot process queued jobs."
    );
  }

  const now = new Date();
  const visibleDueJobs = await prisma.job.count({
    where: {
      status: JobStatus.QUEUED,
      scheduledAt: {
        lte: now,
      },
      ...(input.types?.length
        ? {
            type: {
              in: input.types,
            },
          }
        : {}),
      ...(input.organizationId === undefined
        ? {}
        : {
            organizationId: input.organizationId,
          }),
    },
  });

  logWorkerEvent("info", "jobs.worker.healthcheck.passed", {
    ...buildWorkerScopeMetadata({
      ...input,
      mode: "health_check",
    }),
    visibleDueJobs,
    checkedAt: now.toISOString(),
  });
}

async function main() {
  process.env.JOB_WORKER = "true";
  registerJobHandlers({
    [jobTypes.INVITATION_EMAIL_DELIVERY]: processInvitationEmailJob,
    [jobTypes.PASSWORD_RECOVERY_EMAIL_DELIVERY]:
      processPasswordRecoveryEmailJob,
    [jobTypes.ANALYTICS_TRACK]: processAnalyticsTrackJob,
    [jobTypes.ANALYTICS_IDENTIFY]: processAnalyticsIdentifyJob,
    [jobTypes.OBSERVABILITY_MESSAGE]: processObservabilityMessageJob,
    [jobTypes.OBSERVABILITY_EXCEPTION]: processObservabilityExceptionJob,
  });

  const { stopWhenIdle, maxJobs, idleDelayMs, organizationId, types } =
    getJobWorkerEnvironment();
  const registeredJobTypes = getRegisteredJobTypes();
  const healthCheckOnly = process.argv.includes("--health-check");
  const startedAt = Date.now();
  const workerMetadata = buildWorkerScopeMetadata({
    stopWhenIdle,
    maxJobs,
    idleDelayMs,
    organizationId,
    types,
    registeredJobTypes,
    mode: healthCheckOnly
      ? "health_check"
      : stopWhenIdle
        ? "one_shot"
        : "continuous",
  });

  if (!registeredJobTypes.length) {
    logWorkerEvent("warn", "jobs.worker.no_handlers_registered", workerMetadata);
  }

  logWorkerEvent(
    "info",
    healthCheckOnly ? "jobs.worker.healthcheck.started" : "jobs.worker.started",
    workerMetadata
  );

  if (healthCheckOnly) {
    await runWorkerHealthCheck({
      stopWhenIdle,
      maxJobs,
      idleDelayMs,
      organizationId,
      types,
      registeredJobTypes,
    });
    return;
  }

  const result = await runJobLoop({
    maxJobs,
    idleDelayMs,
    stopWhenIdle,
    organizationId,
    types,
  });

  logWorkerEvent("info", "jobs.worker.finished", {
    ...workerMetadata,
    processedJobs: result.processedJobs,
    idle: result.idle,
    durationMs: Date.now() - startedAt,
  });
}

main()
  .catch((error) => {
    logWorkerEvent("error", "jobs.worker.crashed", {
      pid: process.pid,
      errorName: error instanceof Error ? error.name : "Error",
      error:
        error instanceof Error
          ? error.message
          : "Unexpected worker error.",
      stack: error instanceof Error ? error.stack ?? null : null,
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
