import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import {
  createInitialWorkspaceOnboarding,
  isAuthGuardError,
} from "@/lib/auth";
import {
  captureException,
  createRouteObservabilityContext,
  trackServerEvent,
} from "@/lib/observability";
import { WorkspaceOnboardingError } from "@/lib/organizations";

const workspaceOnboardingSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Workspace name is required.")
    .max(80, "Workspace name must be 80 characters or fewer.")
    .refine(
      (value) => /[\p{L}\p{N}]/u.test(value),
      "Workspace name must contain letters or numbers."
    ),
  description: z
    .string()
    .trim()
    .max(240, "Workspace description must be 240 characters or fewer.")
    .nullable()
    .optional(),
});

function jsonError(error: string, status: number, code?: string) {
  return NextResponse.json(
    code
      ? {
          error,
          code,
        }
      : {
          error,
        },
    { status }
  );
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
    event: "onboarding.workspace.requested",
  });

  try {
    const body = await readJsonBody(request);

    if (!body.ok) {
      trackServerEvent(
        {
          ...requestContext,
          event: "onboarding.workspace.invalid_json",
          status: 400,
        },
        "warn"
      );
      return body.response;
    }

    const payload = workspaceOnboardingSchema.parse(body.data);
    const result = await createInitialWorkspaceOnboarding(
      payload.name,
      payload.description ?? null
    );

    trackServerEvent({
      ...requestContext,
      event: "onboarding.workspace.succeeded",
      organizationId: result.organization.id,
      userId: result.user.id,
      status: 201,
      payload: {
        membershipRole: result.membership.role,
        activeOrganizationId: result.activeOrganizationId,
      },
    });

    return NextResponse.json(
      {
        success: true,
        organization: result.organization,
        membership: result.membership,
        activeOrganizationId: result.activeOrganizationId,
        user: result.user,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      trackServerEvent(
        {
          ...requestContext,
          event: "onboarding.workspace.validation_failed",
          message:
            error.issues[0]?.message ?? "Workspace onboarding payload is invalid.",
          status: 422,
        },
        "warn"
      );
      return jsonError(
        error.issues[0]?.message ?? "Workspace onboarding payload is invalid.",
        422,
        "VALIDATION_ERROR"
      );
    }

    if (isAuthGuardError(error)) {
      trackServerEvent(
        {
          ...requestContext,
          event: "onboarding.workspace.unauthorized",
          message: error.message,
          status: error.status,
          payload: {
            code: error.code,
          },
        },
        "warn"
      );
      return jsonError(error.message, error.status, error.code);
    }

    if (error instanceof WorkspaceOnboardingError) {
      trackServerEvent(
        {
          ...requestContext,
          event: "onboarding.workspace.rejected",
          message: error.message,
          status: error.status,
        },
        "warn"
      );
      return jsonError(error.message, error.status, "WORKSPACE_ONBOARDING_ERROR");
    }

    captureException(error, {
      ...requestContext,
      event: "onboarding.workspace.failed",
      status: 500,
    });

    return jsonError(
      error instanceof Error ? error.message : "Workspace onboarding failed.",
      500,
      "WORKSPACE_ONBOARDING_FAILED"
    );
  }
}
