import { UsageFeature } from "@prisma/client";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { createAuthGuardErrorResponse, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createRateLimitErrorResponse,
  enforceRateLimit,
  RateLimitExceededError,
} from "@/lib/rate-limit";
import { enforceUsageQuota, UsageQuotaExceededError } from "@/lib/usage";
import { createEvidenceUploadTarget } from "@/lib/uploads";

import {
  buildSavingCardAccessWhere,
  EVIDENCE_UPLOAD_QUOTA_WINDOW,
  evidenceErrorResponse,
  getFileValidationError,
  savingCardIdSchema,
} from "../shared";

const signRequestSchema = z
  .object({
    savingCardId: savingCardIdSchema,
    fileName: z.string().max(255, "File name is too long."),
    fileSize: z.number().int(),
    fileType: z.string().max(255).default(""),
  })
  .strict();

/**
 * Step 1 of the browser evidence upload: authorize the upload and return a
 * one-time signed URL for a server-chosen path in the private bucket. Step 2
 * (./complete) verifies the stored object and creates the evidence record.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser({ redirectTo: null });
    await enforceRateLimit({
      policy: "evidenceUpload",
      request,
      userId: user.id,
      organizationId: user.organizationId,
      action: "evidence.upload.sign",
    });

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return evidenceErrorResponse("Request body must be valid JSON.", 400);
    }

    const payload = signRequestSchema.parse(body);
    const fileError = getFileValidationError({
      name: payload.fileName,
      size: payload.fileSize,
      type: payload.fileType,
    });

    if (fileError) {
      return evidenceErrorResponse(fileError, 422);
    }

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

    await enforceUsageQuota({
      organizationId: savingCard.organizationId,
      feature: UsageFeature.EVIDENCE_UPLOADS,
      window: EVIDENCE_UPLOAD_QUOTA_WINDOW,
      requestedQuantity: 1,
      message:
        "This upload would exceed the evidence upload quota for the current period.",
    });

    const target = await createEvidenceUploadTarget(
      { name: payload.fileName.trim(), size: payload.fileSize },
      {
        organizationId: savingCard.organizationId,
        savingCardId: savingCard.id,
      }
    );

    return NextResponse.json(
      {
        success: true,
        upload: target,
      },
      { status: 201 }
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
      return evidenceErrorResponse(error.message, error.status);
    }

    if (error instanceof ZodError) {
      return evidenceErrorResponse(
        error.issues[0]?.message ?? "Upload request is invalid.",
        422
      );
    }

    return evidenceErrorResponse(
      error instanceof Error ? error.message : "Upload could not be prepared.",
      500
    );
  }
}
