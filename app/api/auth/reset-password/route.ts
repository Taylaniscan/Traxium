import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import {
  getPasswordConfirmationError,
  getPasswordValidationError,
} from "@/lib/passwords";
import {
  createRateLimitErrorResponse,
  enforceRateLimit,
  RateLimitExceededError,
} from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const resetPasswordSchema = z.object({
  password: z.string().min(1, "Password is required."),
  confirmPassword: z.string().min(1, "Password confirmation is required."),
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
  try {
    await enforceRateLimit({
      policy: "resetPassword",
      request,
      action: "auth.reset-password",
    });

    const body = await readJsonBody(request);

    if (!body.ok) {
      return body.response;
    }

    const payload = resetPasswordSchema.parse(body.data);
    const passwordError = getPasswordValidationError(payload.password);

    if (passwordError) {
      return jsonError(passwordError, 422);
    }

    const confirmPasswordError = getPasswordConfirmationError(
      payload.password,
      payload.confirmPassword
    );

    if (confirmPasswordError) {
      return jsonError(confirmPasswordError, 422);
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      return jsonError(
        "The password reset session is invalid or has expired.",
        401
      );
    }

    const { error } = await supabase.auth.updateUser({
      password: payload.password,
    });

    if (error) {
      return jsonError(error.message, 422);
    }

    return NextResponse.json({
      success: true,
      email: user.email,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError(
        error.issues[0]?.message ?? "Reset password payload is invalid.",
        422
      );
    }

    if (error instanceof RateLimitExceededError) {
      return createRateLimitErrorResponse(error);
    }

    return jsonError(
      error instanceof Error ? error.message : "Password could not be updated.",
      500
    );
  }
}
