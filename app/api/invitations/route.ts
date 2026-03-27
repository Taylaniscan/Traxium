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

const invitationRoleSchema = z.enum(["OWNER", "ADMIN", "MEMBER"]);

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
    const result = await createOrganizationInvitation(user, payload);
    const { invitation, delivery } = result;

    trackServerEvent({
      ...requestContext,
      ...actorContext,
      event: "invitation.create.succeeded",
      status: 201,
      payload: {
        role: invitation.role,
        transport: delivery.transport,
        channel: delivery.channel,
        requiresManualDelivery: delivery.requiresManualDelivery ?? false,
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
