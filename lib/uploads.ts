import crypto from "node:crypto";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

import {
  MAX_EVIDENCE_FILE_SIZE,
  isAllowedEvidenceFileName,
} from "@/lib/evidence-config";

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase storage environment variables are missing.");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

export async function storeEvidenceFile(file: File) {
  if (!isAllowedEvidenceFileName(file.name)) {
    throw new Error(
      "Unsupported file type. Upload PDF, Office, or image files only."
    );
  }

  if (file.size > MAX_EVIDENCE_FILE_SIZE) {
    throw new Error("File exceeds 25 MB. Please upload a smaller file.");
  }

  const bucketName = process.env.SUPABASE_STORAGE_BUCKET || "evidence";
  const extension = path.extname(file.name).toLowerCase();
  const safeBaseName = path
    .basename(file.name, extension)
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const uniqueName = `${safeBaseName || "evidence"}-${crypto.randomUUID()}${extension}`;
  const storagePath = `uploads/evidence/${uniqueName}`;

  const bytes = Buffer.from(await file.arrayBuffer());
  const supabase = getSupabaseAdminClient();

  const { error } = await supabase.storage
    .from(bucketName)
    .upload(storagePath, bytes, {
      contentType: file.type || undefined,
      upsert: false,
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucketName).getPublicUrl(storagePath);

  return {
    fileName: file.name,
    fileUrl: publicUrl,
    fileSize: file.size,
    fileType: file.type || extension,
  };
}