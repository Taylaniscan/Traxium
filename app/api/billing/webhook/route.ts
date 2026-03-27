import { NextResponse } from "next/server";

import {
  constructStripeWebhookEvent,
  processStripeWebhookEvent,
  StripeWebhookSignatureError,
} from "@/lib/billing/webhooks";

export const runtime = "nodejs";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: Request) {
  let rawBody = "";

  try {
    rawBody = await request.text();
  } catch {
    return jsonError("Webhook body could not be read.", 400);
  }

  try {
    const event = constructStripeWebhookEvent(
      rawBody,
      request.headers.get("stripe-signature") ?? ""
    );
    const result = await processStripeWebhookEvent(event);

    return NextResponse.json({
      received: true,
      duplicate: result.status === "duplicate",
      status: result.status,
    });
  } catch (error) {
    if (error instanceof StripeWebhookSignatureError) {
      return jsonError(error.message, error.status);
    }

    return jsonError(
      error instanceof Error
        ? error.message
        : "Stripe webhook processing failed.",
      500
    );
  }
}
