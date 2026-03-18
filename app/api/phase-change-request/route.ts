import { Phase } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createPhaseChangeRequest, WorkflowError } from "@/lib/data";

function isPhase(value: unknown): value is Phase {
  return typeof value === "string" && Object.values(Phase).includes(value as Phase);
}

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
      savingCardId?: string;
      requestedPhase?: unknown;
      comment?: string;
      cancellationReason?: string;
    };

    if (!payload.savingCardId || !isPhase(payload.requestedPhase)) {
      return NextResponse.json(
        { error: "Saving card and requested phase are required." },
        { status: 400 }
      );
    }

    const result = await createPhaseChangeRequest(
      payload.savingCardId,
      payload.requestedPhase,
      user.id,
      user.organizationId,
      payload.comment,
      payload.cancellationReason
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof WorkflowError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Phase change request failed." },
      { status: 400 }
    );
  }
}
