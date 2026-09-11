import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import {
  createAuthGuardErrorResponse,
  requireUser,
} from "@/lib/auth";
import {
  getPasswordConfirmationError,
  getPasswordValidationError,
} from "@/lib/passwords";
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
  createSupabasePublicClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required."),
  newPassword: z.string().min(1, "New password is required."),
  confirmNewPassword: z.string().min(1, "Password confirmation is required."),
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
    event: "auth.change_password.requested",
  });
  let actorContext: { organizationId: string | null; userId: string | null } = {
    organizationId: null,
    userId: null,
  };

  try {
    const user = await requireUser({ redirectTo: null, billingRedirectTo: null });
    actorContext = {
      organizationId: user.activeOrganization.organizationId,
      userId: user.id,
    };

    await enforceRateLimit({
      policy: "resetPassword",
      request,
      action: "auth.change-password",
    });

    const body = await readJsonBody(request);

    if (!body.ok) {
      trackServerEvent(
        {
          ...requestContext,
          ...actorContext,
          event: "auth.change_password.rejected",
          message: "Request body must be valid JSON.",
          status: 400,
          payload: {
            reason: "invalid_json",
          },
        },
        "warn"
      );
      return body.response;
    }

    const payload = changePasswordSchema.parse(body.data);
    const passwordError = getPasswordValidationError(payload.newPassword);

    if (passwordError) {
      trackServerEvent(
        {
          ...requestContext,
          ...actorContext,
          event: "auth.change_password.rejected",
          message: passwordError,
          status: 422,
          payload: {
            reason: "weak_password",
          },
        },
        "warn"
      );
      return jsonError(passwordError, 422);
    }

    const confirmPasswordError = getPasswordConfirmationError(
      payload.newPassword,
      payload.confirmNewPassword
    );

    if (confirmPasswordError) {
      trackServerEvent(
        {
          ...requestContext,
          ...actorContext,
          event: "auth.change_password.rejected",
          message: confirmPasswordError,
          status: 422,
          payload: {
            reason: "password_mismatch",
          },
        },
        "warn"
      );
      return jsonError(confirmPasswordError, 422);
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user: authUser },
      error: getUserError,
    } = await supabase.auth.getUser();

    if (getUserError || !authUser?.email) {
      trackServerEvent(
        {
          ...requestContext,
          ...actorContext,
          event: "auth.change_password.unauthorized",
          message: "Authenticated password-change session is unavailable.",
          status: 401,
          payload: {
            reason: "missing_auth_session",
          },
        },
        "warn"
      );
      return jsonError("Your session has expired. Please sign in again.", 401);
    }

    const supabasePublic = createSupabasePublicClient();
    const { data: signInData, error: signInError } =
      await supabasePublic.auth.signInWithPassword({
        email: authUser.email,
        password: payload.currentPassword,
      });

    if (signInError || !signInData.session || !signInData.user) {
      trackServerEvent(
        {
          ...requestContext,
          ...actorContext,
          event: "auth.change_password.rejected",
          message: "Current password is incorrect.",
          status: 422,
          payload: {
            reason: "invalid_current_password",
          },
        },
        "warn"
      );
      return jsonError("Current password is incorrect.", 422);
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: payload.newPassword,
    });

    if (updateError) {
      trackServerEvent(
        {
          ...requestContext,
          ...actorContext,
          event: "auth.change_password.rejected",
          message: updateError.message,
          status: 422,
          payload: {
            reason: "provider_rejected_update",
          },
        },
        "warn"
      );
      return jsonError(updateError.message, 422);
    }

    trackServerEvent({
      ...requestContext,
      ...actorContext,
      event: "auth.change_password.succeeded",
      status: 200,
    });

    return NextResponse.json({
      success: true,
      email: authUser.email,
    });
  } catch (error) {
    const authResponse = createAuthGuardErrorResponse(error);

    if (authResponse) {
      trackServerEvent(
        {
          ...requestContext,
          ...actorContext,
          event: "auth.change_password.unauthorized",
          status: authResponse.status,
        },
        "warn"
      );
      return authResponse;
    }

    if (error instanceof ZodError) {
      const message =
        error.issues[0]?.message ?? "Change password payload is invalid.";

      trackServerEvent(
        {
          ...requestContext,
          ...actorContext,
          event: "auth.change_password.rejected",
          message,
          status: 422,
          payload: {
            reason: "invalid_payload",
          },
        },
        "warn"
      );
      return jsonError(message, 422);
    }

    if (error instanceof RateLimitExceededError) {
      return createRateLimitErrorResponse(error);
    }

    captureException(error, {
      ...requestContext,
      ...actorContext,
      event: "auth.change_password.failed",
      status: 500,
    });

    return jsonError(
      error instanceof Error ? error.message : "Password could not be updated.",
      500
    );
  }
}
