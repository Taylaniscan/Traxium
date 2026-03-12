import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createAlternativeSupplier } from "@/lib/data";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const payload = await request.json();
    const result = await createAlternativeSupplier(id, payload, user.id);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create alternative supplier." }, { status: 400 });
  }
}
