import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { FirstValueError, loadFirstValueSampleData } from "@/lib/first-value";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function POST() {
  const user = await getCurrentUser();

  if (!user) {
    return jsonError("Unauthorized.", 401);
  }

  try {
    const result = await loadFirstValueSampleData(user.id, user.organizationId);

    return NextResponse.json(
      {
        success: true,
        organizationId: result.organizationId,
        createdCardsCount: result.createdCardsCount,
        createdSavingCards: result.createdSavingCards,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof FirstValueError) {
      return jsonError(error.message, error.status);
    }

    return jsonError(
      error instanceof Error ? error.message : "Sample data could not be loaded.",
      500
    );
  }
}
