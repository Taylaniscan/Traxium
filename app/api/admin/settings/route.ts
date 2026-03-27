import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import {
  createAuthGuardErrorResponse,
  requireOrganization,
} from "@/lib/auth";
import {
  canManageOrganizationMembers,
  getOrganizationSettings,
  OrganizationSettingsError,
  updateOrganizationSettings,
} from "@/lib/organizations";
import {
  captureException,
  createRouteObservabilityContext,
  trackServerEvent,
} from "@/lib/observability";

const organizationSettingsSchema = z.object({
  name: z.string().trim().min(1, "Workspace name is required."),
  description: z.string().trim().max(240, "Workspace description must be 240 characters or fewer.").optional().or(z.literal("")),
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

export async function GET(request: Request) {
  const requestContext = createRouteObservabilityContext(request, {
    event: "admin.settings.read.requested",
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
          event: "admin.settings.read.forbidden",
          status: 403,
        },
        "warn"
      );
      return jsonError("Forbidden.", 403);
    }

    const organization = await getOrganizationSettings(
      user.activeOrganization.organizationId
    );

    trackServerEvent({
      ...requestContext,
      ...actorContext,
      event: "admin.settings.read.succeeded",
      status: 200,
      payload: {
        slug: organization.slug,
      },
    });

    return NextResponse.json({
      organization,
    });
  } catch (error) {
    const authResponse = createAuthGuardErrorResponse(error);

    if (authResponse) {
      trackServerEvent(
        {
          ...requestContext,
          ...actorContext,
          event: "admin.settings.read.unauthorized",
          status: authResponse.status,
        },
        "warn"
      );
      return authResponse;
    }

    if (error instanceof OrganizationSettingsError) {
      trackServerEvent(
        {
          ...requestContext,
          ...actorContext,
          event: "admin.settings.read.rejected",
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
      event: "admin.settings.read.failed",
      status: 500,
    });

    return jsonError(
      error instanceof Error ? error.message : "Workspace settings could not be loaded.",
      500
    );
  }
}

export async function PATCH(request: Request) {
  const requestContext = createRouteObservabilityContext(request, {
    event: "admin.settings.update.requested",
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
          event: "admin.settings.update.forbidden",
          status: 403,
        },
        "warn"
      );
      return jsonError("Forbidden.", 403);
    }

    const body = await readJsonBody(request);

    if (!body.ok) {
      trackServerEvent(
        {
          ...requestContext,
          ...actorContext,
          event: "admin.settings.update.invalid_json",
          status: 400,
        },
        "warn"
      );
      return body.response;
    }

    const payload = organizationSettingsSchema.parse(body.data);
    const result = await updateOrganizationSettings({
      actor: user,
      name: payload.name,
      description: payload.description ?? null,
    });

    trackServerEvent({
      ...requestContext,
      ...actorContext,
      event: "admin.settings.update.succeeded",
      status: 200,
      payload: {
        changed: result.changed,
        slug: result.organization.slug,
      },
    });

    return NextResponse.json({
      success: true,
      message: result.changed
        ? "Workspace settings saved."
        : "Workspace settings were already up to date.",
      organization: result.organization,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      trackServerEvent(
        {
          ...requestContext,
          ...actorContext,
          event: "admin.settings.update.validation_failed",
          message:
            error.issues[0]?.message ?? "Workspace settings payload is invalid.",
          status: 422,
        },
        "warn"
      );
      return jsonError(
        error.issues[0]?.message ?? "Workspace settings payload is invalid.",
        422
      );
    }

    const authResponse = createAuthGuardErrorResponse(error);

    if (authResponse) {
      trackServerEvent(
        {
          ...requestContext,
          ...actorContext,
          event: "admin.settings.update.unauthorized",
          status: authResponse.status,
        },
        "warn"
      );
      return authResponse;
    }

    if (error instanceof OrganizationSettingsError) {
      trackServerEvent(
        {
          ...requestContext,
          ...actorContext,
          event: "admin.settings.update.rejected",
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
      event: "admin.settings.update.failed",
      status: 500,
    });

    return jsonError(
      error instanceof Error ? error.message : "Workspace settings could not be updated.",
      500
    );
  }
}
