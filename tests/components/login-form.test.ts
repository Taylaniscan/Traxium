import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useSearchParamsMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useSearchParams: useSearchParamsMock,
}));

(globalThis as typeof globalThis & { React: typeof React }).React = React;

import { LoginForm } from "@/components/auth/login-form";

describe("login form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSearchParamsMock.mockReturnValue({
      get(name: string) {
        if (name === "email") {
          return "user@example.com";
        }

        return null;
      },
    });
  });

  it("shows the forgot password link and preserves the current email as a prefill", () => {
    const markup = renderToStaticMarkup(React.createElement(LoginForm));

    expect(markup).toContain("Forgot password?");
    expect(markup).toContain("/forgot-password?email=user%40example.com");
    expect(markup).toContain("value=\"user@example.com\"");
  });
});
