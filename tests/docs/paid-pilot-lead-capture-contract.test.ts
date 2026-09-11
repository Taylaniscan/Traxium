import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("paid-pilot lead-capture contract", () => {
  it("defines the buyer, qualification, handling, and no-overclaim boundaries", () => {
    const contract = fs.readFileSync(
      path.join(process.cwd(), "docs/paid-pilot-lead-capture-contract.md"),
      "utf8"
    );

    expect(contract).toContain("## Target Buyer");
    expect(contract).toContain("## Qualification Criteria");
    expect(contract).toContain("guided 30-45 day paid pilot");
    expect(contract).toContain("does not create an account");
    expect(contract).toContain("rate limit");
    expect(contract).toContain("honeypot");
    expect(contract).toContain("Store no raw IP address");
    expect(contract).toContain("Self-serve signup or workspace creation");
    expect(contract).toContain("ERP or MRP integration");
    expect(contract).toContain("Accounting posting");
    expect(contract).toContain("SOC 2 certification");
    expect(contract).toContain("24/7 support");
    expect(contract).toContain("Lead notification is not implemented");
  });
});
