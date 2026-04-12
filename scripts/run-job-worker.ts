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

  if (!registeredJobTypes.length) {
    console.warn(
      "No job handlers are registered. The worker will only process jobs after handlers are registered by the runtime."
    );
  }

  console.info(
    JSON.stringify({
      event: "jobs.worker.started",
      stopWhenIdle,
      maxJobs,
      idleDelayMs,
      organizationId: organizationId ?? null,
      types: types ?? [],
      registeredJobTypes,
    })
  );

  const result = await runJobLoop({
    maxJobs,
    idleDelayMs,
    stopWhenIdle,
    organizationId,
    types,
  });

  console.info(
    JSON.stringify({
      event: "jobs.worker.finished",
      processedJobs: result.processedJobs,
      idle: result.idle,
      organizationId: organizationId ?? null,
      types: types ?? [],
      registeredJobTypes,
    })
  );
}

main()
  .catch((error) => {
    console.error(
      JSON.stringify({
        event: "jobs.worker.crashed",
        error: error instanceof Error ? error.message : "Unexpected worker error.",
      })
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
