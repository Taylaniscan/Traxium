import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function readProjectFile(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("subscription gating documentation", () => {
  it("documents the organization access mapping and source-of-truth files", () => {
    const guide = readProjectFile("docs/subscription-gating-and-billing-recovery.md");

    expect(guide).toContain("How Access Is Determined");
    expect(guide).toContain("grace_period");
    expect(guide).toContain("blocked_past_due");
    expect(guide).toContain("blocked_unpaid");
    expect(guide).toContain("blocked_canceled");
    expect(guide).toContain("no_subscription");
    expect(guide).toContain("Unexpected / unsupported status");
    expect(guide).toContain("fail closed");
    expect(guide).toContain("lib/billing/access.ts");
    expect(guide).toContain("lib/auth.ts");
  });

  it("lists blocked product routes and the recovery routes that stay reachable", () => {
    const guide = readProjectFile("docs/subscription-gating-and-billing-recovery.md");

    expect(guide).toContain("/dashboard");
    expect(guide).toContain("/saving-cards");
    expect(guide).toContain("/admin/*");
    expect(guide).toContain("/billing-required");
    expect(guide).toContain("/billing/recover");
    expect(guide).toContain("/settings/billing");
    expect(guide).toContain("/api/billing/checkout");
    expect(guide).toContain("/api/billing/portal");
    expect(guide).toContain("/api/auth/bootstrap");
  });

  it("documents role-specific recovery UX and production Stripe safety rails without placeholders", () => {
    const guide = readProjectFile("docs/subscription-gating-and-billing-recovery.md");

    expect(guide).toContain("Owners and admins see recovery actions");
    expect(guide).toContain("Members see a limited explanation");
    expect(guide).toContain("sk_live_");
    expect(guide).toContain("pk_live_");
    expect(guide).toContain("npm run env:check");
    expect(guide).toContain("npm run predeploy");
    expect(guide).toContain("npm run build");
    expect(guide).not.toContain("TODO");
    expect(guide).not.toContain("TBD");
    expect(guide).not.toContain("Unknown");
  });
});
