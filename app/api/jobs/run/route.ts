import { NextResponse } from "next/server";

import { getJobRunnerSecret } from "@/lib/env";
import { registerDefaultJobHandlers } from "@/lib/job-handlers";
import { runJobLoop } from "@/lib/job-runner";
import { enqueueDueMonthlyCloseReminders } from "@/lib/monthly-close-reminder";
import { recordJobRunnerHeartbeat } from "@/lib/jobs";
import {
  captureException,
  createRouteObservabilityContext,
  trackServerEvent,
} from "@/lib/observability";

export const dynamic = "force-dynamic";
// Bounded budget kept comfortably under the serverless function timeout.
export const maxDuration = 60;

const MAX_JOBS_PER_PASS = 25;
const MAX_DURATION_MS = 50_000;
const IDLE_DELAY_MS = 250;

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

/**
 * Accept the shared secret either as `Authorization: Bearer <secret>` (so Vercel
 * cron's CRON_SECRET header authenticates) or as an explicit `x-job-runner-secret`
 * header (for dedicated/manual invocations).
 */
function extractProvidedSecret(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (authorization && authorization.toLowerCase().startsWith("bearer ")) {
    const token = authorization.slice(7).trim();
    if (token) {
      return token;
    }
  }

  const headerSecret = request.headers.get("x-job-runner-secret")?.trim();
  return headerSecret || null;
}

async function handleRun(request: Request) {
  const requestContext = createRouteObservabilityContext(request, {
    event: "jobs.run.requested",
  });

  let expectedSecret = "";
  try {
    expectedSecret = getJobRunnerSecret();
  } catch (error) {
    // Production requires the secret; a missing value disables the endpoint.
    captureException(error, {
      ...requestContext,
      event: "jobs.run.misconfigured",
      status: 503,
    });
    return jsonError("Job runner is not configured.", 503);
  }

  if (!expectedSecret) {
    trackServerEvent(
      { ...requestContext, event: "jobs.run.disabled", status: 503 },
      "warn"
    );
    return jsonError("Job runner is not configured.", 503);
  }

  const providedSecret = extractProvidedSecret(request);
  if (!providedSecret || providedSecret !== expectedSecret) {
    trackServerEvent(
      { ...requestContext, event: "jobs.run.unauthorized", status: 401 },
      "warn"
    );
    return jsonError("Unauthorized.", 401);
  }

  registerDefaultJobHandlers();

  // Scheduled fan-out: enqueue monthly-close reminders on the 1st of the month
  // (idempotent + day-gated, so every other pass is a no-op). A failure here must
  // not block the job loop, so it is captured and swallowed.
  try {
    await enqueueDueMonthlyCloseReminders();
  } catch (error) {
    captureException(error, {
      ...requestContext,
      event: "jobs.run.monthly_close_enqueue_failed",
    });
  }

  const startedAt = Date.now();
  try {
    const result = await runJobLoop({
      maxJobs: MAX_JOBS_PER_PASS,
      maxDurationMs: MAX_DURATION_MS,
      idleDelayMs: IDLE_DELAY_MS,
      stopWhenIdle: true,
    });
    const durationMs = Date.now() - startedAt;

    await recordJobRunnerHeartbeat({
      processedJobs: result.processedJobs,
      durationMs,
    });

    trackServerEvent({
      ...requestContext,
      event: "jobs.run.completed",
      status: 200,
      payload: {
        processedJobs: result.processedJobs,
        idle: result.idle,
        durationMs,
      },
    });

    return NextResponse.json({
      ok: true,
      processedJobs: result.processedJobs,
      idle: result.idle,
      durationMs,
      maxJobs: MAX_JOBS_PER_PASS,
      maxDurationMs: MAX_DURATION_MS,
    });
  } catch (error) {
    captureException(error, {
      ...requestContext,
      event: "jobs.run.failed",
      status: 500,
    });
    return jsonError(
      error instanceof Error ? error.message : "Job runner pass failed.",
      500
    );
  }
}

// Vercel cron invokes the path with GET; POST is supported for manual/dedicated use.
export async function GET(request: Request) {
  return handleRun(request);
}

export async function POST(request: Request) {
  return handleRun(request);
}
