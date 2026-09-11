import {
  processInvitationEmailJob,
  processPasswordRecoveryEmailJob,
} from "@/lib/auth-email";
import {
  processAnalyticsIdentifyJob,
  processAnalyticsTrackJob,
} from "@/lib/analytics";
import {
  processObservabilityExceptionJob,
  processObservabilityMessageJob,
} from "@/lib/observability";
import { registerJobHandlers } from "@/lib/job-runner";
import { jobTypes } from "@/lib/jobs";
import { processMonthlyCloseReminderJob } from "@/lib/monthly-close-reminder";

/**
 * Registers the canonical set of job handlers. Shared by the standalone worker
 * (scripts/run-job-worker.ts) and the serverless cron endpoint (app/api/jobs/run)
 * so both execution modes process the exact same job types without forking logic.
 */
export function registerDefaultJobHandlers() {
  registerJobHandlers({
    [jobTypes.INVITATION_EMAIL_DELIVERY]: processInvitationEmailJob,
    [jobTypes.PASSWORD_RECOVERY_EMAIL_DELIVERY]: processPasswordRecoveryEmailJob,
    [jobTypes.ANALYTICS_TRACK]: processAnalyticsTrackJob,
    [jobTypes.ANALYTICS_IDENTIFY]: processAnalyticsIdentifyJob,
    [jobTypes.OBSERVABILITY_MESSAGE]: processObservabilityMessageJob,
    [jobTypes.OBSERVABILITY_EXCEPTION]: processObservabilityExceptionJob,
    [jobTypes.MONTHLY_CLOSE_REMINDER]: processMonthlyCloseReminderJob,
  });
}
