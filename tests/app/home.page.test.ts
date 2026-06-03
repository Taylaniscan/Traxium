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

    expect(markup).toContain(
      "Finance-trusted savings governance for US manufacturing SMEs."
    );
    expect(markup).toContain(
      "Paid pilot package for 50-500 employee US manufacturing SMEs"
    );
    expect(markup).toContain("US manufacturing SME pilot portfolio");
    expect(markup).toContain("One paid-pilot workspace");
    expect(markup).toContain("Finance-reviewed workflow");
    expect(markup).toContain("Private evidence trail");
    expect(markup).toContain("Controller-ready export");
    expect(markup).toContain("Total cards");
    expect(markup).toContain("Finance locked");
    expect(markup).toContain(">25</p>");
    expect(markup).toContain(">5</p>");
    expect(markup).toContain("No SSO/SAML, ERP connector");
    expect(markup).toContain("href=\"/login\"");
    expect(markup).toContain("href=\"/dashboard\"");
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
