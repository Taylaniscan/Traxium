import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

import {
  LoginForm,
  resolveLoginFormQueryState,
} from "@/components/auth/login-form";
import {
  resolveLoginErrorMessage,
  resolvePostLoginPath,
} from "@/lib/auth-navigation";

describe("login form", () => {
  it("renders a server-side login form", () => {
    const markup = renderToStaticMarkup(React.createElement(LoginForm));

    expect(markup).toContain("action=\"/api/auth/login\"");
    expect(markup).toContain("method=\"post\"");
    expect(markup).toContain("Forgot password?");
    expect(markup).toContain("/forgot-password");
  });

  it("parses prefilled email, invite continuation, and login messages from the URL query string", () => {
    expect(
      resolveLoginFormQueryState(
        "?email=user%40example.com&next=%2Finvite%2Ftoken-123%3Fmode%3Daccept&message=invalid-credentials"
      )
    ).toEqual({
      email: "user@example.com",
      nextPath: "/invite/token-123?mode=accept",
      message: "invalid-credentials",
    });
  });

  it("routes successful and deferred bootstrap outcomes to the correct post-login path", () => {
    expect(
      resolvePostLoginPath({
        nextPath: null,
        bootstrapPayload: null,
        bootstrapSucceeded: true,
      })
    ).toBe("/dashboard");

    expect(
      resolvePostLoginPath({
        nextPath: "/invite/token-123?mode=accept",
        bootstrapPayload: {
          code: "ORGANIZATION_ACCESS_REQUIRED",
        },
        bootstrapSucceeded: false,
      })
    ).toBe("/onboarding");

    expect(
      resolvePostLoginPath({
        nextPath: null,
        bootstrapPayload: {
          code: "ORGANIZATION_ACCESS_REQUIRED",
        },
        bootstrapSucceeded: false,
      })
    ).toBe("/onboarding");

    expect(
      resolvePostLoginPath({
        nextPath: "/invite/token-123?mode=accept",
        bootstrapPayload: {
          code: "BILLING_REQUIRED",
          billingRequiredPath: "/billing-required",
        },
        bootstrapSucceeded: false,
      })
    ).toBe("/billing-required");

    expect(
      resolvePostLoginPath({
        nextPath: null,
        bootstrapPayload: {
          error: "Internal Server Error",
        },
        bootstrapSucceeded: false,
      })
    ).toBeNull();
  });

  it("shows controlled login errors after a server-side redirect back to /login", () => {
    expect(resolveLoginErrorMessage("invalid-credentials")).toBe(
      "Invalid email or password."
    );
    expect(resolveLoginErrorMessage("signin-retry")).toBe(
      "We couldn't sign you in. Please try again."
    );
  });
});
