import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function readRuntimeSuite() {
  return fs.readFileSync(
    path.join(process.cwd(), "tests/e2e/tenant-isolation-runtime.spec.ts"),
    "utf8"
  );
}

describe("tenant isolation attack suite coverage", () => {
  it("keeps explicit runtime attacks for cross-tenant reads, mutations, evidence, and exports", () => {
    const suite = readRuntimeSuite();

    for (const requiredAttack of [
      'page.request.get("/api/saving-cards")',
      "page.goto(`/saving-cards/${targetCard?.id}`)",
      "action: \"finance-lock\"",
      'page.request.post("/api/phase-change-request"',
      "`/api/evidence/${evidenceId}/download`",
      'page.request.get("/api/export")',
    ]) {
      expect(suite).toContain(requiredAttack);
    }
  });

  it("requires safe denials and contamination checks instead of success-only assertions", () => {
    const suite = readRuntimeSuite();

    expect(suite.match(/status\(\)\)\.toBe\(404\)/g)?.length).toBeGreaterThanOrEqual(
      3
    );
    expect(suite).toContain('not.toContain("storagePath")');
    expect(suite).toContain('not.toContain("storageBucket")');
    expect(suite).toContain('not.toContain("signedUrl")');
    expect(suite).toContain("not.toContain(targetCard?.title");
  });
});
