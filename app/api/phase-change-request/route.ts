import { Phase } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createPhaseChangeRequest } from "@/lib/data";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const payload = (await request.json()) as {
      savingCardId?: string;
      requestedPhase?: Phase;
      comment?: string;
      cancellationReason?: string;
    };

    if (!payload.savingCardId || !payload.requestedPhase) {
      return NextResponse.json({ error: "Saving card and requested phase are required." }, { status: 400 });
    }

    const result = await createPhaseChangeRequest(
      payload.savingCardId,
      payload.requestedPhase,
      user.id,
      payload.comment,
      payload.cancellationReason
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Phase change request failed." },
      { status: 400 }
    );
  }
}
