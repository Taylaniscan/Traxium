import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PrivacyPolicyPage, { metadata } from "@/app/privacy/page";
import {
  LEGAL_COMPANY_NAME,
  PRIVACY_CONTACT_EMAIL,
  PRIVACY_POLICY_EFFECTIVE_DATE,
} from "@/lib/legal";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

describe("public privacy policy page", () => {
  it("identifies the controller, contact, and effective date", () => {
    const markup = renderToStaticMarkup(React.createElement(PrivacyPolicyPage));

    expect(markup).toContain(LEGAL_COMPANY_NAME);
    expect(markup).toContain(`href="mailto:${PRIVACY_CONTACT_EMAIL}"`);
    expect(markup).toContain(`Effective ${PRIVACY_POLICY_EFFECTIVE_DATE}`);
  });

  it("covers the required disclosures", () => {
    const markup = renderToStaticMarkup(React.createElement(PrivacyPolicyPage));

    for (const requiredText of [
      "Who we are",
      "controller",
      "processor",
      "Information we collect",
      "legal bases",
      "Cookies and browser storage",
      "Service providers",
      "Vercel",
      "Supabase",
      "Stripe",
      "Resend",
      "Sentry",
      "International transfers",
      "How long we keep information",
      "within 24 months",
      "within 90 days",
      "Your rights",
      "data protection authority",
      "data processing agreement",
      "Changes to this policy",
    ]) {
      expect(markup).toContain(requiredText);
    }

    expect(markup).not.toContain("we sell");
  });

  it("uses privacy-specific public metadata", () => {
    expect(metadata.title).toBe("Privacy Policy | Traxium");
  });
});
