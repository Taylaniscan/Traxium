import { NextResponse } from "next/server";

import {
  createAuthGuardErrorResponse,
  requireOrganization,
} from "@/lib/auth";
import { JobAdminError, getOrganizationJobsOverview } from "@/lib/jobs";
import { canManageOrganizationMembers } from "@/lib/organizations";
import {
  captureException,
  createRouteObservabilityContext,
  trackServerEvent,
} from "@/lib/observability";

const DEFAULT_TAKE = 20;

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function resolveTake(request: Request) {
  try {
    const take = Number.parseInt(
      new URL(request.url).searchParams.get("take") ?? "",
      10
    );

    return Number.isFinite(take) && take > 0 ? take : DEFAULT_TAKE;
  } catch {
    return DEFAULT_TAKE;
  }
}

export async function GET(request: Request) {
  const requestContext = createRouteObservabilityContext(request, {
    event: "admin.jobs.read.requested",
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

    if (!canManageOrganizationMembers(user.activeOrganization.membershipRole)) {
      trackServerEvent(
        {
          ...requestContext,
          ...actorContext,
          event: "admin.jobs.read.forbidden",
          status: 403,
        },
        "warn"
      );
      return jsonError("Forbidden.", 403);
    }

    const overview = await getOrganizationJobsOverview(
      user.activeOrganization.organizationId,
      resolveTake(request)
    );

    trackServerEvent({
      ...requestContext,
      ...actorContext,
      event: "admin.jobs.read.succeeded",
      status: 200,
      payload: {
        jobsCount: overview.jobs.length,
        failedJobsCount: overview.summary.failed,
        queuedJobsCount: overview.summary.queued,
      },
    });

    return NextResponse.json({
      organizationId: user.activeOrganization.organizationId,
      summary: overview.summary,
      jobs: overview.jobs,
    });
  } catch (error) {
    const authResponse = createAuthGuardErrorResponse(error);

    if (authResponse) {
      trackServerEvent(
        {
          ...requestContext,
          ...actorContext,
          event: "admin.jobs.read.unauthorized",
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
          event: "admin.jobs.read.rejected",
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
      event: "admin.jobs.read.failed",
      status: 500,
    });

    return jsonError(
      error instanceof Error ? error.message : "Job health could not be loaded.",
      500
    );
  }
}
