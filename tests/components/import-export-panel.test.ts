import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ImportExportPanel } from "@/components/reports/import-export-panel";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

describe("import export panel", () => {
  it("renders the master-data import format guidance for the default collection", () => {
    const markup = renderToStaticMarkup(
      React.createElement(ImportExportPanel, {
        readiness: null,
      })
    );

    expect(markup).toContain("Controller-Review Workbook");
    expect(markup).toContain("Controlled Workbook Import");
    expect(markup).toContain(
      "Traxium validates all rows before importing."
    );
    expect(markup).toContain(
      "If any row fails, no cards are created."
    );
    expect(markup).toContain(
      "Valid workbooks are committed in one database transaction."
    );
    expect(markup).toContain("Portfolio Summary");
    expect(markup).toContain("Data Dictionary");
    expect(markup).toContain("Import Template");
    expect(markup).toContain("Evidence Summary");
    expect(markup).toContain(
      "Private URLs, storage paths, tokens, and provider IDs are never exported."
    );
    expect(markup).toContain("does not provide ERP sync");
    expect(markup).toContain("Required fields:");
    expect(markup).toContain("Imported cards start as Proposed");
    expect(markup).toContain("Download Workbook With Import Template");
    expect(markup).toContain("Core Master Data Import");
    expect(markup).toContain(
      "Bulk-create buyers, suppliers, materials, or categories for this workspace from a structured CSV or `.xlsx` file."
    );
    expect(markup).toContain("Buyers file format");
    expect(markup).toContain("Exact headers:");
    expect(markup).toContain("Name | Email (optional)");
    expect(markup).toContain(
      "Duplicate names already present in this workspace, or repeated earlier in the same workbook, are skipped instead of overwritten."
    );
    expect(markup).toContain("Categories");
    expect(markup).toContain("Row results appear after upload");
    expect(markup).toContain("Import Master Data");
  });
});
