import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import {
  canExposeDevelopmentAuthLinks,
  generateRecoveryActionLink,
  isAuthEmailFallbackEligibleError,
} from "@/lib/auth-email";
import { buildAppUrl } from "@/lib/app-url";
import { createSupabasePublicClient } from "@/lib/supabase/server";

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
    const body = await readJsonBody(request);

    if (!body.ok) {
      return body.response;
    }

    const payload = forgotPasswordSchema.parse(body.data);
    const supabase = createSupabasePublicClient();
    const redirectTo = buildAppUrl("/reset-password");
    const { error } = await supabase.auth.resetPasswordForEmail(payload.email, {
      redirectTo,
    });

    if (error) {
      if (
        isAuthEmailFallbackEligibleError(error.message) &&
        canExposeDevelopmentAuthLinks()
      ) {
        const generatedLink = await generateRecoveryActionLink({
          email: payload.email,
          redirectTo,
        });

        return NextResponse.json({
          success: true,
          delivery: {
            transport: "generated-link",
            requiresManualDelivery: true,
          },
          developmentRecoveryLink: generatedLink.actionLink,
        });
      }

      return jsonError(error.message, 422);
    }

    return NextResponse.json({
      success: true,
      delivery: {
        transport: "supabase-auth",
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError(
        error.issues[0]?.message ?? "Forgot password payload is invalid.",
        422
      );
    }

    return jsonError(
      error instanceof Error
        ? error.message
        : "Password reset email could not be sent.",
      500
    );
  }
}
