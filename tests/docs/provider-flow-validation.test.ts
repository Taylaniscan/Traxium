import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function readProjectFile(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("provider flow validation docs", () => {
  it("documents the master provider-flow release checklist", () => {
    const docs = readProjectFile("docs/provider-flow-validation.md");

    for (const requiredText of [
      "Provider Flow Matrix",
      "Preview / staging",
      "Production smoke",
      "Invite email",
      "Password reset",
      "Stripe Checkout",
      "Stripe Billing Portal",
      "Stripe webhook",
      "Evidence upload",
      "Evidence signed download",
      "Import",
      "Export",
      "Worker health",
      "npm run stripe:validate",
      "npm run supabase:validate",
      "npm run jobs:worker:healthcheck",
      "Proof Log Template",
      "Hard Blockers",
      "Do not claim pass unless proof exists",
    ]) {
      expect(docs).toContain(requiredText);
    }

    expect(docs).not.toContain("TODO");
    expect(docs).not.toContain("TBD");
  });
});
