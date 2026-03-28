import { NextResponse } from "next/server";

import {
  createAuthGuardErrorResponse,
  requireOrganization,
} from "@/lib/auth";
import { JobAdminError, retryOrganizationJob } from "@/lib/jobs";
import { canManageOrganizationMembers } from "@/lib/organizations";
import {
  captureException,
  createRouteObservabilityContext,
  trackServerEvent,
} from "@/lib/observability";
import {
  createRateLimitErrorResponse,
  enforceRateLimit,
  RateLimitExceededError,
} from "@/lib/rate-limit";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function buildRetryMessage(status: string, changed: boolean) {
  if (changed) {
    return "Job retry queued.";
  }

  switch (status) {
    case "QUEUED":
      return "Job is already queued.";
    case "RUNNING":
      return "Job is already processing.";
    case "COMPLETED":
      return "Job has already completed.";
    default:
      return "Job is not retryable from its current state.";
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const requestContext = createRouteObservabilityContext(request, {
    event: "admin.jobs.retry.requested",
  });
  let actorContext: { organizationId: string | null; userId: string | null } = {
    organizationId: null,
    userId: null,
  };

  try {
    const user = await requireOrganization({ redirectTo: null });
    actorContext = {
      organizationId: user.activeOrganization.organizationId,
      userId: user.id,
    };

    await enforceRateLimit({
      policy: "adminMutation",
      request,
      userId: user.id,
      organizationId: user.activeOrganization.organizationId,
      action: "admin.jobs.retry",
    });

    if (!canManageOrganizationMembers(user.activeOrganization.membershipRole)) {
      trackServerEvent(
        {
          ...requestContext,
          ...actorContext,
          event: "admin.jobs.retry.forbidden",
          status: 403,
        },
        "warn"
      );
      return jsonError("Forbidden.", 403);
    }

    const { jobId } = await params;
    const result = await retryOrganizationJob({
      jobId,
      organizationId: user.activeOrganization.organizationId,
    });
    const message = buildRetryMessage(result.job.status, result.changed);

    trackServerEvent({
      ...requestContext,
      ...actorContext,
      event: "admin.jobs.retry.succeeded",
      status: 200,
      payload: {
        jobId: result.job.id,
        jobType: result.job.type,
        changed: result.changed,
        nextStatus: result.job.status,
      },
    });

    return NextResponse.json({
      success: true,
      retryQueued: result.changed,
      message,
      job: result.job,
    });
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      trackServerEvent(
        {
          ...requestContext,
          ...actorContext,
          event: "admin.jobs.retry.rate_limited",
          message: error.message,
          status: error.status,
        },
        "warn"
      );
      return createRateLimitErrorResponse(error);
    }

    const authResponse = createAuthGuardErrorResponse(error);

    if (authResponse) {
      trackServerEvent(
        {
          ...requestContext,
          ...actorContext,
          event: "admin.jobs.retry.unauthorized",
          status: authResponse.status,
        },
        "warn"
      );
      return authResponse;
    }

    if (error instanceof JobAdminError) {
      trackServerEvent(
        {
          ...requestContext,
          ...actorContext,
          event: "admin.jobs.retry.rejected",
          message: error.message,
          status: error.status,
        },
        "warn"
      );
      return jsonError(error.message, error.status);
    }

    captureException(error, {
      ...requestContext,
      ...actorContext,
      event: "admin.jobs.retry.failed",
      status: 500,
    });

    return jsonError(
      error instanceof Error ? error.message : "Job retry could not be scheduled.",
      500
    );
  }
}
