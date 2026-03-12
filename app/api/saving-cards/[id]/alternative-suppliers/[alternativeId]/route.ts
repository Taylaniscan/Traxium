import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { deleteAlternativeSupplier, updateAlternativeSupplier } from "@/lib/data";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; alternativeId: string }> }
) {
  try {
    const user = await requireUser();
    const { alternativeId } = await params;
    const payload = await request.json();
    const result = await updateAlternativeSupplier(alternativeId, payload, user.id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update alternative supplier." }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; alternativeId: string }> }
) {
  try {
    const { alternativeId } = await params;
    await deleteAlternativeSupplier(alternativeId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to delete alternative supplier." }, { status: 400 });
  }
}
