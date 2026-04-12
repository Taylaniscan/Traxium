import { NextResponse } from "next/server";
import { createAuthGuardErrorResponse, requireUser } from "@/lib/auth";
import { analyticsEventNames, trackEvent } from "@/lib/analytics";
import { FirstValueError, loadFirstValueSampleData } from "@/lib/first-value";
import {
  captureException,
  createRouteObservabilityContext,
  trackServerEvent,
} from "@/lib/observability";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: Request) {
  const requestContext = createRouteObservabilityContext(request, {
    event: "onboarding.sample_data.requested",
  });
  let user:
    | Awaited<ReturnType<typeof requireUser>>
    | null = null;

  try {
    user = await requireUser({ redirectTo: null });
    const result = await loadFirstValueSampleData(user.id, user.organizationId);

    trackServerEvent({
      ...requestContext,
      event: "onboarding.sample_data.succeeded",
      organizationId: user.organizationId,
      userId: user.id,
      status: 201,
      payload: {
        createdCardsCount: result.createdCardsCount,
      },
    });

    await trackEvent({
      event: analyticsEventNames.WORKSPACE_SAMPLE_DATA_LOADED,
      organizationId: result.organizationId,
      userId: user.id,
      properties: {
        createdCardsCount: result.createdCardsCount,
      },
    });

    return NextResponse.json(
      {
        success: true,
        organizationId: result.organizationId,
        createdCardsCount: result.createdCardsCount,
        createdSavingCards: result.createdSavingCards,
      },
      { status: 201 }
    );
  } catch (error) {
    const authResponse = createAuthGuardErrorResponse(error);

    if (authResponse) {
      trackServerEvent(
        {
          ...requestContext,
          event: "onboarding.sample_data.unauthorized",
          message: error instanceof Error ? error.message : "Unauthorized",
          status: authResponse.status,
        },
        "warn"
      );
      return authResponse;
    }

    if (error instanceof FirstValueError) {
      trackServerEvent(
        {
          ...requestContext,
          event: "onboarding.sample_data.rejected",
          organizationId: user?.organizationId,
          userId: user?.id,
          message: error.message,
          status: error.status,
        },
        "warn"
      );
      return jsonError(error.message, error.status);
    }

    captureException(error, {
      ...requestContext,
      event: "onboarding.sample_data.failed",
      organizationId: user?.organizationId,
      userId: user?.id,
      status: 500,
    });

    return jsonError(
      error instanceof Error ? error.message : "Sample data could not be loaded.",
      500
    );
  }
}
