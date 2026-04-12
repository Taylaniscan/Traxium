import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { createAuthGuardErrorResponse, requireUser } from "@/lib/auth";
import { approvePhaseChangeRequest, WorkflowError } from "@/lib/data";

const approvePhaseChangeSchema = z.object({
  requestId: z.string().trim().min(1, "Request id is required."),
  approved: z.boolean(),
  comment: z.string().optional(),
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

    const payload = approvePhaseChangeSchema.safeParse(body.data);

    if (!payload.success) {
      return jsonError(payload.error.issues[0]?.message ?? "Phase approval payload is invalid.", 422);
    }

    const result = await approvePhaseChangeRequest(
      payload.data.requestId,
      user.id,
      user.organizationId,
      payload.data.approved,
      payload.data.comment
    );

    return NextResponse.json(result);
  } catch (error) {
    const authResponse = createAuthGuardErrorResponse(error);

    if (authResponse) {
      return authResponse;
    }

    if (error instanceof WorkflowError) {
      return jsonError(error.message, error.status);
    }

    if (error instanceof ZodError) {
      return jsonError(error.issues[0]?.message ?? "Phase approval payload is invalid.", 422);
    }

    return jsonError(
      error instanceof Error ? error.message : "Phase approval failed.",
      500
    );
  }
}
