import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const LoginFormMock = vi.hoisted(() => vi.fn(() => null));
const getWorkspaceOnboardingStateMock = vi.hoisted(() => vi.fn());

vi.mock("@/components/auth/login-form", () => ({
  LoginForm: LoginFormMock,
}));

vi.mock("@/lib/auth", () => ({
  getWorkspaceOnboardingState: getWorkspaceOnboardingStateMock,
}));

(globalThis as typeof globalThis & { React: typeof React }).React = React;

import LoginPage from "@/app/login/page";

describe("login page auth routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getWorkspaceOnboardingStateMock.mockResolvedValue({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authenticated session is required.",
    });
  });

  it("renders the login form", async () => {
    const page = await LoginPage({
      searchParams: Promise.resolve({}),
    });

    expect(page).toMatchObject({
      type: LoginFormMock,
    });
  });
});
