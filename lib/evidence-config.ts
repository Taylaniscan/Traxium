export const MAX_EVIDENCE_FILE_SIZE = 25 * 1024 * 1024;
export const ALLOWED_EVIDENCE_EXTENSIONS = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".xls",
  ".xlsx",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx"
] as const;

export function isAllowedEvidenceFileName(fileName: string) {
  const extension = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  return ALLOWED_EVIDENCE_EXTENSIONS.includes(extension as (typeof ALLOWED_EVIDENCE_EXTENSIONS)[number]);
}

export function formatEvidenceFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
