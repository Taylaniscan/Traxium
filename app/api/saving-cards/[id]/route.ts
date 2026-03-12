import { Phase } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { addApproval, getSavingCard, setFinanceLock, updateSavingCard } from "@/lib/data";
import { canApprovePhase, canLockFinance } from "@/lib/permissions";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const payload = await request.json();
    const card = await updateSavingCard(id, payload, user.id);
    return NextResponse.json(card);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Update failed." }, { status: 400 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const card = await getSavingCard(id);

    if (!card) {
      return NextResponse.json({ error: "Saving card not found." }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Direct phase updates are disabled. Use /api/phase-change-request to request workflow approval." },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Phase update failed." }, { status: 400 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const payload = await request.json();

    if (payload.action === "approve") {
      const phase = payload.phase as Phase;
      if (!canApprovePhase(user.role, phase)) {
        return NextResponse.json({ error: "You are not allowed to approve this phase." }, { status: 403 });
      }
      const result = await addApproval(id, phase, user.id, true, payload.comment);
      return NextResponse.json(result);
    }

    if (payload.action === "finance-lock") {
      if (!canLockFinance(user.role)) {
        return NextResponse.json({ error: "Only finance can lock savings." }, { status: 403 });
      }
      const result = await setFinanceLock(id, user.id, Boolean(payload.locked));
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Action failed." }, { status: 400 });
  }
}
