import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("controller-ready import/export contract", () => {
  it("documents atomic import, workbook sheets, security boundaries, and exclusions", () => {
    const contractPath = path.join(
      process.cwd(),
      "docs/controller-ready-import-export-contract.md"
    );
    const contract = fs.readFileSync(contractPath, "utf8");

    expect(contract).toContain("one database transaction");
    expect(contract).toContain("row number, field, invalid value");
    expect(contract).toContain("Portfolio Summary");
    expect(contract).toContain("Saving Cards");
    expect(contract).toContain("Data Dictionary");
    expect(contract).toContain("Import Template");
    expect(contract).toContain("Evidence Summary");
    expect(contract).toContain("ERP or MRP synchronization");
    expect(contract).toContain("Accounting-system posting");
    expect(contract).toContain("Signed URLs");
    expect(contract).toContain("Supabase storage paths");
  });
});
