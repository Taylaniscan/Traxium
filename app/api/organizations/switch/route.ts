import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import { isAuthGuardError, switchCurrentOrganization } from "@/lib/auth";

const organizationSwitchSchema = z.object({
  organizationId: z.string().trim().min(1, "Organization id is required."),
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

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);

    if (!body.ok) {
      return body.response;
    }

    const payload = organizationSwitchSchema.parse(body.data);
    const user = await switchCurrentOrganization(payload.organizationId);

    return NextResponse.json({
      success: true,
      organizationId: user.organizationId,
      activeOrganizationId: user.activeOrganizationId,
      activeOrganization: user.activeOrganization,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError(
        error.issues[0]?.message ?? "Organization switch payload is invalid.",
        422
      );
    }

    if (isAuthGuardError(error)) {
      return jsonError(error.message, error.status);
    }

    return jsonError(
      error instanceof Error ? error.message : "Unable to switch organization.",
      500
    );
  }
}
