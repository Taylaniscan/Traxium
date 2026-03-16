import crypto from "node:crypto";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  MAX_EVIDENCE_FILE_SIZE,
  isAllowedEvidenceFileName,
} from "@/lib/evidence-config";

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase storage environment variables are missing.");
  }

  try {
    new URL(supabaseUrl);
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is invalid.");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

function getBucketName() {
  return process.env.SUPABASE_STORAGE_BUCKET?.trim() || "evidence-private";
}

function sanitizeBaseName(fileName: string, extension: string) {
  return path
    .basename(fileName, extension)
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function storeEvidenceFile(
  file: File,
  savingCardId: string,
  uploadedById: string,
) {
  if (!isAllowedEvidenceFileName(file.name)) {
    throw new Error("Unsupported file type. Upload PDF, Office, or image files only.");
  }

  if (file.size > MAX_EVIDENCE_FILE_SIZE) {
    throw new Error("File exceeds 25 MB. Please upload a smaller file.");
  }

  const bucketName = getBucketName();
  const extension = path.extname(file.name).toLowerCase();
  const safeBaseName = sanitizeBaseName(file.name, extension);
  const uniqueName = `${safeBaseName || "evidence"}-${crypto.randomUUID()}${extension}`;

  // Tenant yokken geçici path standardı
  const storagePath = `users/${uploadedById}/saving-cards/${savingCardId}/${uniqueName}`;

  const bytes = Buffer.from(await file.arrayBuffer());
  const supabase = getSupabaseAdminClient();

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
  expiresInSeconds = 60,
) {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase.storage
    .from(storageBucket)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(`Could not create signed URL: ${error?.message || "Unknown error"}`);
  }

  return data.signedUrl;
}