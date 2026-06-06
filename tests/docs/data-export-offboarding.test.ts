import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("data export and offboarding", () => {
  it("documents standard export, evidence limits, and manual deletion handling", () => {
    const docs = fs.readFileSync(
      path.join(process.cwd(), "docs/data-export-offboarding.md"),
      "utf8"
    );

    for (const requiredText of [
      "## What Can Be Exported From Traxium",
      "controller-review XLSX workbook",
      "## Saving-Card Export",
      "## Evidence Export Limitations",
      "no automated full evidence archive download",
      "## Audit And History Export Limitations",
      "## Manual Offboarding Support",
      "## Data Deletion Request Handling",
      "does not currently expose self-service permanent workspace deletion",
      "## What Is Not Automated Yet",
      "## No Legal Or Compliance Overclaim",
    ]) {
      expect(docs).toContain(requiredText);
    }

    expect(docs).not.toContain("automated full workspace archive is available");
  });
});
