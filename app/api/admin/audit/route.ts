import { NextResponse } from "next/server";

import { AuditEventError } from "@/lib/audit";
import {
  createAuthGuardErrorResponse,
  requireOrganization,
} from "@/lib/auth";
import {
  canManageOrganizationMembers,
  getOrganizationAdminAuditEvents,
} from "@/lib/organizations";
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
    event: "admin.audit.read.requested",
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
          event: "admin.audit.read.forbidden",
          status: 403,
        },
        "warn"
      );
      return jsonError("Forbidden.", 403);
    }

    const events = await getOrganizationAdminAuditEvents(
      user.activeOrganization.organizationId
    );

    trackServerEvent({
      ...requestContext,
      ...actorContext,
      event: "admin.audit.read.succeeded",
      status: 200,
      payload: {
        eventsCount: events.length,
      },
    });

    return NextResponse.json({
      organizationId: user.activeOrganization.organizationId,
      events,
    });
  } catch (error) {
    const authResponse = createAuthGuardErrorResponse(error);

    if (authResponse) {
      trackServerEvent(
        {
          ...requestContext,
          ...actorContext,
          event: "admin.audit.read.unauthorized",
          status: authResponse.status,
        },
        "warn"
      );
      return authResponse;
    }

    if (error instanceof AuditEventError) {
      trackServerEvent(
        {
          ...requestContext,
          ...actorContext,
          event: "admin.audit.read.rejected",
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
      event: "admin.audit.read.failed",
      status: 500,
    });

    return jsonError(
      error instanceof Error ? error.message : "Admin activity could not be loaded.",
      500
    );
  }
}
