import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function readProjectFile(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("US terminology contract", () => {
  it("documents customer-facing phase and role labels without requiring enum migration", () => {
    const contract = readProjectFile("docs/us-terminology-contract.md");

    expect(contract).toContain("Customer-Facing Phase Labels");
    expect(contract).toContain("Proposed");
    expect(contract).toContain("Finance Validated");
    expect(contract).toContain("Implemented");
    expect(contract).toContain("Captured");
    expect(contract).toContain("Canceled");
    expect(contract).toContain("Procurement Lead");
    expect(contract).toContain("Finance Reviewer");
    expect(contract).toContain("No database enum migration is required");
    expect(contract).toContain("presentation-layer mappings");
  });
});
