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

function sanitizeObjectNameSegment(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeStoragePath(storagePath: string) {
  return storagePath.trim().replace(/^\/+/, "").replace(/\/+$/, "");
}

function parseManagedEvidenceStoragePath(storagePath: string) {
  const normalizedStoragePath = normalizeStoragePath(storagePath);

  if (
    !normalizedStoragePath ||
    normalizedStoragePath.includes("\0") ||
    normalizedStoragePath.includes("\\") ||
    normalizedStoragePath.includes("//")
  ) {
    return null;
  }

  const segments = normalizedStoragePath.split("/");

  if (
    segments.length !== 6 ||
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    return null;
  }

  const [
    organizationsSegment,
    organizationSegment,
    savingCardsSegment,
    savingCardSegment,
    evidenceSegment,
    objectName,
  ] = segments;

  if (
    organizationsSegment !== "organizations" ||
    savingCardsSegment !== "saving-cards" ||
    evidenceSegment !== "evidence"
  ) {
    return null;
  }

  if (sanitizePathSegment(organizationSegment, "") !== organizationSegment) {
    return null;
  }

  if (sanitizePathSegment(savingCardSegment, "") !== savingCardSegment) {
    return null;
  }

  if (sanitizeObjectNameSegment(objectName) !== objectName) {
    return null;
  }

  return {
    normalizedStoragePath,
    organizationSegment,
    savingCardSegment,
  };
}

function isOwnedManagedEvidenceStorageLocation(location: EvidenceStorageLocation) {
  const parsedPath = parseManagedEvidenceStoragePath(location.storagePath);

  if (!parsedPath) {
    return false;
  }

  return (
    parsedPath.organizationSegment === sanitizePathSegment(location.organizationId, "org") &&
    parsedPath.savingCardSegment === sanitizePathSegment(location.savingCardId, "card")
  );
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

  return isOwnedManagedEvidenceStorageLocation({
    storageBucket,
    storagePath,
    organizationId,
    savingCardId,
  });
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

  const parsedPath = parseManagedEvidenceStoragePath(storagePath);
  if (!parsedPath) {
    throw new EvidenceStorageNotFoundError("Evidence storage path is invalid.");
  }

  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase.storage
    .from(storageBucket)
    .createSignedUrl(parsedPath.normalizedStoragePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    const message = error?.message || "Unknown error";

    if (/not found|not exist|missing/i.test(message)) {
      throw new EvidenceStorageNotFoundError("Evidence file not found.");
    }

    throw new Error(`Could not create signed URL: ${message}`);
  }

  return data.signedUrl;
}
