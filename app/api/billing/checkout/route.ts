import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import {
  createAuthGuardErrorResponse,
  requireOrganization,
} from "@/lib/auth";
import {
  BillingCheckoutError,
  createCheckoutSessionForOrganization,
} from "@/lib/billing/checkout";
import { stripePlanCatalogKeys } from "@/lib/billing/config";

const billingCheckoutSchema = z.object({
  planCode: z.enum(stripePlanCatalogKeys),
  priceId: z.string().trim().min(1, "Price id is required."),
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
    const user = await requireOrganization({ redirectTo: null });
    const body = await readJsonBody(request);

    if (!body.ok) {
      return body.response;
    }

    const payload = billingCheckoutSchema.parse(body.data);
    const session = await createCheckoutSessionForOrganization({
      organizationId: user.activeOrganization.organizationId,
      userId: user.id,
      customerEmail: user.email,
      planCode: payload.planCode,
      priceId: payload.priceId,
    });

    return NextResponse.json(
      {
        sessionId: session.sessionId,
        url: session.url,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError(
        error.issues[0]?.message ?? "Billing checkout payload is invalid.",
        422
      );
    }

    if (error instanceof BillingCheckoutError) {
      return jsonError(error.message, error.status);
    }

    const authResponse = createAuthGuardErrorResponse(error);

    if (authResponse) {
      return authResponse;
    }

    return jsonError(
      error instanceof Error
        ? error.message
        : "Billing checkout session could not be created.",
      500
    );
  }
}
