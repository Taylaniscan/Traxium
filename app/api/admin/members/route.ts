import { NextResponse } from "next/server";

import {
  createAuthGuardErrorResponse,
  requireOrganization,
} from "@/lib/auth";
import {
  canManageOrganizationMembers,
  getOrganizationMembersDirectory,
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
    event: "admin.members.list.requested",
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
          event: "admin.members.list.forbidden",
          status: 403,
        },
        "warn"
      );
      return jsonError("Forbidden.", 403);
    }

    const directory = await getOrganizationMembersDirectory(
      user.activeOrganization.organizationId
    );

    trackServerEvent({
      ...requestContext,
      ...actorContext,
      event: "admin.members.list.succeeded",
      status: 200,
      payload: {
        membersCount: directory.members.length,
        pendingInvitesCount: directory.pendingInvites.length,
      },
    });

    return NextResponse.json({
      organizationId: user.activeOrganization.organizationId,
      members: directory.members,
      pendingInvites: directory.pendingInvites,
    });
  } catch (error) {
    const authResponse = createAuthGuardErrorResponse(error);

    if (authResponse) {
      trackServerEvent(
        {
          ...requestContext,
          ...actorContext,
          event: "admin.members.list.unauthorized",
          status: authResponse.status,
        },
        "warn"
      );
      return authResponse;
    }

    captureException(error, {
      ...requestContext,
      ...actorContext,
      event: "admin.members.list.failed",
      status: 500,
    });

    return jsonError(
      error instanceof Error ? error.message : "Members could not be loaded.",
      500
    );
  }
}
