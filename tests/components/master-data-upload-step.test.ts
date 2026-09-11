import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const useRouterMock = vi.hoisted(() => vi.fn());

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.ComponentProps<"a"> & { href: string }) =>
    React.createElement("a", { href, ...props }, children),
}));

vi.mock("next/navigation", () => ({
  useRouter: useRouterMock,
}));

(globalThis as typeof globalThis & { React: typeof React }).React = React;

import { MasterDataUploadStep } from "@/components/onboarding/master-data-upload-step";

describe("master data upload step", () => {
  useRouterMock.mockReturnValue({
    refresh: vi.fn(),
  });

  it("renders upload-first controls, field guidance, and result placeholder content", () => {
    const markup = renderToStaticMarkup(
      React.createElement(MasterDataUploadStep, {
        stepNumber: 2,
        entityKey: "buyers",
        status: "current",
        count: 0,
      })
    );

    expect(markup).toContain("Set up buyers");
    expect(markup).toContain("Upload file");
    expect(markup).toContain("Add manually");
    expect(markup).not.toContain('href="/saving-cards/new"');
    expect(markup).toContain("Download template");
    expect(markup).toContain("Field guide");
    expect(markup).toContain("Accepted file types");
    expect(markup).toContain("Required columns");
    expect(markup).toContain("Optional columns");
    expect(markup).toContain("Example row");
    expect(markup).toContain("CSV (.csv)");
    expect(markup).toContain("Excel workbook (.xlsx)");
    expect(markup).toContain("name, email, code, department");
    expect(markup).toContain("Taylor Buyer");
    expect(markup).toContain("Result summary");
    expect(markup).toContain("No upload has been processed yet.");
    expect(markup).toContain(
      "Choose a CSV or XLSX file to validate rows, create what is new, and see skipped or failed lines immediately."
    );
  });

  it("shows readiness-driven completion context when records already exist", () => {
    const markup = renderToStaticMarkup(
      React.createElement(MasterDataUploadStep, {
        stepNumber: 3,
        entityKey: "suppliers",
        status: "complete",
        count: 3,
      })
    );

    expect(markup).toContain("3 suppliers already configured.");
    expect(markup).toContain("contactEmail");
    expect(markup).toContain(
      "This step is already marked complete from live readiness."
    );
  });

  it("keeps unsupported onboarding upload steps honest", () => {
    const markup = renderToStaticMarkup(
      React.createElement(MasterDataUploadStep, {
        stepNumber: 4,
        entityKey: "plants",
        status: "pending",
        count: 0,
      })
    );

    expect(markup).toContain("Set up plants");
    expect(markup).toContain("Upload coming soon");
    expect(markup).toContain("region");
    expect(markup).toContain("Amsterdam Plant");
    expect(markup).toContain("Upload is not connected for this step yet.");
    expect(markup).toContain(
      "Template download is ready now. Upload processing for this step is not connected yet, so manual entry remains the live path."
    );
  });
});
