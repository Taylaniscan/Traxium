import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPendingApprovals } from "@/lib/data";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return jsonError("Unauthorized.", 401);
  }

  try {
    const approvals = await getPendingApprovals(user.id, user.organizationId);

    return NextResponse.json(approvals);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unable to load pending approvals.",
      500
    );
  }
}
