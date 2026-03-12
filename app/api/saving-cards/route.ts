import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createSavingCard, getSavingCards } from "@/lib/data";

export async function GET() {
  const cards = await getSavingCards();
  return NextResponse.json(cards);
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const payload = await request.json();
    const card = await createSavingCard(payload, user.id);
    return NextResponse.json(card, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Creation failed." }, { status: 400 });
  }
}
