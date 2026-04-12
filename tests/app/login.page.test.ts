import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const LoginFormMock = vi.hoisted(() => vi.fn(() => null));

vi.mock("@/components/auth/login-form", () => ({
  LoginForm: LoginFormMock,
}));

(globalThis as typeof globalThis & { React: typeof React }).React = React;

import LoginPage from "@/app/login/page";

describe("login page auth routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the login form without making server-side redirect decisions", () => {
    const page = LoginPage();

    expect(page).toMatchObject({
      type: LoginFormMock,
    });
  });
});
