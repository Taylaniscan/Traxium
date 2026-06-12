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

  it("renders the paid-pilot buyer package for unauthenticated visitors", async () => {
    getWorkspaceOnboardingStateMock.mockResolvedValueOnce({
      ok: false,
      code: "AUTH_REQUIRED",
      message: "Sign in required.",
    });

    const page = await HomePage();
    const markup = renderToStaticMarkup(page as React.ReactElement);

    expect(markup).toContain("Stop defending your savings numbers.");
    expect(markup).toContain(
      "Track procurement savings with finance approval, evidence, and an"
    );
    expect(markup).toContain(
      "Paid pilot package for 50-500 employee US manufacturing SMEs"
    );
    expect(markup).toContain("US manufacturing SME pilot portfolio");
    expect(markup).toContain("One paid-pilot workspace");
    expect(markup).toContain("Finance-reviewed workflow");
    expect(markup).toContain("Private evidence trail");
    expect(markup).toContain("Controller-ready export");
    expect(markup).toContain("In-Year Value");
    expect(markup).toContain("Annualized Run-Rate");
    expect(markup).toContain("Finance locked");
    expect(markup).toContain(">5</p>");
    expect(markup).toContain("No SSO/SAML, ERP connector");
    // Internal module names must not leak into marketing copy.
    expect(markup).not.toContain("Command Center");
    expect(markup).not.toContain("Kanban");
    expect(markup).not.toContain("Timeline");
    expect(markup).toContain("href=\"/login\"");
    expect(markup).toContain("Trust &amp; security");
    expect(markup).toContain("href=\"/trust\"");
    expect(markup).toContain("Request paid pilot");
    expect(markup).toContain("href=\"/pilot\"");
    expect(markup).toContain("See UtopiaTrax demo");
    expect(markup).toContain("href=\"/pilot#demo-preview\"");
    expect(markup).not.toContain("Start free trial");
    expect(markup).not.toContain("href=\"/dashboard\"");
    expect(redirectMock).not.toHaveBeenCalled();
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
