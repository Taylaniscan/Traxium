import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { storeEvidenceFile } from "@/lib/uploads";

const GLOBAL_ACCESS_ROLES = new Set<Role>([
  Role.HEAD_OF_GLOBAL_PROCUREMENT,
  Role.GLOBAL_CATEGORY_LEADER,
  Role.FINANCIAL_CONTROLLER,
]);

function hasGlobalAccess(role: Role) {
  return GLOBAL_ACCESS_ROLES.has(role);
}

function buildSavingCardAccessWhere(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>, savingCardId: string) {
  return {
    id: savingCardId,
    organizationId: user.organizationId,
    ...(hasGlobalAccess(user.role)
      ? {}
      : {
          OR: [
            { stakeholders: { some: { userId: user.id } } },
            { approvals: { some: { approverId: user.id } } },
          ],
        }),
  };
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized." },
        { status: 401 },
      );
    }

    const formData = await request.formData();
    const savingCardIdValue = formData.get("savingCardId");

    if (typeof savingCardIdValue !== "string" || !savingCardIdValue.trim()) {
      return NextResponse.json(
        { success: false, error: "Missing savingCardId." },
        { status: 400 },
      );
    }

    const savingCardId = savingCardIdValue.trim();

    const files = formData
      .getAll("files")
      .filter((value): value is File => value instanceof File);

    if (!files.length) {
      return NextResponse.json(
        { success: false, error: "No files were uploaded." },
        { status: 400 },
      );
    }

    const savingCard = await prisma.savingCard.findFirst({
      where: buildSavingCardAccessWhere(user, savingCardId),
      select: {
        id: true,
        organizationId: true,
      },
    });

    if (!savingCard) {
      return NextResponse.json(
        {
          success: false,
          error: "Saving card not found.",
        },
        { status: 404 },
      );
    }

    const uploaded = [];

    for (const file of files) {
      const stored = await storeEvidenceFile(file, {
        organizationId: savingCard.organizationId,
        savingCardId: savingCard.id,
      });

      const evidence = await prisma.savingCardEvidence.create({
        data: {
          savingCardId: savingCard.id,
          fileName: stored.fileName,
          storageBucket: stored.storageBucket,
          storagePath: stored.storagePath,
          fileSize: stored.fileSize,
          fileType: stored.fileType,
          uploadedById: user.id,
        },
        select: {
          id: true,
          fileName: true,
          fileSize: true,
          fileType: true,
          uploadedAt: true,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: user.id,
          savingCardId: savingCard.id,
          action: "evidence.uploaded",
          detail: `Evidence uploaded: ${stored.fileName}`,
        },
      });

      uploaded.push({
        ...evidence,
        downloadUrl: `/api/evidence/${evidence.id}/download`,
      });
    }

    return NextResponse.json(
      { success: true, files: uploaded },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Upload failed.",
      },
      { status: 500 },
    );
  }
}
