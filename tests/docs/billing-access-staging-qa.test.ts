import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function readProjectFile(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("billing access staging QA guide", () => {
  it("documents the required manual QA matrix scenarios", () => {
    const guide = readProjectFile("docs/billing-access-staging-qa.md");

    expect(guide).toContain("## Manual QA Matrix");
    expect(guide).toContain("Active org admin");
    expect(guide).toContain("Active org member");
    expect(guide).toContain("Canceled org admin");
    expect(guide).toContain("Canceled org member");
    expect(guide).toContain("Unpaid org admin");
    expect(guide).toContain("Past-due org admin");
    expect(guide).toContain("No-subscription org admin");
    expect(guide).toContain("Cross-tenant user with one active org and one blocked org");
    expect(guide).toContain("Blocked org using protected API");
    expect(guide).toContain("Blocked org using allowed recovery route");
    expect(guide).toContain("Staging / test-key environment");
    expect(guide).toContain("Production / live-key predeploy environment");
  });

  it("includes actionable staging checklist steps with exact billing routes and APIs", () => {
    const guide = readProjectFile("docs/billing-access-staging-qa.md");

    expect(guide).toContain("## Staging Checklist");
    expect(guide).toContain("/dashboard");
    expect(guide).toContain("/billing-required");
    expect(guide).toContain("/settings/billing");
    expect(guide).toContain("/api/auth/bootstrap");
    expect(guide).toContain("/api/command-center");
    expect(guide).toContain("/api/billing/checkout");
    expect(guide).toContain("/api/billing/portal");
    expect(guide).toContain("/api/organizations/switch");
    expect(guide).toContain("Failure meaning");
    expect(guide).toContain("/forgot-password");
    expect(guide).toContain("/reset-password");
    expect(guide).toContain("must not hit a redirect loop");
  });

  it("separates automated, simulated, and manual coverage for release QA", () => {
    const guide = readProjectFile("docs/billing-access-staging-qa.md");
    const releaseChecklist = readProjectFile("docs/release-checklist.md");

    expect(guide).toContain("Automated");
    expect(guide).toContain("Simulated");
    expect(guide).toContain("Manual / staging required");
    expect(guide).toContain("This runbook validates the billing/access recommendation set itself.");
    expect(releaseChecklist).toContain("billing-access-staging-qa.md");
    expect(guide).not.toContain("TODO");
    expect(guide).not.toContain("TBD");
  });
});
