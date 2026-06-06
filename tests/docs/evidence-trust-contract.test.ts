import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function readProjectFile(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("evidence trust contract", () => {
  it("documents the buyer-facing evidence and provider boundary", () => {
    const docs = readProjectFile("docs/evidence-trust-contract.md");

    for (const requiredText of [
      "private provider storage",
      "authenticated app download routes",
      "expire after 60 seconds",
      "active workspace membership",
      "Path traversal",
      "rate-limited",
      "quota-checked",
      "audit events",
      "Supabase provider settings also remained separate proof",
      "SOC 2 certification",
      "audited financial recognition",
      "npm run supabase:validate",
    ]) {
      expect(docs).toContain(requiredText);
    }
  });
});
