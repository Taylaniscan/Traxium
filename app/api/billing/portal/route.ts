import { NextResponse } from "next/server";

import {
  createAuthGuardErrorResponse,
  requireOrganization,
} from "@/lib/auth";
import {
  BillingCheckoutError,
  createBillingPortalSessionForOrganization,
} from "@/lib/billing/checkout";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function POST() {
  try {
    const user = await requireOrganization({ redirectTo: null });
    const session = await createBillingPortalSessionForOrganization({
      organizationId: user.activeOrganization.organizationId,
    });

    return NextResponse.json(
      {
        url: session.url,
      },
      { status: 200 }
    );
  } catch (error) {
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
        : "Billing portal session could not be created.",
      500
    );
  }
}
