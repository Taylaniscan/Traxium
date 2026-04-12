import { Role, UsageFeature, UsageWindow } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthGuardErrorResponse, requireUser } from "@/lib/auth";
import {
  MAX_EVIDENCE_FILE_SIZE,
  isAllowedEvidenceFileName,
} from "@/lib/evidence-config";
import { prisma } from "@/lib/prisma";
import {
  createRateLimitErrorResponse,
  enforceRateLimit,
  RateLimitExceededError,
} from "@/lib/rate-limit";
import {
  enforceUsageQuota,
  recordUsageEvent,
  UsageQuotaExceededError,
} from "@/lib/usage";
import { storeEvidenceFile } from "@/lib/uploads";
import type { AuthenticatedUser } from "@/lib/types";

const GLOBAL_ACCESS_ROLES = new Set<Role>([
  Role.HEAD_OF_GLOBAL_PROCUREMENT,
  Role.GLOBAL_CATEGORY_LEADER,
  Role.FINANCIAL_CONTROLLER,
]);
const ALLOWED_FORM_FIELDS = new Set(["savingCardId", "files"]);
const MAX_FILES_PER_UPLOAD = 10;
const EVIDENCE_UPLOAD_QUOTA_WINDOW = UsageWindow.MONTH;
const ALLOWED_CONTENT_TYPES_BY_EXTENSION: Record<string, readonly string[]> = {
  ".pdf": ["application/pdf"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".png": ["image/png"],
  ".xls": [
    "application/vnd.ms-excel",
    "application/excel",
    "application/x-excel",
    "application/x-msexcel",
  ],
  ".xlsx": [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip",
  ],
  ".doc": ["application/msword", "application/doc", "application/vnd.ms-word"],
  ".docx": [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/zip",
  ],
  ".ppt": [
    "application/vnd.ms-powerpoint",
    "application/mspowerpoint",
    "application/powerpoint",
  ],
  ".pptx": [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/zip",
  ],
};

const savingCardIdSchema = z.object({
  savingCardId: z
    .string()
    .trim()
    .min(1, "Saving card id is required.")
    .refine((value) => !value.includes("/"), "Saving card id is invalid."),
});

function hasGlobalAccess(role: Role) {
  return GLOBAL_ACCESS_ROLES.has(role);
}

function errorResponse(error: string, status: number) {
  return NextResponse.json(
    {
      success: false,
      error,
    },
    { status }
  );
}

function formatMaxEvidenceFileSize() {
  return `${Math.round(MAX_EVIDENCE_FILE_SIZE / (1024 * 1024))} MB`;
}

function getFileExtension(fileName: string) {
  const index = fileName.lastIndexOf(".");
  return index >= 0 ? fileName.slice(index).toLowerCase() : "";
}

function getFileValidationError(file: File) {
  const fileName = file.name.trim();

  if (!fileName) {
    return "Uploaded files must include a file name.";
  }

  if (fileName.includes("/") || fileName.includes("\\") || fileName.includes("\0")) {
    return "Uploaded file names are invalid.";
  }

  if (!isAllowedEvidenceFileName(fileName)) {
    return "Unsupported file type. Upload PDF, Office, or image files only.";
  }

  if (file.size <= 0) {
    return "Uploaded files must be non-empty.";
  }

  if (file.size > MAX_EVIDENCE_FILE_SIZE) {
    return `Each file must be ${formatMaxEvidenceFileSize()} or smaller.`;
  }

  const normalizedType = file.type.trim().toLowerCase();
  if (normalizedType && normalizedType !== "application/octet-stream") {
    const allowedTypes = ALLOWED_CONTENT_TYPES_BY_EXTENSION[getFileExtension(fileName)];

    if (allowedTypes && !allowedTypes.includes(normalizedType)) {
      return "Uploaded file content type does not match the file extension.";
    }
  }

  return null;
}

function buildSavingCardAccessWhere(
  user: AuthenticatedUser,
  savingCardId: string
) {
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
    const user = await requireUser({ redirectTo: null });
    await enforceRateLimit({
      policy: "evidenceUpload",
      request,
      userId: user.id,
      organizationId: user.organizationId,
      action: "evidence.upload",
    });

    let formData: FormData;

    try {
      formData = await request.formData();
    } catch {
      return errorResponse("Request body must be valid form data.", 400);
    }

    const unexpectedField = Array.from(formData.keys()).find(
      (key) => !ALLOWED_FORM_FIELDS.has(key)
    );

    if (unexpectedField) {
      return errorResponse(`Unexpected form field "${unexpectedField}".`, 400);
    }

    const savingCardIdValues = formData.getAll("savingCardId");

    if (savingCardIdValues.length !== 1 || typeof savingCardIdValues[0] !== "string") {
      return errorResponse("Exactly one savingCardId field is required.", 400);
    }

    const savingCardIdResult = savingCardIdSchema.safeParse({
      savingCardId: savingCardIdValues[0],
    });

    if (!savingCardIdResult.success) {
      return errorResponse(
        savingCardIdResult.error.issues[0]?.message ?? "Saving card id is invalid.",
        422
      );
    }

    const savingCardId = savingCardIdResult.data.savingCardId;

    const rawFiles = formData.getAll("files");

    if (!rawFiles.length) {
      return errorResponse("At least one file is required.", 422);
    }

    const nonFileEntry = rawFiles.find((value) => !(value instanceof File));

    if (nonFileEntry) {
      return errorResponse("All files entries must be uploaded files.", 422);
    }

    const files = rawFiles as File[];

    if (files.length > MAX_FILES_PER_UPLOAD) {
      return errorResponse(
        `You can upload up to ${MAX_FILES_PER_UPLOAD} files per request.`,
        422
      );
    }

    const invalidFile = files.find((file) => getFileValidationError(file));

    if (invalidFile) {
      return errorResponse(getFileValidationError(invalidFile) ?? "Uploaded file is invalid.", 422);
    }

    const savingCard = await prisma.savingCard.findFirst({
      where: buildSavingCardAccessWhere(user, savingCardId),
      select: {
        id: true,
        organizationId: true,
      },
    });

    if (!savingCard) {
      return errorResponse("Saving card not found.", 404);
    }

    await enforceUsageQuota({
      organizationId: savingCard.organizationId,
      feature: UsageFeature.EVIDENCE_UPLOADS,
      window: EVIDENCE_UPLOAD_QUOTA_WINDOW,
      requestedQuantity: files.length,
      message:
        "This upload would exceed the evidence upload quota for the current period.",
    });

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

    await recordUsageEvent({
      organizationId: savingCard.organizationId,
      feature: UsageFeature.EVIDENCE_UPLOADS,
      quantity: files.length,
      window: EVIDENCE_UPLOAD_QUOTA_WINDOW,
      source: "api.evidence.upload",
      reason: "attachment_upload",
      metadata: {
        savingCardId: savingCard.id,
        uploadedByUserId: user.id,
        fileCount: files.length,
      },
    });

    return NextResponse.json(
      { success: true, files: uploaded },
      { status: 201 },
    );
  } catch (error) {
    const authResponse = createAuthGuardErrorResponse(error);

    if (authResponse) {
      return authResponse;
    }

    if (error instanceof RateLimitExceededError) {
      return createRateLimitErrorResponse(error);
    }

    if (error instanceof UsageQuotaExceededError) {
      return errorResponse(error.message, error.status);
    }

    return errorResponse(
      error instanceof Error ? error.message : "Upload failed.",
      500
    );
  }
}
