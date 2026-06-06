import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function readProjectFile(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("paid-pilot trust pack", () => {
  it("answers the buyer trust questions with implemented controls and explicit limits", () => {
    const docs = readProjectFile("docs/trust-pack.md");

    for (const requiredText of [
      "## Workspace And Tenant Isolation",
      "## Roles And Permissions",
      "## Evidence Security",
      "private Supabase Storage bucket",
      "expire after 60 seconds",
      "## Billing And Payments",
      "Payment-card and bank-account details are not stored in Traxium",
      "## Import And Export Boundaries",
      "## Logging And Auditability",
      "## Provider Validation Status",
      "## Support Expectations For Paid Pilots",
      "## Data Export And Offboarding",
      "## Backup And Restore",
      "## Known Paid-Pilot Exclusions",
      "## Buyer Review Checklist",
      "SOC 2 certification",
      "ISO 27001 certification",
      "SSO/SAML",
      "ERP or MRP integrations",
      "24/7 support",
    ]) {
      expect(docs).toContain(requiredText);
    }

    expect(docs).toContain(
      "A complete preview provider-flow checklist has not been recorded."
    );
    expect(docs).toContain(
      "A production provider smoke pass has not been recorded."
    );
    expect(docs).not.toContain("Traxium is SOC 2 certified");
    expect(docs).not.toContain("Traxium provides 24/7 support");
    expect(docs).not.toContain("Traxium includes ERP integration");
  });
});
