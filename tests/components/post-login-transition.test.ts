import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children }: { children: unknown }) => children,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: unknown }) => children,
  CardContent: ({ children }: { children: unknown }) => children,
  CardDescription: ({ children }: { children: unknown }) => children,
  CardHeader: ({ children }: { children: unknown }) => children,
  CardTitle: ({ children }: { children: unknown }) => children,
}));

vi.mock("@/lib/analytics", () => ({
  trackSuccessfulLogin: vi.fn(),
}));

vi.mock("@/lib/observability", () => ({
  captureException: vi.fn(),
  trackClientEvent: vi.fn(),
}));

import {
  buildSuccessfulLoginAnalyticsInput,
  resolvePostLoginRedirectHref,
} from "@/components/auth/post-login-transition";

describe("post-login transition success path", () => {
  it("redirects a successful bootstrap response to /dashboard by default", () => {
    expect(
      resolvePostLoginRedirectHref({
        nextPath: null,
        loginHref: "/login?message=signin-retry",
        bootstrapResult: {
          status: 200,
          bootstrapSucceeded: true,
          bootstrapPayload: {
            user: {
              id: "user-1",
              role: "TACTICAL_BUYER",
              activeOrganization: {
                organizationId: "org-1",
                membershipRole: "MEMBER",
              },
            },
          },
          attempts: 1,
        },
      })
    ).toEqual({
      type: "redirect",
      href: "/dashboard",
    });
  });

  it("redirects a successful bootstrap response with a valid next path to that destination", () => {
    expect(
      resolvePostLoginRedirectHref({
        nextPath: "/invite/token-123?mode=accept",
        loginHref: "/login?message=signin-retry",
        bootstrapResult: {
          status: 200,
          bootstrapSucceeded: true,
          bootstrapPayload: {
            user: {
              id: "user-1",
              role: "TACTICAL_BUYER",
              activeOrganization: {
                organizationId: "org-1",
                membershipRole: "MEMBER",
              },
            },
          },
          attempts: 1,
        },
      })
    ).toEqual({
      type: "redirect",
      href: "/invite/token-123?mode=accept",
    });
  });

  it("redirects onboarding-required bootstrap payloads to /onboarding", () => {
    expect(
      resolvePostLoginRedirectHref({
        nextPath: null,
        loginHref: "/login?message=signin-retry",
        bootstrapResult: {
          status: 403,
          bootstrapSucceeded: false,
          bootstrapPayload: {
            code: "ORGANIZATION_ACCESS_REQUIRED",
            error: "Workspace required.",
          },
          attempts: 1,
        },
      })
    ).toEqual({
      type: "redirect",
      href: "/onboarding",
    });
  });

  it("redirects billing-required bootstrap payloads to /billing-required", () => {
    expect(
      resolvePostLoginRedirectHref({
        nextPath: null,
        loginHref: "/login?message=signin-retry",
        bootstrapResult: {
          status: 402,
          bootstrapSucceeded: false,
          bootstrapPayload: {
            code: "BILLING_REQUIRED",
            error: "Billing required.",
            billingRequiredPath: "/billing-required",
          },
          attempts: 1,
        },
      })
    ).toEqual({
      type: "redirect",
      href: "/billing-required",
    });
  });

  it("returns to login after bounded unauthenticated retries are exhausted", () => {
    expect(
      resolvePostLoginRedirectHref({
        nextPath: null,
        loginHref: "/login?message=signin-retry",
        bootstrapResult: {
          status: 401,
          bootstrapSucceeded: false,
          bootstrapPayload: {
            code: "UNAUTHENTICATED",
            error: "Authenticated session is required.",
          },
          attempts: 4,
        },
      })
    ).toEqual({
      type: "return_to_login",
      href: "/login?message=signin-retry",
    });
  });

  it("shows a controlled error for unexpected bootstrap failures instead of leaving the UI ambiguous", () => {
    expect(
      resolvePostLoginRedirectHref({
        nextPath: null,
        loginHref: "/login?message=signin-retry",
        bootstrapResult: {
          status: 500,
          bootstrapSucceeded: false,
          bootstrapPayload: {
            error: "Authentication bootstrap failed.",
          },
          attempts: 1,
        },
      })
    ).toEqual({
      type: "show_error",
      message: "Authentication bootstrap failed.",
    });
  });

  it("builds analytics input for complete success payloads", () => {
    expect(
      buildSuccessfulLoginAnalyticsInput({
        nextPath: null,
        user: {
          id: "user-1",
          role: "TACTICAL_BUYER",
          activeOrganization: {
            organizationId: "org-1",
            membershipRole: "MEMBER",
          },
        },
      })
    ).toEqual({
      runtime: "client",
      userId: "user-1",
      organizationId: "org-1",
      appRole: "TACTICAL_BUYER",
      membershipRole: "MEMBER",
      hasInviteNextPath: false,
      destination: "dashboard",
    });
  });

  it("does not require analytics fields to be present before the success redirect can proceed", () => {
    expect(
      buildSuccessfulLoginAnalyticsInput({
        nextPath: "/invite/token-123?mode=accept",
        user: {
          id: "user-1",
          role: "TACTICAL_BUYER",
          activeOrganization: {
            organizationId: "",
            membershipRole: "MEMBER",
          },
        },
      })
    ).toBeNull();
  });
});
