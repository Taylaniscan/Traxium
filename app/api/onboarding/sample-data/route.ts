import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
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
  const user = await getCurrentUser();

  if (!user) {
    trackServerEvent(
      {
        ...requestContext,
        event: "onboarding.sample_data.unauthorized",
        status: 401,
      },
      "warn"
    );
    return jsonError("Unauthorized.", 401);
  }

  try {
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
    if (error instanceof FirstValueError) {
      trackServerEvent(
        {
          ...requestContext,
          event: "onboarding.sample_data.rejected",
          organizationId: user.organizationId,
          userId: user.id,
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
      organizationId: user.organizationId,
      userId: user.id,
      status: 500,
    });

    return jsonError(
      error instanceof Error ? error.message : "Sample data could not be loaded.",
      500
    );
  }
}
