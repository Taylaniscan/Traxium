import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  })
);
const getWorkspaceOnboardingStateMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/auth", () => ({
  getWorkspaceOnboardingState: getWorkspaceOnboardingStateMock,
}));

import { metadata } from "@/app/layout";
import HomePage from "@/app/page";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

describe("home page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the paid-pilot buyer landing page for unauthenticated visitors", async () => {
    getWorkspaceOnboardingStateMock.mockResolvedValueOnce({
      ok: false,
      code: "AUTH_REQUIRED",
      message: "Sign in required.",
    });

    const page = await HomePage();
    const markup = renderToStaticMarkup(page as React.ReactElement);

    // Hero
    expect(markup).toContain("Stop defending your savings numbers.");
    expect(markup).toContain(
      "Track procurement savings with finance approval, evidence, and an audit trail"
    );
    expect(markup).toContain(
      "Finance-trusted savings governance for US manufacturing SMEs"
    );
    expect(markup).toContain("In-Year Value");
    expect(markup).toContain("Annualized Run-Rate");
    expect(markup).toContain("Finance Validated");
    expect(markup).toContain("Titanium dioxide dual-source award");

    // Workflow + features (real product capabilities)
    expect(markup).toContain("One governed savings lifecycle");
    expect(markup).toContain("Savings register with evidence");
    expect(markup).toContain("Approval workflow &amp; finance lock");
    expect(markup).toContain("Controller-ready XLSX export");
    expect(markup).toContain("actuals reconciliation");

    // Manufacturing ICP (matches the documented 50-500 figure)
    expect(markup).toContain("50–500 employee US manufacturers");
    expect(markup).toContain("Cost avoidance");

    // Honest trust section — non-claims must survive verbatim in spirit
    expect(markup).toContain("signed links expire after 60 seconds");
    expect(markup).toContain("No SOC 2 or ISO 27001 certification");
    expect(markup).toContain("No SSO/SAML, ERP connector");

    // Pilot offer
    expect(markup).toContain("30–45 day paid pilot");
    expect(markup).toContain("no public price");

    // Header / footer links and CTAs
    expect(markup).toContain('href="/pilot"');
    expect(markup).toContain("Request paid pilot");
    expect(markup).toContain('href="/trust"');
    expect(markup).toContain("Trust &amp; security");
    expect(markup).toContain('href="/login"');
    expect(markup).toContain('href="#how-it-works"');
    expect(markup).toContain("See how it works");

    // No fabricated funnels and no internal module names leaking into copy.
    expect(markup).not.toContain("Start free trial");
    expect(markup).not.toContain('href="/dashboard"');
    expect(markup).not.toContain("Command Center");
    expect(markup).not.toContain("Kanban");
    expect(markup).not.toContain("Timeline");
    // No fabricated social proof.
    expect(markup).not.toContain("Trusted by");
    expect(markup).not.toContain("SOC 2 certified");

    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redirects authenticated users with a workspace to the dashboard", async () => {
    getWorkspaceOnboardingStateMock.mockResolvedValueOnce({
      ok: true,
      needsWorkspace: false,
    });

    await expect(HomePage()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });

  it("redirects authenticated users without a workspace to onboarding", async () => {
    getWorkspaceOnboardingStateMock.mockResolvedValueOnce({
      ok: true,
      needsWorkspace: true,
    });

    await expect(HomePage()).rejects.toThrow("NEXT_REDIRECT:/onboarding");
    expect(redirectMock).toHaveBeenCalledWith("/onboarding");
  });

  it("keeps public metadata aligned with the US manufacturing pilot story", () => {
    expect(metadata.title).toBe("Traxium | Finance-Trusted Savings Governance");
    expect(metadata.description).toContain("US manufacturing SMEs");
    expect(metadata.description).toContain("paid-pilot workspace");
  });

  it("keeps the root route available for the public buyer page", () => {
    const nextConfig = fs.readFileSync(
      path.join(process.cwd(), "next.config.ts"),
      "utf8"
    );

    expect(nextConfig).not.toMatch(
      /source:\s*["']\/["'][\s\S]{0,180}destination:\s*["']\/dashboard["']/u
    );
  });
});
