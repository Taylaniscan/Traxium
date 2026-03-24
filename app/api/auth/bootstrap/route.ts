import { NextResponse } from "next/server";

import { bootstrapCurrentUser } from "@/lib/auth";

export async function POST() {
  try {
    const result = await bootstrapCurrentUser();

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.message,
          code: result.code,
        },
        {
          status: result.code === "UNAUTHENTICATED" ? 401 : 403,
        }
      );
    }

    return NextResponse.json({
      repaired: result.repaired,
      user: result.user,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Authentication bootstrap failed.",
      },
      { status: 500 }
    );
  }
}
