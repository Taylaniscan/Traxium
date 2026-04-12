import { Phase } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { createAuthGuardErrorResponse, requireUser } from "@/lib/auth";
import { createPhaseChangeRequest, WorkflowError } from "@/lib/data";

const phaseChangeRequestSchema = z
  .object({
    savingCardId: z.string().trim().min(1, "Saving card is required."),
    requestedPhase: z.nativeEnum(Phase),
    comment: z.string().optional(),
    cancellationReason: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.requestedPhase === Phase.CANCELLED && !value.cancellationReason?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cancellationReason"],
        message: "Cancellation reason is required.",
      });
    }
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  try {
    const user = await requireUser({ redirectTo: null });
    const body = await readJsonBody(request);

    if (!body.ok) {
      return body.response;
    }

    if (!isPlainObject(body.data)) {
      return jsonError("Request body must be a JSON object.", 400);
    }

    const payload = phaseChangeRequestSchema.safeParse(body.data);

    if (!payload.success) {
      return jsonError(payload.error.issues[0]?.message ?? "Phase change request payload is invalid.", 422);
    }

    const result = await createPhaseChangeRequest(
      payload.data.savingCardId,
      payload.data.requestedPhase,
      user.id,
      user.organizationId,
      payload.data.comment,
      payload.data.cancellationReason
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const authResponse = createAuthGuardErrorResponse(error);

    if (authResponse) {
      return authResponse;
    }

    if (error instanceof WorkflowError) {
      return jsonError(error.message, error.status);
    }

    if (error instanceof ZodError) {
      return jsonError(error.issues[0]?.message ?? "Phase change request payload is invalid.", 422);
    }

    return jsonError(
      error instanceof Error ? error.message : "Phase change request failed.",
      500
    );
  }
}
