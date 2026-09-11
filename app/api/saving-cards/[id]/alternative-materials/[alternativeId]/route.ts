import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createAuthGuardErrorResponse, requireUser } from "@/lib/auth";
import { deleteAlternativeMaterial, updateAlternativeMaterial, WorkflowError } from "@/lib/data";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; alternativeId: string }> }
) {
  try {
    const user = await requireUser({ redirectTo: null });
    const { id, alternativeId } = await params;
    const payload = await request.json();
    const result = await updateAlternativeMaterial(
      alternativeId,
      payload,
      user.id,
      user.organizationId,
      id
    );
    return NextResponse.json(result);
  } catch (error) {
    const response = createAuthGuardErrorResponse(error);

    if (response) {
      return response;
    }

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Alternative material payload is invalid." },
        { status: 422 }
      );
    }

    if (error instanceof WorkflowError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update alternative material." },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; alternativeId: string }> }
) {
  try {
    const user = await requireUser({ redirectTo: null });
    const { id, alternativeId } = await params;
    await deleteAlternativeMaterial(alternativeId, user.organizationId, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const response = createAuthGuardErrorResponse(error);

    if (response) {
      return response;
    }

    if (error instanceof WorkflowError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete alternative material." },
      { status: 400 }
    );
  }
}
