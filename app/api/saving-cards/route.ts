import { UsageFeature, UsageWindow } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createSavingCard, getSavingCards } from "@/lib/data";
import {
  createRateLimitErrorResponse,
  enforceRateLimit,
  RateLimitExceededError,
} from "@/lib/rate-limit";
import {
  enforceUsageQuota,
  recordUsageEvent,
  UsageQuotaExceededError,
} from "@/lib/usage";
import { savingCardSchema } from "@/lib/validation";

const SAVING_CARD_QUOTA_WINDOW = UsageWindow.MONTH;

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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return jsonError("Unauthorized.", 401);
  }

  try {
    const cards = await getSavingCards(user.organizationId);
    return NextResponse.json(cards);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unable to load saving cards.",
      500
    );
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return jsonError("Unauthorized.", 401);
  }

  try {
    await enforceRateLimit({
      policy: "savingCardMutation",
      request,
      userId: user.id,
      organizationId: user.organizationId,
      action: "saving-cards.create",
    });

    const body = await readJsonBody(request);

    if (!body.ok) {
      return body.response;
    }

    if (!isPlainObject(body.data)) {
      return jsonError("Request body must be a JSON object.", 400);
    }

    const payload = savingCardSchema.safeParse(body.data);

    if (!payload.success) {
      return jsonError(payload.error.issues[0]?.message ?? "Saving card payload is invalid.", 422);
    }

    await enforceUsageQuota({
      organizationId: user.organizationId,
      feature: UsageFeature.SAVING_CARDS,
      window: SAVING_CARD_QUOTA_WINDOW,
      requestedQuantity: 1,
      message: "Saving card quota exceeded for the current period.",
    });

    const card = await createSavingCard(payload.data, user.id, user.organizationId);

    await recordUsageEvent({
      organizationId: user.organizationId,
      feature: UsageFeature.SAVING_CARDS,
      quantity: 1,
      window: SAVING_CARD_QUOTA_WINDOW,
      source: "api.saving_cards.create",
      reason: "manual_create",
      metadata: {
        savingCardId: card.id,
        actorUserId: user.id,
      },
    });

    return NextResponse.json(card, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError(error.issues[0]?.message ?? "Saving card payload is invalid.", 422);
    }

    if (error instanceof RateLimitExceededError) {
      return createRateLimitErrorResponse(error);
    }

    if (error instanceof UsageQuotaExceededError) {
      return jsonError(error.message, error.status);
    }

    return jsonError(
      error instanceof Error ? error.message : "Saving card creation failed.",
      500
    );
  }
}
