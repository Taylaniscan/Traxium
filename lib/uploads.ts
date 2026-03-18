import "server-only";

import crypto from "node:crypto";
import path from "node:path";
import {
  MAX_EVIDENCE_FILE_SIZE,
  isAllowedEvidenceFileName,
} from "@/lib/evidence-config";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const DEFAULT_EVIDENCE_BUCKET = "evidence-private";
const EVIDENCE_SIGNED_URL_TTL_SECONDS = 60;

type EvidenceStorageLocation = {
  storageBucket: string;
  storagePath: string;
  organizationId: string;
  savingCardId: string;
  uploadedById?: string | null;
  fileName?: string | null;
};

export class EvidenceStorageNotFoundError extends Error {}

function getEvidenceStorageBucketName() {
  return process.env.SUPABASE_STORAGE_BUCKET?.trim() || DEFAULT_EVIDENCE_BUCKET;
}

function sanitizePathSegment(value: string, fallback: string) {
  const normalized = value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || fallback;
}

function sanitizeBaseName(fileName: string, extension: string) {
  return path
    .basename(fileName, extension)
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildTenantEvidencePrefix(organizationId: string, savingCardId: string) {
  return `organizations/${sanitizePathSegment(organizationId, "org")}/saving-cards/${sanitizePathSegment(
    savingCardId,
    "card"
  )}/evidence`;
}

function normalizeStoragePath(storagePath: string) {
  return storagePath.trim().replace(/^\/+/, "");
}

export function isManagedEvidenceStorageLocation({
  storageBucket,
  storagePath,
  organizationId,
  savingCardId,
}: EvidenceStorageLocation) {
  if (storageBucket !== getEvidenceStorageBucketName()) {
    return false;
  }

  const normalizedStoragePath = normalizeStoragePath(storagePath);
  if (!normalizedStoragePath) {
    return false;
  }

  if (normalizedStoragePath.startsWith(`${buildTenantEvidencePrefix(organizationId, savingCardId)}/`)) {
    return true;
  }

  return false;
}

export async function storeEvidenceFile(
  file: File,
  context: {
    organizationId: string;
    savingCardId: string;
  },
) {
  if (!isAllowedEvidenceFileName(file.name)) {
    throw new Error("Unsupported file type. Upload PDF, Office, or image files only.");
  }

  if (file.size > MAX_EVIDENCE_FILE_SIZE) {
    throw new Error("File exceeds 25 MB. Please upload a smaller file.");
  }

  const bucketName = getEvidenceStorageBucketName();
  const extension = path.extname(file.name).toLowerCase();
  const safeBaseName = sanitizeBaseName(file.name, extension);
  const uniqueName = `${safeBaseName || "evidence"}-${crypto.randomUUID()}${extension}`;
  const storagePath = `${buildTenantEvidencePrefix(context.organizationId, context.savingCardId)}/${uniqueName}`;

  const bytes = Buffer.from(await file.arrayBuffer());
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase.storage.from(bucketName).upload(storagePath, bytes, {
    contentType: file.type || undefined,
    upsert: false,
    cacheControl: "3600",
  });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  return {
    fileName: file.name,
    storageBucket: bucketName,
    storagePath,
    fileSize: file.size,
    fileType: file.type || extension || "application/octet-stream",
  };
}

export async function createEvidenceSignedUrl(
  storageBucket: string,
  storagePath: string,
  expiresInSeconds = EVIDENCE_SIGNED_URL_TTL_SECONDS,
) {
  if (storageBucket !== getEvidenceStorageBucketName()) {
    throw new EvidenceStorageNotFoundError("Evidence storage bucket mismatch.");
  }

  const normalizedStoragePath = normalizeStoragePath(storagePath);
  if (!normalizedStoragePath) {
    throw new EvidenceStorageNotFoundError("Evidence storage path is invalid.");
  }

  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase.storage
    .from(storageBucket)
    .createSignedUrl(normalizedStoragePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    const message = error?.message || "Unknown error";

    if (/not found|not exist|missing/i.test(message)) {
      throw new EvidenceStorageNotFoundError("Evidence file not found.");
    }

    throw new Error(`Could not create signed URL: ${message}`);
  }

  return data.signedUrl;
}
