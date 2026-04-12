import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useSearchParamsMock = vi.hoisted(() => vi.fn());
const createSupabaseBrowserClientMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useSearchParams: useSearchParamsMock,
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: createSupabaseBrowserClientMock,
}));

(globalThis as typeof globalThis & { React: typeof React }).React = React;

import ForgotPasswordLoadingPage from "@/app/forgot-password/loading";
import AdminMembersLoadingPage from "@/app/(app)/admin/members/loading";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

describe("auth recovery and loading UI", () => {
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
    createSupabaseBrowserClientMock.mockReturnValue({
      auth: {
        getUser: vi.fn(),
        onAuthStateChange: vi.fn(() => ({
          data: {
            subscription: {
              unsubscribe: vi.fn(),
            },
          },
        })),
      },
    });
  });

  it("renders the forgot-password form with a prefilled sign-in return link", () => {
    const markup = renderToStaticMarkup(React.createElement(ForgotPasswordForm));

    expect(markup).toContain("Reset your password");
    expect(markup).toContain("value=\"user@example.com\"");
    expect(markup).toContain("/login?email=user%40example.com");
    expect(markup).toContain("Send reset email");
  });

  it("renders a loading fallback for the forgot-password route", () => {
    const markup = renderToStaticMarkup(
      React.createElement(ForgotPasswordLoadingPage)
    );

    expect(markup).toContain("Reset your password");
    expect(markup).toContain("Preparing the secure password recovery flow");
  });

  it("renders the reset-password preparation state before the recovery session is ready", () => {
    const markup = renderToStaticMarkup(React.createElement(ResetPasswordForm));

    expect(markup).toContain("Preparing password reset");
    expect(markup).toContain("Verifying your secure recovery link");
  });

  it("renders the admin members loading skeleton", () => {
    const markup = renderToStaticMarkup(
      React.createElement(AdminMembersLoadingPage)
    );

    expect(markup).toContain("Members");
    expect(markup).toContain("Workspace Members");
    expect(markup).toContain("Pending Invitations");
  });
});
