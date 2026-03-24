import { beforeEach, describe, expect, it, vi } from "vitest";
const LoginFormMock = vi.hoisted(() => vi.fn(() => null));

vi.mock("@/components/auth/login-form", () => ({
  LoginForm: LoginFormMock,
}));

import LoginPage from "@/app/login/page";

describe("login page auth routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the login form", () => {
    const page = LoginPage();

    expect(page).toMatchObject({
      type: LoginFormMock,
    });
  });
});
