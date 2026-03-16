import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createEvidenceSignedUrl } from "@/lib/uploads";

const GLOBAL_ACCESS_ROLES = new Set<Role>([
  Role.HEAD_OF_GLOBAL_PROCUREMENT,
  Role.GLOBAL_CATEGORY_LEADER,
  Role.FINANCIAL_CONTROLLER,
]);

function hasGlobalAccess(role: Role) {
  return GLOBAL_ACCESS_ROLES.has(role);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { id } = await params;

    const evidence = await prisma.savingCardEvidence.findFirst({
      where: hasGlobalAccess(user.role)
        ? { id }
        : {
            id,
            savingCard: {
              OR: [
                { buyerId: user.id },
                { stakeholders: { some: { userId: user.id } } },
                { approvals: { some: { approverId: user.id } } },
              ],
            },
          },
      select: {
        id: true,
        fileName: true,
        storageBucket: true,
        storagePath: true,
      },
    });

    if (!evidence) {
      return NextResponse.json(
        { error: "Evidence not found or access denied." },
        { status: 404 },
      );
    }

    const signedUrl = await createEvidenceSignedUrl(
      evidence.storageBucket,
      evidence.storagePath,
      60,
    );

    return NextResponse.redirect(signedUrl);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not create download link.",
      },
      { status: 500 },
    );
  }
}