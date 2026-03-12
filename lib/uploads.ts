import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { MAX_EVIDENCE_FILE_SIZE, isAllowedEvidenceFileName } from "@/lib/evidence-config";

export async function storeEvidenceFile(file: File) {
  if (!isAllowedEvidenceFileName(file.name)) {
    throw new Error("Unsupported file type. Upload PDF, Office, or image files only.");
  }

  if (file.size > MAX_EVIDENCE_FILE_SIZE) {
    throw new Error("File exceeds 25 MB. Please upload a smaller file.");
  }

  const uploadDirectory = path.join(process.cwd(), "public", "uploads", "evidence");
  await mkdir(uploadDirectory, { recursive: true });

  const extension = path.extname(file.name);
  const safeBaseName = path
    .basename(file.name, extension)
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const uniqueName = `${safeBaseName || "evidence"}-${crypto.randomUUID()}${extension.toLowerCase()}`;
  const absolutePath = path.join(uploadDirectory, uniqueName);
  const bytes = Buffer.from(await file.arrayBuffer());

  await writeFile(absolutePath, bytes);

  return {
    fileName: file.name,
    fileUrl: `/uploads/evidence/${uniqueName}`,
    fileSize: file.size,
    fileType: file.type || extension.toLowerCase()
  };
}
