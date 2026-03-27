import { NextResponse } from "next/server";

import { AuditEventError } from "@/lib/audit";
import { AdminInsightsError, getOrganizationAdminInsights } from "@/lib/admin-insights";
import {
  createAuthGuardErrorResponse,
  requireOrganization,
} from "@/lib/auth";
import { canManageOrganizationMembers } from "@/lib/organizations";
import {
  captureException,
  createRouteObservabilityContext,
  trackServerEvent,
} from "@/lib/observability";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function GET(request: Request) {
  const requestContext = createRouteObservabilityContext(request, {
    event: "admin.insights.read.requested",
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
          event: "admin.insights.read.forbidden",
          status: 403,
        },
        "warn"
      );
      return jsonError("Forbidden.", 403);
    }

    const insights = await getOrganizationAdminInsights(
      user.activeOrganization.organizationId
    );

    trackServerEvent({
      ...requestContext,
      ...actorContext,
      event: "admin.insights.read.succeeded",
      status: 200,
      payload: {
        totalMembers: insights.metrics.totalMembers,
        pendingInvites: insights.metrics.pendingInvites,
        recentErrorEventsLast7Days:
          insights.metrics.recentErrorEventsLast7Days,
      },
    });

    return NextResponse.json({
      organizationId: user.activeOrganization.organizationId,
      insights,
    });
  } catch (error) {
    const authResponse = createAuthGuardErrorResponse(error);

    if (authResponse) {
      trackServerEvent(
        {
          ...requestContext,
          ...actorContext,
          event: "admin.insights.read.unauthorized",
          status: authResponse.status,
        },
        "warn"
      );
      return authResponse;
    }

    if (error instanceof AuditEventError || error instanceof AdminInsightsError) {
      trackServerEvent(
        {
          ...requestContext,
          ...actorContext,
          event: "admin.insights.read.rejected",
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
      event: "admin.insights.read.failed",
      status: 500,
    });

    return jsonError(
      error instanceof Error ? error.message : "Admin insights could not be loaded.",
      500
    );
  }
}
