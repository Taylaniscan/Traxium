import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("backup and restore statement", () => {
  it("states provider assumptions and pilot-stage restore limitations", () => {
    const docs = fs.readFileSync(
      path.join(process.cwd(), "docs/backup-restore-statement.md"),
      "utf8"
    );

    for (const requiredText of [
      "## Current Backup Responsibility By Provider",
      "## Database Backup Assumptions",
      "## Supabase Storage Considerations",
      "## Restore Expectations",
      "## Pilot-Stage Limitations",
      "No formal recovery point objective (RPO) or recovery time objective (RTO)",
      "A database restore drill has not been recorded.",
      "An evidence-object restore drill has not been recorded.",
      "## Validation Required Before Broader Commercial Launch",
    ]) {
      expect(docs).toContain(requiredText);
    }

    expect(docs).not.toMatch(/\bRPO\s*[:=]\s*\d/iu);
    expect(docs).not.toMatch(/\bRTO\s*[:=]\s*\d/iu);
  });
});
