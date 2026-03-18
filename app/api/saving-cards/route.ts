import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createSavingCard, getSavingCards } from "@/lib/data";
import { savingCardSchema } from "@/lib/validation";

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

    const card = await createSavingCard(payload.data, user.id, user.organizationId);
    return NextResponse.json(card, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError(error.issues[0]?.message ?? "Saving card payload is invalid.", 422);
    }

    return jsonError(
      error instanceof Error ? error.message : "Saving card creation failed.",
      500
    );
  }
}
