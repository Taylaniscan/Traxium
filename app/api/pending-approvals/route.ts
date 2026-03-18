import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPendingApprovals } from "@/lib/data";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const approvals = await getPendingApprovals(user.id, user.organizationId);

    return NextResponse.json(approvals);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load pending approvals." },
      { status: 400 }
    );
  }
}
