import { EvidenceType, UsageFeature } from "@prisma/client";
import { NextResponse } from "next/server";

import { createAuthGuardErrorResponse, requireUser } from "@/lib/auth";
import { auditEventTypes, writeAuditEvent } from "@/lib/audit";
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

import {
  buildSavingCardAccessWhere,
  EVIDENCE_UPLOAD_QUOTA_WINDOW,
  evidenceErrorResponse as errorResponse,
  evidenceTypeSchema,
  getFileValidationError,
  savingCardIdSchema,
} from "./shared";

// Multipart upload through the app. Vercel caps function request bodies at
// 4.5 MB, so the browser uses the signed direct-to-storage flow
// (./sign + ./complete) instead; this route remains for small files and scripts.
const ALLOWED_FORM_FIELDS = new Set(["savingCardId", "evidenceType", "files"]);
const MAX_FILES_PER_UPLOAD = 10;

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

    const savingCardIdResult = savingCardIdSchema.safeParse(
      savingCardIdValues[0]
    );

    if (!savingCardIdResult.success) {
      return errorResponse(
        savingCardIdResult.error.issues[0]?.message ?? "Saving card id is invalid.",
        422
      );
    }

    const savingCardId = savingCardIdResult.data;
    const evidenceTypeResult = evidenceTypeSchema.safeParse(
      formData.get("evidenceType") ?? EvidenceType.OTHER
    );

    if (!evidenceTypeResult.success) {
      return errorResponse("Evidence type is invalid.", 422);
    }
    const evidenceType = evidenceTypeResult.data;

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
          evidenceType,
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
          evidenceType: true,
          uploadedAt: true,
        },
      });

      await writeAuditEvent(prisma, {
        organizationId: savingCard.organizationId,
        actorUserId: user.id,
        savingCardId: savingCard.id,
        targetEntityId: evidence.id,
        eventType: auditEventTypes.EVIDENCE_UPLOADED,
        detail: `Evidence uploaded: ${stored.fileName}`,
        payload: {
          evidenceType,
          fileName: stored.fileName,
          fileSize: stored.fileSize,
          fileType: stored.fileType,
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
