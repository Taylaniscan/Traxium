import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

import { EvidenceUploader } from "@/components/saving-cards/evidence-uploader";

describe("evidence uploader", () => {
  it("explains finance evidence, private storage, and optional business type", () => {
    const markup = renderToStaticMarkup(
      React.createElement(EvidenceUploader, {
        savingCardId: "card-1",
        files: [],
        onChange: vi.fn(),
        onError: vi.fn(),
      })
    );

    expect(markup).toContain("Finance validation evidence");
    expect(markup).toContain("Supplier Quote");
    expect(markup).toContain("Calculation Workbook");
    expect(markup).toContain("stored privately");
    expect(markup).toContain("short-lived signed links");
    expect(markup).toContain("does not guarantee audited savings");
    expect(markup).toContain("Evidence can be added after the card is saved");
    expect(markup).not.toContain("Google Drive");
  });

  it("shows typed evidence and signed-download trust metadata", () => {
    const markup = renderToStaticMarkup(
      React.createElement(EvidenceUploader, {
        savingCardId: "card-1",
        files: [
          {
            id: "evidence-1",
            fileName: "supplier-quote.pdf",
            downloadUrl: "/api/evidence/evidence-1/download",
            fileSize: 2048,
            fileType: "application/pdf",
            evidenceType: "SUPPLIER_QUOTE",
            status: "uploaded",
          },
        ],
        onChange: vi.fn(),
        onError: vi.fn(),
      })
    );

    expect(markup).toContain("supplier-quote.pdf");
    expect(markup).toContain("Supplier Quote");
    expect(markup).toContain("Private file · Signed download");
    expect(markup).toContain("/api/evidence/evidence-1/download");
  });
});
