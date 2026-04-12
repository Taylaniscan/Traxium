import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import {
  queuePasswordRecoveryEmailJobSafely,
} from "@/lib/auth-email";
import { buildAppUrl } from "@/lib/app-url";
import {
  createRateLimitErrorResponse,
  enforceRateLimit,
  RateLimitExceededError,
} from "@/lib/rate-limit";

const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required.")
    .email("Email must be valid."),
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
      policy: "forgotPassword",
      request,
      action: "auth.forgot-password",
    });

    const body = await readJsonBody(request);

    if (!body.ok) {
      return body.response;
    }

    const payload = forgotPasswordSchema.parse(body.data);
    const redirectTo = buildAppUrl("/reset-password");
    const delivery = await queuePasswordRecoveryEmailJobSafely({
      email: payload.email,
      redirectTo,
    });

    return NextResponse.json({
      success: true,
      delivery,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError(
        error.issues[0]?.message ?? "Forgot password payload is invalid.",
        422
      );
    }

    if (error instanceof RateLimitExceededError) {
      return createRateLimitErrorResponse(error);
    }

    return jsonError(
      "Password recovery request could not be accepted.",
      500
    );
  }
}
