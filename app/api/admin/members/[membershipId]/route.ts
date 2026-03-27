import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import {
  createAuthGuardErrorResponse,
  requireOrganization,
} from "@/lib/auth";
import {
  OrganizationMembershipRemovalError,
  removeOrganizationMembership,
} from "@/lib/organizations";
import {
  captureException,
  createRouteObservabilityContext,
  trackServerEvent,
} from "@/lib/observability";

const memberLifecycleParamsSchema = z.object({
  membershipId: z.string().trim().min(1, "Membership id is required."),
});

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ membershipId: string }> }
) {
  const requestContext = createRouteObservabilityContext(request, {
    event: "admin.members.remove.requested",
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
    const { membershipId } = memberLifecycleParamsSchema.parse(await params);
    const result = await removeOrganizationMembership({
      actor: user,
      membershipId,
    });

    trackServerEvent({
      ...requestContext,
      ...actorContext,
      event: "admin.members.remove.succeeded",
      status: 200,
      payload: {
        membershipId,
        removedUserId: result.membership.userId,
      },
    });

    return NextResponse.json({
      success: true,
      message: `${result.membership.name} was removed from the workspace.`,
      membership: result.membership,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      trackServerEvent(
        {
          ...requestContext,
          ...actorContext,
          event: "admin.members.remove.validation_failed",
          message:
            error.issues[0]?.message ?? "Member removal request is invalid.",
          status: 422,
        },
        "warn"
      );
      return jsonError(
        error.issues[0]?.message ?? "Member removal request is invalid.",
        422
      );
    }

    const authResponse = createAuthGuardErrorResponse(error);

    if (authResponse) {
      trackServerEvent(
        {
          ...requestContext,
          ...actorContext,
          event: "admin.members.remove.unauthorized",
          status: authResponse.status,
        },
        "warn"
      );
      return authResponse;
    }

    if (error instanceof OrganizationMembershipRemovalError) {
      trackServerEvent(
        {
          ...requestContext,
          ...actorContext,
          event: "admin.members.remove.rejected",
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
      event: "admin.members.remove.failed",
      status: 500,
    });

    return jsonError(
      error instanceof Error ? error.message : "Member could not be removed.",
      500
    );
  }
}
