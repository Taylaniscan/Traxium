import { describe, expect, it } from "vitest";

import {
  isSpreadsheetTooLarge,
  MAX_SPREADSHEET_UPLOAD_BYTES,
  resolveUploadErrorMessage,
  spreadsheetTooLargeMessage,
} from "@/lib/upload-limits";

describe("upload limits", () => {
  it("keeps the spreadsheet limit below Vercel's 4.5 MB function body limit", () => {
    expect(MAX_SPREADSHEET_UPLOAD_BYTES).toBeLessThan(4.5 * 1024 * 1024);
    expect(isSpreadsheetTooLarge({ size: MAX_SPREADSHEET_UPLOAD_BYTES })).toBe(false);
    expect(isSpreadsheetTooLarge({ size: MAX_SPREADSHEET_UPLOAD_BYTES + 1 })).toBe(true);
  });

  it("prefers the server's error and explains platform 413 responses", () => {
    expect(resolveUploadErrorMessage(422, "Bad header row.", "Import failed.")).toBe(
      "Bad header row."
    );
    expect(resolveUploadErrorMessage(413, null, "Import failed.")).toBe(
      spreadsheetTooLargeMessage
    );
    expect(resolveUploadErrorMessage(500, undefined, "Import failed.")).toBe(
      "Import failed."
    );
  });
});
