import { EvidenceType, Role, UsageWindow } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  MAX_EVIDENCE_FILE_SIZE,
  allowedEvidenceMimeTypes,
  evidenceTypes,
  isAllowedEvidenceFileName,
} from "@/lib/evidence-config";
import type { AuthenticatedUser } from "@/lib/types";

const GLOBAL_ACCESS_ROLES = new Set<Role>([
  Role.HEAD_OF_GLOBAL_PROCUREMENT,
  Role.GLOBAL_CATEGORY_LEADER,
  Role.FINANCIAL_CONTROLLER,
]);

export const EVIDENCE_UPLOAD_QUOTA_WINDOW = UsageWindow.MONTH;

export const savingCardIdSchema = z
  .string()
  .trim()
  .min(1, "Saving card id is required.")
  .refine((value) => !value.includes("/"), "Saving card id is invalid.");

export const evidenceTypeSchema = z
  .enum(evidenceTypes)
  .default(EvidenceType.OTHER);

export type EvidenceFileDescriptor = {
  name: string;
  size: number;
  type: string;
};

function hasGlobalAccess(role: Role) {
  return GLOBAL_ACCESS_ROLES.has(role);
}

export function buildSavingCardAccessWhere(
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

export function evidenceErrorResponse(error: string, status: number) {
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

export function getFileValidationError(file: EvidenceFileDescriptor) {
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
    const allowedTypes =
      allowedEvidenceMimeTypes[
        getFileExtension(fileName) as keyof typeof allowedEvidenceMimeTypes
      ];

    if (
      allowedTypes &&
      !allowedTypes.some((allowedType) => allowedType === normalizedType)
    ) {
      return "Uploaded file content type does not match the file extension.";
    }
  }

  return null;
}
