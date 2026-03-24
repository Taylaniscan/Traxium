import { NextResponse } from "next/server";
import { createAuthGuardErrorResponse, requireUser } from "@/lib/auth";
import { createAlternativeMaterial } from "@/lib/data";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser({ redirectTo: null });
    const { id } = await params;
    const payload = await request.json();
    const result = await createAlternativeMaterial(id, payload, user.id, user.organizationId);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const response = createAuthGuardErrorResponse(error);

    if (response) {
      return response;
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create alternative material." }, { status: 400 });
  }
}
