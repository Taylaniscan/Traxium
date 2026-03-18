import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { approvePhaseChangeRequest, WorkflowError } from "@/lib/data";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const payload = (await request.json()) as {
      requestId?: string;
      approved?: boolean;
      comment?: string;
    };

    if (!payload.requestId || typeof payload.approved !== "boolean") {
      return NextResponse.json(
        { error: "Request id and decision are required." },
        { status: 400 }
      );
    }

    const result = await approvePhaseChangeRequest(
      payload.requestId,
      user.id,
      user.organizationId,
      payload.approved,
      payload.comment
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof WorkflowError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Phase approval failed." },
      { status: 400 }
    );
  }
}
