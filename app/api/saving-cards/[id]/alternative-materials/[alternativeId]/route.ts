import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { deleteAlternativeMaterial, updateAlternativeMaterial } from "@/lib/data";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; alternativeId: string }> }
) {
  try {
    const user = await requireUser();
    const { alternativeId } = await params;
    const payload = await request.json();
    const result = await updateAlternativeMaterial(alternativeId, payload, user.id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update alternative material." }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; alternativeId: string }> }
) {
  try {
    const { alternativeId } = await params;
    await deleteAlternativeMaterial(alternativeId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to delete alternative material." }, { status: 400 });
  }
}
