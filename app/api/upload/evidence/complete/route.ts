import path from "node:path";

import { UsageFeature } from "@prisma/client";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { createAuthGuardErrorResponse, requireUser } from "@/lib/auth";
import { auditEventTypes, writeAuditEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import {
  enforceUsageQuota,
  recordUsageEvent,
  UsageQuotaExceededError,
} from "@/lib/usage";
import {
  getEvidenceObjectInfo,
  isManagedEvidenceStorageLocation,
  removeEvidenceObject,
} from "@/lib/uploads";

import {
  buildSavingCardAccessWhere,
  EVIDENCE_UPLOAD_QUOTA_WINDOW,
  evidenceErrorResponse,
  evidenceTypeSchema,
  getFileValidationError,
  savingCardIdSchema,
} from "../shared";

const completeRequestSchema = z
  .object({
    savingCardId: savingCardIdSchema,
    evidenceType: evidenceTypeSchema,
    storageBucket: z.string().trim().min(1),
    storagePath: z.string().trim().min(1).max(1024),
    fileName: z.string().max(255, "File name is too long."),
  })
  .strict();

/**
 * Step 2 of the browser evidence upload. The browser has already sent the bytes
 * to the signed URL from ./sign; this route trusts only the stored object (its
 * real size and content type), never the client's description of it.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser({ redirectTo: null });

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return evidenceErrorResponse("Request body must be valid JSON.", 400);
    }

    const payload = completeRequestSchema.parse(body);
    const fileName = payload.fileName.trim();

    const savingCard = await prisma.savingCard.findFirst({
      where: buildSavingCardAccessWhere(user, payload.savingCardId),
      select: {
        id: true,
        organizationId: true,
      },
    });

    if (!savingCard) {
      return evidenceErrorResponse("Saving card not found.", 404);
    }

    const location = {
      storageBucket: payload.storageBucket,
      storagePath: payload.storagePath,
      organizationId: savingCard.organizationId,
      savingCardId: savingCard.id,
    };

    if (
      !isManagedEvidenceStorageLocation(location) ||
      path.extname(payload.storagePath).toLowerCase() !==
        path.extname(fileName).toLowerCase()
    ) {
      return evidenceErrorResponse("Upload location is invalid.", 422);
    }

    const existing = await prisma.savingCardEvidence.findFirst({
      where: {
        savingCardId: savingCard.id,
        storagePath: payload.storagePath,
      },
      select: { id: true },
    });

    if (existing) {
      return evidenceErrorResponse("This upload has already been recorded.", 409);
    }

    const stored = await getEvidenceObjectInfo(
      payload.storageBucket,
      payload.storagePath
    );

    if (!stored) {
      return evidenceErrorResponse(
        "The uploaded file was not found. Please upload it again.",
        422
      );
    }

    const fileType = stored.contentType ?? "";
    const fileError = getFileValidationError({
      name: fileName,
      size: stored.size,
      type: fileType,
    });

    if (fileError) {
      await removeEvidenceObject(payload.storageBucket, payload.storagePath);
      return evidenceErrorResponse(fileError, 422);
    }

    try {
      await enforceUsageQuota({
        organizationId: savingCard.organizationId,
        feature: UsageFeature.EVIDENCE_UPLOADS,
        window: EVIDENCE_UPLOAD_QUOTA_WINDOW,
        requestedQuantity: 1,
        message:
          "This upload would exceed the evidence upload quota for the current period.",
      });
    } catch (error) {
      if (error instanceof UsageQuotaExceededError) {
        await removeEvidenceObject(payload.storageBucket, payload.storagePath);
      }

      throw error;
    }

    const evidence = await prisma.savingCardEvidence.create({
      data: {
        savingCardId: savingCard.id,
        fileName,
        evidenceType: payload.evidenceType,
        storageBucket: payload.storageBucket,
        storagePath: payload.storagePath,
        fileSize: stored.size,
        fileType: fileType || path.extname(fileName).toLowerCase() || "application/octet-stream",
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
      detail: `Evidence uploaded: ${evidence.fileName}`,
      payload: {
        evidenceType: evidence.evidenceType,
        fileName: evidence.fileName,
        fileSize: evidence.fileSize,
        fileType: evidence.fileType,
      },
    });

    await recordUsageEvent({
      organizationId: savingCard.organizationId,
      feature: UsageFeature.EVIDENCE_UPLOADS,
      quantity: 1,
      window: EVIDENCE_UPLOAD_QUOTA_WINDOW,
      source: "api.evidence.upload",
      reason: "attachment_upload",
      metadata: {
        savingCardId: savingCard.id,
        uploadedByUserId: user.id,
        fileCount: 1,
      },
    });

    return NextResponse.json(
      {
        success: true,
        files: [
          {
            ...evidence,
            downloadUrl: `/api/evidence/${evidence.id}/download`,
          },
        ],
      },
      { status: 201 }
    );
  } catch (error) {
    const authResponse = createAuthGuardErrorResponse(error);

    if (authResponse) {
      return authResponse;
    }

    if (error instanceof UsageQuotaExceededError) {
      return evidenceErrorResponse(error.message, error.status);
    }

    if (error instanceof ZodError) {
      return evidenceErrorResponse(
        error.issues[0]?.message ?? "Upload request is invalid.",
        422
      );
    }

    return evidenceErrorResponse(
      error instanceof Error ? error.message : "Upload failed.",
      500
    );
  }
}
