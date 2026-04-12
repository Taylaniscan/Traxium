import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import {
  completeInvitationAccountSetup,
  InvitationAccountError,
} from "@/lib/invited-account";
import { InvitationError } from "@/lib/invitations";
import {
  captureException,
  createRouteObservabilityContext,
  trackServerEvent,
} from "@/lib/observability";
import { getPasswordConfirmationError } from "@/lib/passwords";

const invitationCompletionSchema = z.object({
  name: z.string().trim().min(1, "Full name is required."),
  password: z.string().min(1, "Password is required."),
  confirmPassword: z.string().min(1, "Password confirmation is required."),
});

const invitationTokenParamsSchema = z.object({
  token: z.string().trim().min(1, "Invitation token is required."),
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const requestContext = createRouteObservabilityContext(request, {
    event: "invitation.complete.requested",
  });

  try {
    const { token } = invitationTokenParamsSchema.parse(await params);
    const body = await readJsonBody(request);

    if (!body.ok) {
      trackServerEvent(
        {
          ...requestContext,
          event: "invitation.complete.invalid_json",
          status: 400,
        },
        "warn"
      );
      return body.response;
    }

    const payload = invitationCompletionSchema.parse(body.data);
    const confirmPasswordError = getPasswordConfirmationError(
      payload.password,
      payload.confirmPassword
    );

    if (confirmPasswordError) {
      trackServerEvent(
        {
          ...requestContext,
          event: "invitation.complete.validation_failed",
          message: confirmPasswordError,
          status: 422,
        },
        "warn"
      );
      return jsonError(confirmPasswordError, 422);
    }

    const result = await completeInvitationAccountSetup({
      token,
      name: payload.name,
      password: payload.password,
    });

    trackServerEvent({
      ...requestContext,
      event: "invitation.complete.succeeded",
      organizationId: result.invitation.organization.id,
      userId: result.userId,
      status: 200,
      payload: {
        role: result.invitation.role,
        activeOrganizationId: result.activeOrganizationId,
      },
    });

    return NextResponse.json({
      success: true,
      email: result.email,
      userId: result.userId,
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
          event: "invitation.complete.validation_failed",
          message:
            error.issues[0]?.message ??
            "Invitation account setup payload is invalid.",
          status: 422,
        },
        "warn"
      );
      return jsonError(
        error.issues[0]?.message ?? "Invitation account setup payload is invalid.",
        422
      );
    }

    if (error instanceof InvitationAccountError) {
      trackServerEvent(
        {
          ...requestContext,
          event: "invitation.complete.rejected",
          message: error.message,
          status: error.status,
        },
        "warn"
      );
      return jsonError(error.message, error.status);
    }

    if (error instanceof InvitationError) {
      trackServerEvent(
        {
          ...requestContext,
          event: "invitation.complete.rejected",
          message: error.message,
          status: error.status,
        },
        "warn"
      );
      return jsonError(error.message, error.status);
    }

    captureException(error, {
      ...requestContext,
      event: "invitation.complete.failed",
      status: 500,
    });

    return jsonError(
      error instanceof Error
        ? error.message
        : "Invitation account setup could not be completed.",
      500
    );
  }
}
