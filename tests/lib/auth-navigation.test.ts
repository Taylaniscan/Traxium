import { describe, expect, it, vi } from "vitest";

import {
  buildLoginHref,
  buildPostLoginTransitionHref,
  executePostLoginBootstrap,
  postLoginBootstrapRetryDelaysMs,
  resolveInviteNextPath,
  resolveLoginErrorMessage,
  resolvePostLoginTransitionAction,
  resolvePostLoginPath,
  shouldRetryPostLoginBootstrap,
} from "@/lib/auth-navigation";

describe("auth navigation helpers", () => {
  it("maps controlled login error codes to user-facing messages", () => {
    expect(resolveLoginErrorMessage("invalid-credentials")).toBe(
      "Invalid email or password."
    );
    expect(resolveLoginErrorMessage("signin-retry")).toBe(
      "We couldn't sign you in. Please try again."
    );
  });

  it("maps bootstrap outcomes to the correct destination", () => {
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
        nextPath: null,
        bootstrapPayload: {
          code: "BILLING_REQUIRED",
          billingRequiredPath: "/billing-required",
        },
        bootstrapSucceeded: false,
      })
    ).toBe("/billing-required");
  });

  it("returns authenticated transition failures back to /login without sending success paths there", () => {
    expect(
      resolvePostLoginTransitionAction({
        nextPath: null,
        loginHref: "/login?message=signin-retry",
        bootstrapPayload: {
          code: "UNAUTHENTICATED",
          error: "Authenticated session is required.",
        },
        bootstrapSucceeded: false,
      })
    ).toEqual({
      type: "return_to_login",
      href: "/login?message=signin-retry",
    });

    expect(
      resolvePostLoginTransitionAction({
        nextPath: null,
        loginHref: "/login?message=signin-retry",
        bootstrapPayload: null,
        bootstrapSucceeded: true,
      })
    ).toEqual({
      type: "redirect",
      href: "/dashboard",
    });

    expect(
      resolvePostLoginTransitionAction({
        nextPath: null,
        loginHref: "/login?message=signin-retry",
        bootstrapPayload: {
          error: "Authentication bootstrap failed.",
        },
        bootstrapSucceeded: false,
      })
    ).toEqual({
      type: "show_error",
      message: "Authentication bootstrap failed.",
    });

    expect(
      resolvePostLoginTransitionAction({
        nextPath: "/invite/token-123?mode=accept",
        loginHref: "/login?message=signin-retry",
        bootstrapPayload: {
          code: "ORGANIZATION_ACCESS_REQUIRED",
        },
        bootstrapSucceeded: false,
      })
    ).toEqual({
      type: "redirect",
      href: "/onboarding",
    });
  });

  it("retries only transient unauthenticated bootstrap responses", () => {
    expect(
      shouldRetryPostLoginBootstrap({
        status: 401,
        bootstrapSucceeded: false,
        bootstrapPayload: {
          code: "UNAUTHENTICATED",
          error: "Authenticated session is required.",
        },
      })
    ).toBe(true);

    expect(
      shouldRetryPostLoginBootstrap({
        status: 403,
        bootstrapSucceeded: false,
        bootstrapPayload: {
          code: "ORGANIZATION_ACCESS_REQUIRED",
        },
      })
    ).toBe(false);

    expect(
      shouldRetryPostLoginBootstrap({
        status: 200,
        bootstrapSucceeded: true,
        bootstrapPayload: null,
      })
    ).toBe(false);
  });

  it("resolves bootstrap retries deterministically without spinning forever", async () => {
    const waitFor = vi.fn().mockResolvedValue(undefined);
    const fetchBootstrap = vi
      .fn()
      .mockResolvedValueOnce({
        status: 401,
        bootstrapSucceeded: false,
        bootstrapPayload: {
          code: "UNAUTHENTICATED",
          error: "Authenticated session is required.",
        },
      })
      .mockResolvedValueOnce({
        status: 401,
        bootstrapSucceeded: false,
        bootstrapPayload: {
          code: "UNAUTHENTICATED",
          error: "Authenticated session is required.",
        },
      })
      .mockResolvedValueOnce({
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
      });

    await expect(
      executePostLoginBootstrap({
        fetchBootstrap,
        waitFor,
      })
    ).resolves.toEqual({
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
      attempts: 3,
    });

    expect(fetchBootstrap).toHaveBeenCalledTimes(3);
    expect(waitFor).toHaveBeenCalledTimes(2);
    expect(waitFor).toHaveBeenNthCalledWith(1, postLoginBootstrapRetryDelaysMs[1]);
    expect(waitFor).toHaveBeenNthCalledWith(2, postLoginBootstrapRetryDelaysMs[2]);
  });

  it("stops retrying after the bounded unauthenticated attempts and returns the final 401 result", async () => {
    const waitFor = vi.fn().mockResolvedValue(undefined);
    const fetchBootstrap = vi.fn().mockResolvedValue({
      status: 401,
      bootstrapSucceeded: false,
      bootstrapPayload: {
        code: "UNAUTHENTICATED",
        error: "Authenticated session is required.",
      },
    });

    await expect(
      executePostLoginBootstrap({
        fetchBootstrap,
        waitFor,
      })
    ).resolves.toEqual({
      status: 401,
      bootstrapSucceeded: false,
      bootstrapPayload: {
        code: "UNAUTHENTICATED",
        error: "Authenticated session is required.",
      },
      attempts: postLoginBootstrapRetryDelaysMs.length,
    });

    expect(fetchBootstrap).toHaveBeenCalledTimes(postLoginBootstrapRetryDelaysMs.length);
    expect(waitFor).toHaveBeenCalledTimes(postLoginBootstrapRetryDelaysMs.length - 1);
  });

  it("does not retry non-transient bootstrap failures like onboarding, billing, or server errors", async () => {
    const waitFor = vi.fn().mockResolvedValue(undefined);

    await expect(
      executePostLoginBootstrap({
        fetchBootstrap: vi.fn().mockResolvedValue({
          status: 403,
          bootstrapSucceeded: false,
          bootstrapPayload: {
            code: "ORGANIZATION_ACCESS_REQUIRED",
            error: "Workspace required.",
          },
        }),
        waitFor,
      })
    ).resolves.toEqual({
      status: 403,
      bootstrapSucceeded: false,
      bootstrapPayload: {
        code: "ORGANIZATION_ACCESS_REQUIRED",
        error: "Workspace required.",
      },
      attempts: 1,
    });

    await expect(
      executePostLoginBootstrap({
        fetchBootstrap: vi.fn().mockResolvedValue({
          status: 402,
          bootstrapSucceeded: false,
          bootstrapPayload: {
            code: "BILLING_REQUIRED",
            error: "Billing required.",
            billingRequiredPath: "/billing-required",
          },
        }),
        waitFor,
      })
    ).resolves.toEqual({
      status: 402,
      bootstrapSucceeded: false,
      bootstrapPayload: {
        code: "BILLING_REQUIRED",
        error: "Billing required.",
        billingRequiredPath: "/billing-required",
      },
      attempts: 1,
    });

    await expect(
      executePostLoginBootstrap({
        fetchBootstrap: vi.fn().mockResolvedValue({
          status: 500,
          bootstrapSucceeded: false,
          bootstrapPayload: {
            error: "Authentication bootstrap failed.",
          },
        }),
        waitFor,
      })
    ).resolves.toEqual({
      status: 500,
      bootstrapSucceeded: false,
      bootstrapPayload: {
        error: "Authentication bootstrap failed.",
      },
      attempts: 1,
    });

    expect(waitFor).not.toHaveBeenCalled();
  });

  it("propagates unexpected bootstrap fetch failures immediately so the UI can exit loading", async () => {
    const waitFor = vi.fn().mockResolvedValue(undefined);

    await expect(
      executePostLoginBootstrap({
        fetchBootstrap: vi
          .fn()
          .mockRejectedValue(new Error("Bootstrap request timed out.")),
        waitFor,
      })
    ).rejects.toThrow("Bootstrap request timed out.");

    expect(waitFor).not.toHaveBeenCalled();
  });

  it("builds safe continuation URLs for login and post-login transitions", () => {
    expect(resolveInviteNextPath("/invite/token-123?mode=accept")).toBe(
      "/invite/token-123?mode=accept"
    );
    expect(resolveInviteNextPath("//evil.example.com")).toBeNull();
    expect(buildPostLoginTransitionHref("/invite/token-123?mode=accept")).toBe(
      "/auth/bootstrap?next=%2Finvite%2Ftoken-123%3Fmode%3Daccept"
    );
    expect(
      buildLoginHref({
        nextPath: "/invite/token-123?mode=accept",
        message: "invalid-credentials",
        email: "user@example.com",
      })
    ).toBe(
      "/login?next=%2Finvite%2Ftoken-123%3Fmode%3Daccept&message=invalid-credentials&email=user%40example.com"
    );
  });
});
