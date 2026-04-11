import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { createAuthGuardErrorResponse, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createEvidenceSignedUrl,
  EvidenceStorageNotFoundError,
  isManagedEvidenceStorageLocation,
} from "@/lib/uploads";
import type { AuthenticatedUser } from "@/lib/types";

const GLOBAL_ACCESS_ROLES = new Set<Role>([
  Role.HEAD_OF_GLOBAL_PROCUREMENT,
  Role.GLOBAL_CATEGORY_LEADER,
  Role.FINANCIAL_CONTROLLER,
]);

function hasGlobalAccess(role: Role) {
  return GLOBAL_ACCESS_ROLES.has(role);
}

const evidenceParamsSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, "Evidence id is required.")
    .refine((value) => !value.includes("/"), "Evidence id is invalid."),
});

const NOT_FOUND_ERROR = "Evidence not found or access denied.";

function errorResponse(error: string, status: number) {
  return NextResponse.json(
    {
      success: false,
      error,
    },
    { status }
  );
}

function buildEvidenceAccessWhere(
  user: AuthenticatedUser,
  evidenceId: string
) {
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
    const user = await requireUser({ redirectTo: null });
    const { id } = evidenceParamsSchema.parse(await params);

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
      return errorResponse(NOT_FOUND_ERROR, 404);
    }

    if (!isManagedEvidenceStorageLocation({
      storageBucket: evidence.storageBucket,
      storagePath: evidence.storagePath,
      organizationId: user.organizationId,
      savingCardId: evidence.savingCardId,
      uploadedById: evidence.uploadedById,
      fileName: evidence.fileName,
    })) {
      return errorResponse(NOT_FOUND_ERROR, 404);
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
    const authResponse = createAuthGuardErrorResponse(error);

    if (authResponse) {
      return authResponse;
    }

    if (error instanceof ZodError) {
      return errorResponse(error.issues[0]?.message ?? "Evidence id is invalid.", 422);
    }

    if (error instanceof EvidenceStorageNotFoundError) {
      return errorResponse(NOT_FOUND_ERROR, 404);
    }

    return errorResponse(
      error instanceof Error
        ? error.message
        : "Could not create download link.",
      500
    );
  }
}
