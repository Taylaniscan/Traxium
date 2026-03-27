import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import {
  acceptInvitationForCurrentUser,
  createAuthGuardErrorResponse,
} from "@/lib/auth";
import { InvitationError } from "@/lib/invitations";
import {
  captureException,
  createRouteObservabilityContext,
  trackServerEvent,
} from "@/lib/observability";

const invitationTokenParamsSchema = z.object({
  token: z.string().trim().min(1, "Invitation token is required."),
});

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const requestContext = createRouteObservabilityContext(request, {
    event: "invitation.accept.requested",
  });

  try {
    const { token } = invitationTokenParamsSchema.parse(await params);
    const result = await acceptInvitationForCurrentUser(token);

    trackServerEvent({
      ...requestContext,
      event: "invitation.accept.succeeded",
      organizationId: result.invitation.organization.id,
      userId: null,
      status: 200,
      payload: {
        role: result.invitation.role,
        activeOrganizationId: result.activeOrganizationId,
      },
    });

    return NextResponse.json({
      success: true,
      invitation: {
        id: result.invitation.id,
        email: result.invitation.email,
        role: result.invitation.role,
        status: result.invitation.status,
        expiresAt: result.invitation.expiresAt,
        organization: result.invitation.organization,
        invitedBy: result.invitation.invitedBy,
      },
      membership: result.membership,
      activeOrganizationId: result.activeOrganizationId,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      trackServerEvent(
        {
          ...requestContext,
          event: "invitation.accept.validation_failed",
          message: error.issues[0]?.message ?? "Invitation token is invalid.",
          status: 422,
        },
        "warn"
      );
      return jsonError(
        error.issues[0]?.message ?? "Invitation token is invalid.",
        422
      );
    }

    const authResponse = createAuthGuardErrorResponse(error);

    if (authResponse) {
      trackServerEvent(
        {
          ...requestContext,
          event: "invitation.accept.unauthorized",
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
          event: "invitation.accept.rejected",
          message: error.message,
          status: error.status,
        },
        "warn"
      );
      return jsonError(error.message, error.status);
    }

    captureException(error, {
      ...requestContext,
      event: "invitation.accept.failed",
      status: 500,
    });

    return jsonError(
      error instanceof Error ? error.message : "Invitation could not be accepted.",
      500
    );
  }
}
