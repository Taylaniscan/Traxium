import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function readProjectFile(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("runtime baseline", () => {
  it("documents automated verification for the current hardening work", () => {
    const runtimeBaseline = readProjectFile("docs/runtime-baseline.md");

    expect(runtimeBaseline).toContain("| Distributed rate-limit policy behavior | Verified |");
    expect(runtimeBaseline).toContain("| HTTP security header contract | Verified |");
    expect(runtimeBaseline).toContain("tests/api/rate-limit.test.ts");
    expect(runtimeBaseline).toContain("tests/lib/rate-limit.test.ts");
    expect(runtimeBaseline).toContain("tests/config/http-security-headers.test.ts");
    expect(runtimeBaseline).toContain("tests/api/export.route.test.ts");
  });

  it("includes an operational note for the shared rate-limit backend and a manual deployed-header smoke step", () => {
    const runtimeBaseline = readProjectFile("docs/runtime-baseline.md");

    expect(runtimeBaseline).toContain("RateLimitBucket");
    expect(runtimeBaseline).toContain("Security headers");
    expect(runtimeBaseline).toContain("Content-Security-Policy");
    expect(runtimeBaseline).toContain("Strict-Transport-Security");
    expect(runtimeBaseline).toContain("/dashboard");
  });

  it("keeps smoke routes concrete and free from stale placeholders", () => {
    const runtimeBaseline = readProjectFile("docs/runtime-baseline.md");

    expect(runtimeBaseline).toContain("/forgot-password");
    expect(runtimeBaseline).toContain("/reset-password");
    expect(runtimeBaseline).toContain("/admin/members");
    expect(runtimeBaseline).toContain("/admin/settings");
    expect(runtimeBaseline).toContain("/admin/insights");
    expect(runtimeBaseline).toContain("/admin/jobs");
    expect(runtimeBaseline).not.toContain("TODO");
    expect(runtimeBaseline).not.toContain("Unknown");
    expect(runtimeBaseline).not.toContain("TBD");
  });

  it("does not leave already-automated flows marked as verified inside the manual smoke section", () => {
    const runtimeBaseline = readProjectFile("docs/runtime-baseline.md");
    const manualSmokeSection = runtimeBaseline.split("## Manual Smoke Checklist")[1];

    expect(manualSmokeSection).toBeTruthy();
    expect(manualSmokeSection).not.toContain("- Status: `Verified`");
  });
});
