import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("paid-pilot support expectations", () => {
  it("defines realistic scope, targets, responsibilities, and exclusions", () => {
    const docs = fs.readFileSync(
      path.join(process.cwd(), "docs/support-expectations.md"),
      "utf8"
    );

    for (const requiredText of [
      "## Support Scope",
      "## Support Hours",
      "## Response Targets",
      "## Critical Issues",
      "## Normal Issues",
      "## Customer Responsibilities",
      "## Provider Outages",
      "## Escalation Path",
      "best-effort same-business-day attention",
      "within one business day",
      "does not provide 24/7 support",
    ]) {
      expect(docs).toContain(requiredText);
    }

    expect(docs).not.toContain("Traxium guarantees an enterprise SLA");
  });
});
