import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function readProjectFile(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("paid pilot buyer package", () => {
  it("defines the buyer promise, pilot offer, demo path, trust needs, support, and export boundaries", () => {
    const packageDoc = readProjectFile("docs/paid-pilot-buyer-package.md");

    for (const heading of [
      "## Landing Page Promise",
      "## Paid Pilot Offer",
      "## Demo Script",
      "## Security And Trust Page Needs",
      "## Support Expectations",
      "## Data Export Expectations",
      "## First-Pilot Exclusions",
    ]) {
      expect(packageDoc).toContain(heading);
    }

    expect(packageDoc).toContain("50-500 employee US manufacturing SME");
    expect(packageDoc).toContain("one manufacturing workspace");
    expect(packageDoc).toContain("XLSX export");
    expect(packageDoc).toContain("private evidence storage");
    expect(packageDoc).toContain("Do not claim SOC 2 certification");
    expect(packageDoc).toContain("SSO/SAML");
    expect(packageDoc).toContain("ERP or MRP connectors");
    expect(packageDoc).toContain("24/7 support");
    expect(packageDoc).not.toContain("TODO");
    expect(packageDoc).not.toContain("TBD");
  });

  it("links README and the UtopiaTrax demo script to the package", () => {
    const readme = readProjectFile("README.md");
    const demo = readProjectFile("docs/demo-utopiatrax.md");

    expect(readme).toContain("Paid Pilot Buyer Package");
    expect(readme).toContain("paid-pilot-buyer-package.md");
    expect(readme).toContain("paid-pilot-offer-and-pricing.md");
    expect(readProjectFile("docs/paid-pilot-buyer-package.md")).toContain(
      "paid-pilot-offer-and-pricing.md"
    );
    expect(demo).toContain("## Paid Pilot Demo Flow");
    expect(demo).toContain("paid-pilot-buyer-package.md");
    expect(demo).toContain("Category Owner / Member");
    expect(demo).not.toContain("Global Category Leader / Member");
  });
});
