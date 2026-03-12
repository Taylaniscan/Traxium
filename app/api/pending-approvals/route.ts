import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getPendingApprovals } from "@/lib/data";

export async function GET() {
  try {
    const user = await requireUser();
    const approvals = await getPendingApprovals(user.id);
    return NextResponse.json(approvals);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load pending approvals." },
      { status: 400 }
    );
  }
}
