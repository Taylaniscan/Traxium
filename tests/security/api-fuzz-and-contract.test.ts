import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function readProjectFile(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("API fuzz and runtime contract coverage", () => {
  it("keeps runtime probes for auth, malformed JSON, invalid IDs, enums, traversal, and methods", () => {
    const suite = readProjectFile("tests/e2e/api-fuzz-runtime.spec.ts");

    for (const requiredProbe of [
      "malformed JSON",
      "unexpectedField",
      'method: "PUT"',
      "/api/saving-cards",
      "/api/admin/settings",
      "/api/upload/evidence",
      "/api/evidence/not-a-valid-id/download",
      "/api/phase-change-request",
      "%2F..%2F",
    ]) {
      expect(suite).toContain(requiredProbe);
    }
  });

  it("keeps the hardening matrix aligned with every runtime-fuzzed API family", () => {
    const matrix = readProjectFile("docs/api-hardening-matrix.md");

    for (const route of [
      "/api/saving-cards",
      "/api/admin/settings",
      "/api/upload/evidence",
      "/api/evidence/[id]/download",
      "/api/phase-change-request",
      "/api/pilot-leads",
    ]) {
      expect(matrix).toContain(route);
    }
  });
});
