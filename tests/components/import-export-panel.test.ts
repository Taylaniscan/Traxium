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

    expect(markup).toContain("Controlled Workbook Import");
    expect(markup).toContain(
      "Saving-card workbook imports validate all rows before writing."
    );
    expect(markup).toContain(
      "If any row fails, no saving cards are created and row errors appear below"
    );
    expect(markup).toContain(
      "Exports are controller review workbooks."
    );
    expect(markup).toContain(
      "active savings, realized and achieved value, finance locks, phase counts"
    );
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
