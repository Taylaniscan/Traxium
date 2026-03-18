import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createEvidenceSignedUrl,
  EvidenceStorageNotFoundError,
  isManagedEvidenceStorageLocation,
} from "@/lib/uploads";

const GLOBAL_ACCESS_ROLES = new Set<Role>([
  Role.HEAD_OF_GLOBAL_PROCUREMENT,
  Role.GLOBAL_CATEGORY_LEADER,
  Role.FINANCIAL_CONTROLLER,
]);

function hasGlobalAccess(role: Role) {
  return GLOBAL_ACCESS_ROLES.has(role);
}

function buildEvidenceAccessWhere(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>, evidenceId: string) {
  return {
    id: evidenceId,
    savingCard: {
      organizationId: user.organizationId,
      ...(hasGlobalAccess(user.role)
        ? {}
        : {
            OR: [
              { stakeholders: { some: { userId: user.id } } },
              { approvals: { some: { approverId: user.id } } },
            ],
          }),
    },
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized." },
        { status: 401 },
      );
    }

    const { id } = await params;

    const evidence = await prisma.savingCardEvidence.findFirst({
      where: buildEvidenceAccessWhere(user, id),
      select: {
        id: true,
        fileName: true,
        savingCardId: true,
        storageBucket: true,
        storagePath: true,
        uploadedById: true,
      },
    });

    if (!evidence) {
      return NextResponse.json(
        { success: false, error: "Evidence not found or access denied." },
        { status: 404 },
      );
    }

    if (!isManagedEvidenceStorageLocation({
      storageBucket: evidence.storageBucket,
      storagePath: evidence.storagePath,
      organizationId: user.organizationId,
      savingCardId: evidence.savingCardId,
      uploadedById: evidence.uploadedById,
      fileName: evidence.fileName,
    })) {
      return NextResponse.json(
        { success: false, error: "Evidence not found or access denied." },
        { status: 404 },
      );
    }

    const signedUrl = await createEvidenceSignedUrl(
      evidence.storageBucket,
      evidence.storagePath,
      60,
    );

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        savingCardId: evidence.savingCardId,
        action: "evidence.downloaded",
        detail: `Evidence downloaded: ${evidence.fileName}`,
      },
    });

    return NextResponse.redirect(signedUrl);
  } catch (error) {
    if (error instanceof EvidenceStorageNotFoundError) {
      return NextResponse.json(
        { success: false, error: "Evidence not found or access denied." },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not create download link.",
      },
      { status: 500 },
    );
  }
}
