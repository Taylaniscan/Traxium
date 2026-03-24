import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import {
  createInitialWorkspaceOnboarding,
  isAuthGuardError,
} from "@/lib/auth";
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
  try {
    const body = await readJsonBody(request);

    if (!body.ok) {
      return body.response;
    }

    const payload = workspaceOnboardingSchema.parse(body.data);
    const result = await createInitialWorkspaceOnboarding(payload.name);

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
      return jsonError(
        error.issues[0]?.message ?? "Workspace onboarding payload is invalid.",
        422,
        "VALIDATION_ERROR"
      );
    }

    if (isAuthGuardError(error)) {
      return jsonError(error.message, error.status, error.code);
    }

    if (error instanceof WorkspaceOnboardingError) {
      return jsonError(error.message, error.status, "WORKSPACE_ONBOARDING_ERROR");
    }

    return jsonError(
      error instanceof Error ? error.message : "Workspace onboarding failed.",
      500,
      "WORKSPACE_ONBOARDING_FAILED"
    );
  }
}
