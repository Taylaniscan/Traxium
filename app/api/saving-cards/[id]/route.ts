import { Phase } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { createAuthGuardErrorResponse, requireUser } from "@/lib/auth";
import { addApproval, getSavingCard, setFinanceLock, updateSavingCard } from "@/lib/data";
import { canApprovePhase, canLockFinance } from "@/lib/permissions";
import {
  createRateLimitErrorResponse,
  enforceRateLimit,
  RateLimitExceededError,
} from "@/lib/rate-limit";
import { savingCardSchema } from "@/lib/validation";

const paramsSchema = z.object({
  id: z.string().trim().min(1, "Saving card id is required."),
});

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("approve"),
    phase: z.nativeEnum(Phase),
    comment: z.string().optional(),
  }),
  z.object({
    action: z.literal("finance-lock"),
    locked: z.boolean(),
  }),
]);

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

async function resolveSavingCardId(
  params: Promise<{ id: string }>
): Promise<string> {
  return paramsSchema.parse(await params).id;
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser({ redirectTo: null });
    await enforceRateLimit({
      policy: "savingCardUpdate",
      request,
      userId: user.id,
      organizationId: user.organizationId,
      action: "saving-cards.update",
    });

    const id = await resolveSavingCardId(params);
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

    const existingCard = await getSavingCard(id, user.organizationId);

    if (!existingCard) {
      return jsonError("Saving card not found.", 404);
    }

    const card = await updateSavingCard(id, payload.data, user.id, user.organizationId);
    return NextResponse.json(card);
  } catch (error) {
    const authResponse = createAuthGuardErrorResponse(error);

    if (authResponse) {
      return authResponse;
    }

    if (error instanceof ZodError) {
      return jsonError(error.issues[0]?.message ?? "Saving card payload is invalid.", 422);
    }

    if (error instanceof RateLimitExceededError) {
      return createRateLimitErrorResponse(error);
    }

    return jsonError(
      error instanceof Error ? error.message : "Saving card update failed.",
      500
    );
  }
}

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser({ redirectTo: null });
    const id = await resolveSavingCardId(params);
    const card = await getSavingCard(id, user.organizationId);

    if (!card) {
      return jsonError("Saving card not found.", 404);
    }

    return jsonError(
      "Direct phase updates are disabled. Use /api/phase-change-request to request workflow approval.",
      409
    );
  } catch (error) {
    const authResponse = createAuthGuardErrorResponse(error);

    if (authResponse) {
      return authResponse;
    }

    if (error instanceof ZodError) {
      return jsonError(error.issues[0]?.message ?? "Saving card id is invalid.", 422);
    }

    return jsonError(
      error instanceof Error ? error.message : "Phase update failed.",
      500
    );
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser({ redirectTo: null });
    await enforceRateLimit({
      policy: "savingCardUpdate",
      request,
      userId: user.id,
      organizationId: user.organizationId,
      action: "saving-cards.action",
    });

    const id = await resolveSavingCardId(params);
    const body = await readJsonBody(request);

    if (!body.ok) {
      return body.response;
    }

    if (!isPlainObject(body.data)) {
      return jsonError("Request body must be a JSON object.", 400);
    }

    const payload = actionSchema.safeParse(body.data);

    if (!payload.success) {
      return jsonError(payload.error.issues[0]?.message ?? "Action payload is invalid.", 422);
    }

    const card = await getSavingCard(id, user.organizationId);

    if (!card) {
      return jsonError("Saving card not found.", 404);
    }

    if (payload.data.action === "approve") {
      const phase = payload.data.phase;
      if (!canApprovePhase(user.role, phase)) {
        return jsonError("You are not allowed to approve this phase.", 403);
      }
      const result = await addApproval(card.id, phase, user.id, true, payload.data.comment);
      return NextResponse.json(result);
    }

    if (payload.data.action === "finance-lock") {
      if (!canLockFinance(user.role)) {
        return jsonError("Only finance can lock savings.", 403);
      }
      const result = await setFinanceLock(card.id, user.id, payload.data.locked, user.organizationId);
      return NextResponse.json(result);
    }

    return jsonError("Unsupported action.", 422);
  } catch (error) {
    const authResponse = createAuthGuardErrorResponse(error);

    if (authResponse) {
      return authResponse;
    }

    if (error instanceof ZodError) {
      return jsonError(error.issues[0]?.message ?? "Action payload is invalid.", 422);
    }

    if (error instanceof RateLimitExceededError) {
      return createRateLimitErrorResponse(error);
    }

    return jsonError(
      error instanceof Error ? error.message : "Saving card action failed.",
      500
    );
  }
}
