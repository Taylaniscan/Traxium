import { UsageFeature, UsageWindow } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import {
  createAuthGuardErrorResponse,
  requireOrganization,
} from "@/lib/auth";
import {
  createOrganizationInvitation,
  InvitationError,
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
import {
  enforceUsageQuota,
  recordUsageEvent,
  UsageQuotaExceededError,
} from "@/lib/usage";

const invitationRoleSchema = z.enum(["OWNER", "ADMIN", "MEMBER"]);
const INVITATION_QUOTA_WINDOW = UsageWindow.MONTH;

const invitationCreateSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Invitation email is required.")
    .email("Invitation email must be valid."),
  role: invitationRoleSchema,
});

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

async function readJsonBody(request: Request) {
  try {
    return { ok: true as const, data: await request.json() };
  } catch {
    return {
      ok: false as const,
      response: jsonError("Request body must be valid JSON.", 400),
    };
  }
}

export async function POST(request: Request) {
  const requestContext = createRouteObservabilityContext(request, {
    event: "invitation.create.requested",
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
      policy: "invitationCreate",
      request,
      userId: user.id,
      organizationId: user.activeOrganization.organizationId,
      action: "invitations.create",
    });

    const body = await readJsonBody(request);

    if (!body.ok) {
      trackServerEvent(
        {
          ...requestContext,
          ...actorContext,
          event: "invitation.create.invalid_json",
          status: 400,
        },
        "warn"
      );
      return body.response;
    }

    const payload = invitationCreateSchema.parse(body.data);
    const organizationId = user.activeOrganization.organizationId;

    await enforceUsageQuota({
      organizationId,
      feature: UsageFeature.INVITATIONS_SENT,
      window: INVITATION_QUOTA_WINDOW,
      requestedQuantity: 1,
      message: "Invitation quota exceeded for the current period.",
    });

    const result = await createOrganizationInvitation(user, payload, {
      deliveryMode: "async",
    });
    const { invitation, delivery } = result;

    await recordUsageEvent({
      organizationId,
      feature: UsageFeature.INVITATIONS_SENT,
      quantity: 1,
      window: INVITATION_QUOTA_WINDOW,
      source: "api.invitations.create",
      reason: "member_invitation",
      metadata: {
        invitationId: invitation.id,
        invitedByUserId: user.id,
        role: invitation.role,
      },
    });

    trackServerEvent({
      ...requestContext,
      ...actorContext,
      event: "invitation.create.succeeded",
      status: 201,
      payload: {
        role: invitation.role,
        transport: delivery.transport,
        channel: "channel" in delivery ? delivery.channel : null,
        requiresManualDelivery:
          "requiresManualDelivery" in delivery
            ? delivery.requiresManualDelivery ?? false
            : false,
      },
    });

    return NextResponse.json(
      {
        invitation: {
          id: invitation.id,
          organizationId: invitation.organizationId,
          email: invitation.email,
          role: invitation.role,
          token: invitation.token,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
          invitedByUserId: invitation.invitedByUserId,
          createdAt: invitation.createdAt,
          updatedAt: invitation.updatedAt,
          organization: invitation.organization,
          invitedBy: invitation.invitedBy,
        },
        delivery,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      trackServerEvent(
        {
          ...requestContext,
          ...actorContext,
          event: "invitation.create.validation_failed",
          message:
            error.issues[0]?.message ?? "Invitation payload is invalid.",
          status: 422,
        },
        "warn"
      );
      return jsonError(
        error.issues[0]?.message ?? "Invitation payload is invalid.",
        422
      );
    }

    if (error instanceof UsageQuotaExceededError) {
      trackServerEvent(
        {
          ...requestContext,
          ...actorContext,
          event: "invitation.create.quota_exceeded",
          message: error.message,
          status: error.status,
        },
        "warn"
      );
      return jsonError(error.message, error.status);
    }

    if (error instanceof RateLimitExceededError) {
      trackServerEvent(
        {
          ...requestContext,
          ...actorContext,
          event: "invitation.create.rate_limited",
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
          event: "invitation.create.unauthorized",
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
          event: "invitation.create.rejected",
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
      event: "invitation.create.failed",
      status: 500,
    });

    return jsonError(
      error instanceof Error ? error.message : "Invitation could not be created.",
      500
    );
  }
}
