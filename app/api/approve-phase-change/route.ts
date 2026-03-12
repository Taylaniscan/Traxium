import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { approvePhaseChangeRequest } from "@/lib/data";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const payload = (await request.json()) as {
      requestId?: string;
      approved?: boolean;
      comment?: string;
    };

    if (!payload.requestId || typeof payload.approved !== "boolean") {
      return NextResponse.json({ error: "Request id and decision are required." }, { status: 400 });
    }

    const result = await approvePhaseChangeRequest(payload.requestId, user.id, payload.approved, payload.comment);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Phase approval failed." },
      { status: 400 }
    );
  }
}
