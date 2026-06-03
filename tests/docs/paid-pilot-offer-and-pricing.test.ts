import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { stripePlanCatalogKeys } from "@/lib/billing/config";

function readProjectFile(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("paid pilot offer and pricing", () => {
  it("defines a concrete sales-led paid pilot without requiring unbuilt pricing complexity", () => {
    const offer = readProjectFile("docs/paid-pilot-offer-and-pricing.md");
    const buyerPackage = readProjectFile("docs/paid-pilot-buyer-package.md");
    const readme = readProjectFile("README.md");

    for (const heading of [
      "## Buyer Fit",
      "## Offer Shape",
      "## Success Criteria",
      "## Support Model",
      "## Pricing Hypothesis",
      "## Stripe Plan Relationship",
      "## Decision Path After Pilot",
    ]) {
      expect(offer).toContain(heading);
    }

    expect(offer).toContain("50-500 employee US manufacturing SME");
    expect(offer).toContain("30-45 days");
    expect(offer).toContain("One manufacturing workspace");
    expect(offer).toContain("one procurement owner, one finance reviewer, and one admin or security contact");
    expect(offer).toContain("At least one phase-change request is reviewed through the implemented approval flow");
    expect(offer).toContain("Business-hours support");
    expect(offer).toContain("Same-business-day attention");
    expect(offer).toContain("fixed pilot pricing");
    expect(offer).toContain("USD 4,500-7,500");
    expect(offer).toContain("USD 9,000-15,000");
    expect(offer).toContain("not a public pricing page");
    expect(offer).toContain("Do not publish seat, card, upload, API, or metered-usage limits");
    expect(offer).toContain("Stripe Product and base Price IDs");
    expect(offer).toContain("Metered Stripe Price IDs are optional");
    expect(offer).toContain("Keep the public homepage CTA as `Sign in` and `View product`");
    expect(offer).not.toContain("TODO");
    expect(offer).not.toContain("TBD");

    for (const planCode of stripePlanCatalogKeys) {
      expect(offer).toContain(`\`${planCode}\``);
    }

    expect(offer).toContain("Starter Pilot");
    expect(offer).toContain("Growth Pilot");
    expect(buyerPackage).toContain("paid-pilot-offer-and-pricing.md");
    expect(readme).toContain("paid-pilot-offer-and-pricing.md");
  });
});
