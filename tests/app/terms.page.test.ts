import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import TermsOfServicePage, { metadata } from "@/app/terms/page";
import {
  LEGAL_COMPANY_NAME,
  PRIVACY_CONTACT_EMAIL,
  TERMS_OF_SERVICE_EFFECTIVE_DATE,
} from "@/lib/legal";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

describe("public terms of service page", () => {
  it("identifies the provider, contact, and effective date", () => {
    const markup = renderToStaticMarkup(React.createElement(TermsOfServicePage));

    expect(markup).toContain(LEGAL_COMPANY_NAME);
    expect(markup).toContain(`href="mailto:${PRIVACY_CONTACT_EMAIL}"`);
    expect(markup).toContain(`Effective ${TERMS_OF_SERVICE_EFFECTIVE_DATE}`);
  });

  it("states the agreed commercial and legal choices", () => {
    const markup = renderToStaticMarkup(React.createElement(TermsOfServicePage));

    for (const requiredText of [
      "businesses only",
      "the Order prevails",
      "renew automatically until canceled",
      "Cancellation takes effect at the end of the current billing period",
      "not refunded",
      "in the 12 months before the event",
      "intent or deliberate recklessness",
      "the laws of the Netherlands",
      "International Sale of Goods does not apply",
      "Amsterdam, the Netherlands",
      "within 90 days",
      "not financial, accounting, tax, or legal",
      "do not guarantee",
      "href=\"/privacy\"",
    ]) {
      expect(markup).toContain(requiredText);
    }

    expect(markup).not.toContain("guaranteed savings");
  });

  it("uses terms-specific public metadata", () => {
    expect(metadata.title).toBe("Terms of Service | Traxium");
  });
});
