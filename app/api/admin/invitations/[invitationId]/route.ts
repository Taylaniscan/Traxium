import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import {
  createAuthGuardErrorResponse,
  requireOrganization,
} from "@/lib/auth";
import {
  InvitationError,
  revokeOrganizationInvitation,
} from "@/lib/invitations";
import {
  captureException,
  createRouteObservabilityContext,
  trackServerEvent,
} from "@/lib/observability";

const invitationLifecycleParamsSchema = z.object({
  invitationId: z.string().trim().min(1, "Invitation id is required."),
});

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ invitationId: string }> }
) {
  const requestContext = createRouteObservabilityContext(request, {
    event: "admin.invitations.revoke.requested",
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
    const { invitationId } = invitationLifecycleParamsSchema.parse(await params);
    const result = await revokeOrganizationInvitation({
      actor: user,
      invitationId,
    });

    trackServerEvent({
      ...requestContext,
      ...actorContext,
      event: "admin.invitations.revoke.succeeded",
      status: 200,
      payload: {
        invitationId,
        changed: result.changed,
      },
    });

    return NextResponse.json({
      success: true,
      message: result.changed
        ? "Invitation cancelled."
        : "Invitation was already cancelled.",
      invitation: {
        id: result.invitation.id,
        organizationId: result.invitation.organizationId,
        email: result.invitation.email,
        role: result.invitation.role,
        status: result.invitation.status,
        expiresAt: result.invitation.expiresAt,
        createdAt: result.invitation.createdAt,
        updatedAt: result.invitation.updatedAt,
        invitedBy: result.invitation.invitedBy,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      trackServerEvent(
        {
          ...requestContext,
          ...actorContext,
          event: "admin.invitations.revoke.validation_failed",
          message:
            error.issues[0]?.message ?? "Invitation revoke request is invalid.",
          status: 422,
        },
        "warn"
      );
      return jsonError(
        error.issues[0]?.message ?? "Invitation revoke request is invalid.",
        422
      );
    }

    const authResponse = createAuthGuardErrorResponse(error);

    if (authResponse) {
      trackServerEvent(
        {
          ...requestContext,
          ...actorContext,
          event: "admin.invitations.revoke.unauthorized",
          status: authResponse.status,
        },
        "warn"
      );
      return authResponse;
    }

    if (error instanceof InvitationError) {
      trackServerEvent(
        {
          ...requestContext,
          ...actorContext,
          event: "admin.invitations.revoke.rejected",
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
      event: "admin.invitations.revoke.failed",
      status: 500,
    });

    return jsonError(
      error instanceof Error ? error.message : "Invitation could not be cancelled.",
      500
    );
  }
}
