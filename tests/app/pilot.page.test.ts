import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PilotPage, { metadata } from "@/app/pilot/page";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

describe("public paid-pilot page", () => {
  it("renders a qualified manufacturing paid-pilot request path", () => {
    const markup = renderToStaticMarkup(React.createElement(PilotPage));

    expect(markup).toContain("Request a guided Traxium paid pilot");
    expect(markup).toContain("US manufacturing procurement and finance teams");
    expect(markup).toContain("Excel-based savings trackers");
    expect(markup).toContain("What happens in a pilot");
    expect(markup).toContain("Review your current savings tracker");
    expect(markup).toContain("Not ERP or MRP integration");
    expect(markup).toContain("Not accounting-system posting");
    expect(markup).toContain("Not a free trial");
    expect(markup).toContain("UtopiaTrax demo preview");
    expect(markup).toContain("Full name");
    expect(markup).toContain("Work email");
    expect(markup).toContain("Company name");
    expect(markup).toContain("Company size");
    expect(markup).toContain("Existing savings tracker?");
    expect(markup).toContain("Request paid pilot");
    expect(markup).toContain("Trust &amp; security");
    expect(markup).toContain("href=\"/trust\"");
    expect(markup).not.toContain("Start free trial");
  });

  it("keeps metadata aligned with a guided sales-led pilot", () => {
    expect(metadata.title).toBe("Request a Guided Paid Pilot | Traxium");
    expect(metadata.description).toContain("US manufacturing");
  });
});
