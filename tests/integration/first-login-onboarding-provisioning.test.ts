import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

import { createSessionUser } from "../helpers/security-fixtures";

const redirectMock = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  })
);

const getWorkspaceOnboardingStateMock = vi.hoisted(() => vi.fn());
const bootstrapCurrentUserMock = vi.hoisted(() => vi.fn());
const workspaceOnboardingFormMock = vi.hoisted(() =>
  vi.fn(({ userName }: { userName: string }) =>
    React.createElement("div", { "data-onboarding-form": userName }, `onboarding:${userName}`)
  )
);
const appShellMock = vi.hoisted(() =>
  vi.fn(({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-shell": "app" }, children)
  )
);

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/auth", () => ({
  getWorkspaceOnboardingState: getWorkspaceOnboardingStateMock,
  bootstrapCurrentUser: bootstrapCurrentUserMock,
}));

vi.mock("@/components/onboarding/workspace-onboarding-form", () => ({
  WorkspaceOnboardingForm: workspaceOnboardingFormMock,
}));

vi.mock("@/components/layout/app-shell", () => ({
  AppShell: appShellMock,
}));

import AppLayout from "@/app/(app)/layout";
import HomePage from "@/app/page";
import LoginPage from "@/app/login/page";
import OnboardingPage from "@/app/onboarding/page";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

describe("first-login onboarding provisioning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects a new authenticated user to onboarding instead of showing a provisioning error", async () => {
    getWorkspaceOnboardingStateMock.mockResolvedValueOnce({
      ok: true,
      needsWorkspace: true,
      user: {
        id: "auth-user-1",
        name: "New User",
        email: "new.user@example.com",
      },
    });

    await expect(HomePage()).rejects.toThrow("NEXT_REDIRECT:/onboarding");
  });

  it("redirects a provisioned user without memberships to onboarding from protected app routes", async () => {
    bootstrapCurrentUserMock.mockResolvedValueOnce({
      ok: false,
      code: "ORGANIZATION_ACCESS_REQUIRED",
      message: "Your account is not an active member of any Traxium organization.",
    });

    await expect(
      AppLayout({
        children: React.createElement("div", null, "protected"),
      })
    ).rejects.toThrow("NEXT_REDIRECT:/onboarding");
  });

  it("redirects a billing-blocked workspace to the billing-required page from protected app routes", async () => {
    bootstrapCurrentUserMock.mockResolvedValueOnce({
      ok: false,
      code: "BILLING_REQUIRED",
      message:
        "Your workspace subscription is unpaid. Resolve billing before product access can continue.",
      accessState: {
        accessState: "blocked_unpaid",
        reasonCode: "unpaid",
      },
    });

    await expect(
      AppLayout({
        children: React.createElement("div", null, "protected"),
      })
    ).rejects.toThrow("NEXT_REDIRECT:/billing-required");
  });

  it("renders the login page without a premature server-side redirect for an authenticated membership user", () => {
    const page = LoginPage();

    expect(page).toBeTruthy();
  });

  it("renders the onboarding form for a first-login user without creating a redirect loop", async () => {
    getWorkspaceOnboardingStateMock.mockResolvedValueOnce({
      ok: true,
      needsWorkspace: true,
      user: {
        id: "auth-user-1",
        name: "New User",
        email: "new.user@example.com",
      },
    });

    const page = await OnboardingPage();
    const markup = renderToStaticMarkup(page as React.ReactElement);

    expect(markup).toContain("onboarding:New User");
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("allows a membership user through the protected app layout", async () => {
    bootstrapCurrentUserMock.mockResolvedValueOnce({
      ok: true,
      repaired: false,
      user: createSessionUser({
        role: Role.GLOBAL_CATEGORY_LEADER,
      }),
    });

    const layout = await AppLayout({
      children: React.createElement("section", null, "dashboard-ready"),
    });
    const markup = renderToStaticMarkup(layout as React.ReactElement);

    expect(appShellMock).toHaveBeenCalledTimes(1);
    expect(markup).toContain("dashboard-ready");
  });

  it("allows an active admin workspace through the protected app layout", async () => {
    bootstrapCurrentUserMock.mockResolvedValueOnce({
      ok: true,
      repaired: false,
      user: createSessionUser({
        role: Role.HEAD_OF_GLOBAL_PROCUREMENT,
        activeOrganization: {
          membershipId: "membership-admin",
          organizationId: "org-1",
          membershipRole: "ADMIN",
          membershipStatus: "ACTIVE",
        },
      }),
    });

    const layout = await AppLayout({
      children: React.createElement("section", null, "admin-dashboard-ready"),
    });
    const markup = renderToStaticMarkup(layout as React.ReactElement);

    expect(appShellMock).toHaveBeenCalledTimes(1);
    expect(markup).toContain("admin-dashboard-ready");
  });
});
