import { NextResponse } from "next/server";
import { createAuthGuardErrorResponse, requireUser } from "@/lib/auth";
import { getPendingApprovals } from "@/lib/data";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function GET() {
  try {
    const user = await requireUser({ redirectTo: null });
    const approvals = await getPendingApprovals(user.id, user.organizationId);

    return NextResponse.json(approvals);
  } catch (error) {
    const authResponse = createAuthGuardErrorResponse(error);

    if (authResponse) {
      return authResponse;
    }

    return jsonError(
      error instanceof Error ? error.message : "Unable to load pending approvals.",
      500
    );
  }
}
