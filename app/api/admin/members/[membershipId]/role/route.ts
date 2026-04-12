import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import {
  createAuthGuardErrorResponse,
  requireOrganization,
} from "@/lib/auth";
import {
  OrganizationMembershipRoleUpdateError,
  updateOrganizationMembershipRole,
} from "@/lib/organizations";
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

const roleUpdateBodySchema = z.object({
  role: z.enum(["OWNER", "ADMIN", "MEMBER"]),
});

const roleUpdateParamsSchema = z.object({
  membershipId: z.string().trim().min(1, "Membership id is required."),
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

function formatRoleLabel(role: "OWNER" | "ADMIN" | "MEMBER") {
  return role.charAt(0) + role.slice(1).toLowerCase();
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ membershipId: string }> }
) {
  const requestContext = createRouteObservabilityContext(request, {
    event: "admin.members.role_update.requested",
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
      action: "admin.members.role_update",
    });

    const { membershipId } = roleUpdateParamsSchema.parse(await params);
    const body = await readJsonBody(request);

    if (!body.ok) {
      trackServerEvent(
        {
          ...requestContext,
          ...actorContext,
          event: "admin.members.role_update.invalid_json",
          status: 400,
        },
        "warn"
      );
      return body.response;
    }

    const payload = roleUpdateBodySchema.parse(body.data);
    const result = await updateOrganizationMembershipRole({
      actor: user,
      membershipId,
      nextRole: payload.role,
    });

    trackServerEvent({
      ...requestContext,
      ...actorContext,
      event: "admin.members.role_update.succeeded",
      status: 200,
      payload: {
        membershipId,
        nextRole: payload.role,
        changed: result.changed,
      },
    });

    return NextResponse.json({
      success: true,
      message: result.changed
        ? `Role updated to ${formatRoleLabel(payload.role)}.`
        : `Role is already set to ${formatRoleLabel(payload.role)}.`,
      membership: result.membership,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      trackServerEvent(
        {
          ...requestContext,
          ...actorContext,
          event: "admin.members.role_update.validation_failed",
          message: error.issues[0]?.message ?? "Role update payload is invalid.",
          status: 422,
        },
        "warn"
      );
      return jsonError(
        error.issues[0]?.message ?? "Role update payload is invalid.",
        422
      );
    }

    if (error instanceof RateLimitExceededError) {
      trackServerEvent(
        {
          ...requestContext,
          ...actorContext,
          event: "admin.members.role_update.rate_limited",
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
          event: "admin.members.role_update.unauthorized",
          status: authResponse.status,
        },
        "warn"
      );
      return authResponse;
    }

    if (error instanceof OrganizationMembershipRoleUpdateError) {
      trackServerEvent(
        {
          ...requestContext,
          ...actorContext,
          event: "admin.members.role_update.rejected",
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
      event: "admin.members.role_update.failed",
      status: 500,
    });

    return jsonError(
      error instanceof Error ? error.message : "Member role could not be updated.",
      500
    );
  }
}
