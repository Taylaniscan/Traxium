import { NextResponse } from "next/server";

import { bootstrapCurrentUser } from "@/lib/auth";
import {
  captureException,
  createRouteObservabilityContext,
  trackServerEvent,
} from "@/lib/observability";

export async function POST(request: Request) {
  const requestContext = createRouteObservabilityContext(request, {
    event: "auth.bootstrap.requested",
  });

  try {
    const result = await bootstrapCurrentUser();

    if (!result.ok) {
      const status = result.code === "UNAUTHENTICATED" ? 401 : 403;

      trackServerEvent(
        {
          ...requestContext,
          event: "auth.bootstrap.denied",
          message: result.message,
          status,
          payload: {
            code: result.code,
          },
        },
        "warn"
      );

      return NextResponse.json(
        {
          error: result.message,
          code: result.code,
        },
        {
          status,
        }
      );
    }

    trackServerEvent({
      ...requestContext,
      event: "auth.bootstrap.succeeded",
      organizationId: result.user.organizationId,
      userId: result.user.id,
      status: 200,
      payload: {
        repaired: result.repaired,
        activeOrganizationId: result.user.activeOrganization.organizationId,
      },
    });

    return NextResponse.json({
      repaired: result.repaired,
      user: result.user,
    });
  } catch (error) {
    captureException(error, {
      ...requestContext,
      event: "auth.bootstrap.failed",
      status: 500,
    });

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Authentication bootstrap failed.",
      },
      { status: 500 }
    );
  }
}
