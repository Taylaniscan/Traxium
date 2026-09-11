import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createAuthGuardErrorResponse, requireUser } from "@/lib/auth";
import { createAlternativeSupplier, WorkflowError } from "@/lib/data";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser({ redirectTo: null });
    const { id } = await params;
    const payload = await request.json();
    const result = await createAlternativeSupplier(id, payload, user.id, user.organizationId);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const response = createAuthGuardErrorResponse(error);

    if (response) {
      return response;
    }

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Alternative supplier payload is invalid." },
        { status: 422 }
      );
    }

    if (error instanceof WorkflowError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create alternative supplier." },
      { status: 400 }
    );
  }
}
