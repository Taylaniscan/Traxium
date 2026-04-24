import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  MockAuthGuardError,
  createAuthGuardJsonResponse,
  createSessionUser,
} from "../helpers/security-fixtures";

const requireUserMock = vi.hoisted(() => vi.fn());
const createSupabaseServerClientMock = vi.hoisted(() => vi.fn());
const createSupabasePublicClientMock = vi.hoisted(() => vi.fn());
const getUserMock = vi.hoisted(() => vi.fn());
const updateUserMock = vi.hoisted(() => vi.fn());
const signInWithPasswordMock = vi.hoisted(() => vi.fn());
const enforceRateLimitMock = vi.hoisted(() => vi.fn());
const createRateLimitErrorResponseMock = vi.hoisted(() => vi.fn());
const trackServerEventMock = vi.hoisted(() => vi.fn());
const captureExceptionMock = vi.hoisted(() => vi.fn());
const RateLimitExceededErrorMock = vi.hoisted(
  () =>
    class RateLimitExceededError extends Error {
      constructor(message: string, readonly status = 429) {
        super(message);
        this.name = "RateLimitExceededError";
      }
    }
);

vi.mock("@/lib/auth", () => ({
  requireUser: requireUserMock,
  createAuthGuardErrorResponse: createAuthGuardJsonResponse,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock,
  createSupabasePublicClient: createSupabasePublicClientMock,
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: enforceRateLimitMock,
  createRateLimitErrorResponse: createRateLimitErrorResponseMock,
  RateLimitExceededError: RateLimitExceededErrorMock,
}));

vi.mock("@/lib/observability", () => ({
  captureException: captureExceptionMock,
  createRouteObservabilityContext: vi.fn(
    (request: Request, context: { event: string }) => ({
      ...context,
      requestId: "req-1",
      route: new URL(request.url).pathname,
      method: request.method,
    })
  ),
  trackServerEvent: trackServerEventMock,
}));

import { POST as changePasswordRoute } from "@/app/api/auth/change-password/route";

describe("change password route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue(createSessionUser());
    enforceRateLimitMock.mockResolvedValue(undefined);
    createRateLimitErrorResponseMock.mockImplementation(
      (error: { message: string; status?: number }) =>
        Response.json(
          { error: error.message, code: "RATE_LIMITED" },
          { status: error.status ?? 429 }
        )
    );
    getUserMock.mockResolvedValue({
      data: {
        user: {
          email: "user@example.com",
        },
      },
      error: null,
    });
    updateUserMock.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    signInWithPasswordMock.mockResolvedValue({
      data: {
        session: {
          access_token: "token-1",
        },
        user: {
          id: "auth-user-1",
          email: "user@example.com",
        },
      },
      error: null,
    });
    createSupabaseServerClientMock.mockResolvedValue({
      auth: {
        getUser: getUserMock,
        updateUser: updateUserMock,
      },
    });
    createSupabasePublicClientMock.mockReturnValue({
      auth: {
        signInWithPassword: signInWithPasswordMock,
      },
    });
  });

  it("updates the password when the current password is correct", async () => {
    const response = await changePasswordRoute(
      new Request("http://localhost/api/auth/change-password", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          currentPassword: "Current12345",
          newPassword: "Stronger12345",
          confirmNewPassword: "Stronger12345",
        }),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      email: "user@example.com",
    });
    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "Current12345",
    });
    expect(updateUserMock).toHaveBeenCalledWith({
      password: "Stronger12345",
    });
  });

  it("rejects the request when the current password is wrong", async () => {
    signInWithPasswordMock.mockResolvedValueOnce({
      data: {
        session: null,
        user: null,
      },
      error: new Error("Invalid login credentials"),
    });

    const response = await changePasswordRoute(
      new Request("http://localhost/api/auth/change-password", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          currentPassword: "Wrong12345",
          newPassword: "Stronger12345",
          confirmNewPassword: "Stronger12345",
        }),
      })
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "Current password is incorrect.",
    });
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("rejects weak new passwords before reaching Supabase", async () => {
    const response = await changePasswordRoute(
      new Request("http://localhost/api/auth/change-password", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          currentPassword: "Current12345",
          newPassword: "weak",
          confirmNewPassword: "weak",
        }),
      })
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "Password must be at least 12 characters.",
    });
    expect(signInWithPasswordMock).not.toHaveBeenCalled();
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("rejects mismatched password confirmation", async () => {
    const response = await changePasswordRoute(
      new Request("http://localhost/api/auth/change-password", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          currentPassword: "Current12345",
          newPassword: "Stronger12345",
          confirmNewPassword: "Mismatch12345",
        }),
      })
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "Password confirmation does not match.",
    });
    expect(signInWithPasswordMock).not.toHaveBeenCalled();
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("returns the auth guard response for unauthenticated callers", async () => {
    requireUserMock.mockRejectedValueOnce(
      new MockAuthGuardError(
        "Authenticated session is required.",
        401,
        "UNAUTHENTICATED"
      )
    );

    const response = await changePasswordRoute(
      new Request("http://localhost/api/auth/change-password", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          currentPassword: "Current12345",
          newPassword: "Stronger12345",
          confirmNewPassword: "Stronger12345",
        }),
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized.",
    });
    expect(createSupabaseServerClientMock).not.toHaveBeenCalled();
    expect(createSupabasePublicClientMock).not.toHaveBeenCalled();
  });
});
