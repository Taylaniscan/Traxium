import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import {
  createAuthGuardErrorResponse,
  requireOrganization,
} from "@/lib/auth";
import {
  InvitationError,
  resendOrganizationInvitation,
} from "@/lib/invitations";
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

const invitationResendParamsSchema = z.object({
  invitationId: z.string().trim().min(1, "Invitation id is required."),
});

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function buildResendSuccessMessage(transport: string) {
  if (transport === "queue-unavailable") {
    return "Invitation updated, but background email delivery is temporarily unavailable. Try resending again shortly.";
  }

  return "Invitation delivery queued. The teammate will receive a fresh email shortly.";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ invitationId: string }> }
) {
  const requestContext = createRouteObservabilityContext(request, {
    event: "admin.invitations.resend.requested",
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
      action: "admin.invitations.resend",
    });

    const { invitationId } = invitationResendParamsSchema.parse(await params);
    const result = await resendOrganizationInvitation({
      actor: user,
      invitationId,
    }, {
      deliveryMode: "async",
    });

    trackServerEvent({
      ...requestContext,
      ...actorContext,
      event: "admin.invitations.resend.succeeded",
      status: 200,
      payload: {
        invitationId,
        transport: result.delivery.transport,
        channel: "channel" in result.delivery ? result.delivery.channel : null,
        requiresManualDelivery:
          "requiresManualDelivery" in result.delivery
            ? result.delivery.requiresManualDelivery ?? false
            : false,
      },
    });

    return NextResponse.json({
      success: true,
      message: buildResendSuccessMessage(result.delivery.transport),
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
      delivery: result.delivery,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      trackServerEvent(
        {
          ...requestContext,
          ...actorContext,
          event: "admin.invitations.resend.validation_failed",
          message:
            error.issues[0]?.message ?? "Invitation resend request is invalid.",
          status: 422,
        },
        "warn"
      );
      return jsonError(
        error.issues[0]?.message ?? "Invitation resend request is invalid.",
        422
      );
    }

    if (error instanceof RateLimitExceededError) {
      trackServerEvent(
        {
          ...requestContext,
          ...actorContext,
          event: "admin.invitations.resend.rate_limited",
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
          event: "admin.invitations.resend.unauthorized",
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
          event: "admin.invitations.resend.rejected",
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
      event: "admin.invitations.resend.failed",
      status: 500,
    });

    return jsonError(
      error instanceof Error ? error.message : "Invitation could not be resent.",
      500
    );
  }
}
