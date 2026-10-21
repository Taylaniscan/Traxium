// Spreadsheet imports are posted through app routes, and Vercel functions reject
// request bodies over 4.5 MB before the route runs. Keep the app limit below that
// so users get a clear message instead of a platform error. (Evidence files use
// signed direct-to-storage uploads and are not bound by this limit.)
export const MAX_SPREADSHEET_UPLOAD_BYTES = 4 * 1024 * 1024;

export const spreadsheetTooLargeMessage =
  "This file is larger than 4 MB. Split it into smaller files and import them one at a time.";

export function isSpreadsheetTooLarge(file: { size: number }) {
  return file.size > MAX_SPREADSHEET_UPLOAD_BYTES;
}

export function resolveUploadErrorMessage(
  status: number,
  serverError: string | null | undefined,
  fallback: string
) {
  if (serverError) {
    return serverError;
  }

  return status === 413 ? spreadsheetTooLargeMessage : fallback;
}
