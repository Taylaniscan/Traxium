import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import TrustPage, { metadata } from "@/app/trust/page";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

describe("public trust page", () => {
  it("renders buyer-readable controls, proof boundaries, support, and exclusions", () => {
    const markup = renderToStaticMarkup(React.createElement(TrustPage));

    for (const requiredText of [
      "Trust &amp; security for guided pilots",
      "Workspace isolation",
      "Roles and access",
      "Private evidence storage",
      "Signed downloads",
      "Stripe-managed billing",
      "Controlled import and export",
      "Audit and provider proof",
      "Support expectations",
      "Data and offboarding",
      "No SOC 2 or ISO 27001 certification claim",
      "No SSO/SAML or SCIM",
      "No ERP/MRP integration or accounting-system posting",
      "No 24/7 support or enterprise SLA",
      "href=\"/pilot\"",
    ]) {
      expect(markup).toContain(requiredText);
    }

    expect(markup).not.toContain("SOC 2 certified");
    expect(markup).not.toContain("24/7 support included");
  });

  it("uses trust-specific public metadata", () => {
    expect(metadata.title).toBe(
      "Trust & Security for Guided Pilots | Traxium"
    );
    expect(metadata.description).toContain("workspace isolation");
  });
});
