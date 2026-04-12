import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createSupabaseRouteClientMock = vi.hoisted(() => vi.fn());
const signInWithPasswordMock = vi.hoisted(() => vi.fn());
const bootstrapCurrentUserFromAuthUserMock = vi.hoisted(() => vi.fn());
const trackServerEventMock = vi.hoisted(() => vi.fn());
const captureExceptionMock = vi.hoisted(() => vi.fn());
const createRouteObservabilityContextMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  bootstrapCurrentUserFromAuthUser: bootstrapCurrentUserFromAuthUserMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseRouteClient: createSupabaseRouteClientMock,
}));

vi.mock("@/lib/observability", () => ({
  captureException: captureExceptionMock,
  createRouteObservabilityContext: createRouteObservabilityContextMock,
  trackServerEvent: trackServerEventMock,
}));

import { POST } from "@/app/api/auth/login/route";

function createLoginRequest(input: {
  email?: string;
  password?: string;
  next?: string;
}) {
  const formData = new FormData();

  if (input.email !== undefined) {
    formData.set("email", input.email);
  }

  if (input.password !== undefined) {
    formData.set("password", input.password);
  }

  if (input.next !== undefined) {
    formData.set("next", input.next);
  }

  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    body: formData,
  });
}

describe("auth login route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    createRouteObservabilityContextMock.mockReturnValue({
      event: "auth.login.requested",
      route: "/api/auth/login",
      method: "POST",
      requestId: "request-1",
    });

    createSupabaseRouteClientMock.mockReturnValue({
      auth: {
        signInWithPassword: signInWithPasswordMock,
      },
    });

    bootstrapCurrentUserFromAuthUserMock.mockResolvedValue({
      ok: true,
      repaired: false,
      user: {
        id: "user-1",
        name: "User",
        email: "user@example.com",
        role: "TACTICAL_BUYER",
        organizationId: "org-1",
        activeOrganizationId: "org-1",
        activeOrganization: {
          membershipId: "membership-1",
          organizationId: "org-1",
          membershipRole: "MEMBER",
          membershipStatus: "ACTIVE",
        },
      },
    });
  });

  it("redirects valid credentials directly to /dashboard when workspace access is ready", async () => {
    signInWithPasswordMock.mockResolvedValueOnce({
      data: {
        session: {
          access_token: "access-token",
        },
        user: {
          id: "user-1",
        },
      },
      error: null,
    });

    const response = await POST(
      createLoginRequest({
        email: "user@example.com",
        password: "correct horse battery staple",
      })
    );

    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "correct horse battery staple",
    });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost/dashboard"
    );
    expect(response.headers.get("location")).not.toContain(
      "/auth/bootstrap"
    );
  });

  it("redirects valid credentials directly to /onboarding when workspace setup is required", async () => {
    signInWithPasswordMock.mockResolvedValueOnce({
      data: {
        session: {
          access_token: "access-token",
        },
        user: {
          id: "user-1",
          email: "user@example.com",
        },
      },
      error: null,
    });
    bootstrapCurrentUserFromAuthUserMock.mockResolvedValueOnce({
      ok: false,
      code: "ORGANIZATION_ACCESS_REQUIRED",
      message: "Workspace required.",
    });

    const response = await POST(
      createLoginRequest({
        email: "user@example.com",
        password: "correct horse battery staple",
      })
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost/onboarding"
    );
  });

  it("redirects valid credentials directly to /billing-required when billing is blocked", async () => {
    signInWithPasswordMock.mockResolvedValueOnce({
      data: {
        session: {
          access_token: "access-token",
        },
        user: {
          id: "user-1",
          email: "user@example.com",
        },
      },
      error: null,
    });
    bootstrapCurrentUserFromAuthUserMock.mockResolvedValueOnce({
      ok: false,
      code: "BILLING_REQUIRED",
      message: "Billing required.",
      accessState: {
        isBlocked: true,
        accessState: "blocked_unpaid",
        reasonCode: "unpaid",
      },
    });

    const response = await POST(
      createLoginRequest({
        email: "user@example.com",
        password: "correct horse battery staple",
      })
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost/billing-required"
    );
  });

  it("returns invalid credentials back to /login with a controlled error and preserved email", async () => {
    signInWithPasswordMock.mockResolvedValueOnce({
      data: {
        session: null,
        user: null,
      },
      error: {
        message: "Invalid login credentials",
      },
    });

    const response = await POST(
      createLoginRequest({
        email: "user@example.com",
        password: "wrong password",
      })
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost/login?message=invalid-credentials&email=user%40example.com"
    );
  });

  it("preserves invite continuation across the server-side login redirect", async () => {
    signInWithPasswordMock.mockResolvedValueOnce({
      data: {
        session: {
          access_token: "access-token",
        },
        user: {
          id: "user-1",
        },
      },
      error: null,
    });

    const response = await POST(
      createLoginRequest({
        email: "user@example.com",
        password: "correct horse battery staple",
        next: "/invite/token-123?mode=accept",
      })
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost/invite/token-123?mode=accept"
    );
  });

  it("returns to /login with signin-retry when post-login resolution fails unexpectedly", async () => {
    signInWithPasswordMock.mockResolvedValueOnce({
      data: {
        session: {
          access_token: "access-token",
        },
        user: {
          id: "user-1",
          email: "user@example.com",
        },
      },
      error: null,
    });
    bootstrapCurrentUserFromAuthUserMock.mockResolvedValueOnce({
      ok: false,
      code: "AMBIGUOUS_USER",
      message: "Ambiguous user.",
    });

    const response = await POST(
      createLoginRequest({
        email: "user@example.com",
        password: "correct horse battery staple",
      })
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost/login?message=signin-retry&email=user%40example.com"
    );
  });
});
