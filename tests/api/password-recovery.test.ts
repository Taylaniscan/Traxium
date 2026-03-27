import { beforeEach, describe, expect, it, vi } from "vitest";

const createSupabasePublicClientMock = vi.hoisted(() => vi.fn());
const createSupabaseServerClientMock = vi.hoisted(() => vi.fn());
const createSupabaseAdminClientMock = vi.hoisted(() => vi.fn());
const resetPasswordForEmailMock = vi.hoisted(() => vi.fn());
const getUserMock = vi.hoisted(() => vi.fn());
const updateUserMock = vi.hoisted(() => vi.fn());
const generateLinkMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: createSupabaseAdminClientMock,
  createSupabasePublicClient: createSupabasePublicClientMock,
  createSupabaseServerClient: createSupabaseServerClientMock,
}));

import { POST as forgotPasswordRoute } from "@/app/api/auth/forgot-password/route";
import { POST as resetPasswordRoute } from "@/app/api/auth/reset-password/route";

describe("password recovery routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    resetPasswordForEmailMock.mockResolvedValue({
      data: {},
      error: null,
    });
    createSupabasePublicClientMock.mockReturnValue({
      auth: {
        resetPasswordForEmail: resetPasswordForEmailMock,
      },
    });
    createSupabaseAdminClientMock.mockReturnValue({
      auth: {
        admin: {
          generateLink: generateLinkMock,
        },
      },
    });
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
    createSupabaseServerClientMock.mockResolvedValue({
      auth: {
        getUser: getUserMock,
        updateUser: updateUserMock,
      },
    });
    generateLinkMock.mockResolvedValue({
      data: {
        properties: {
          action_link: "https://kdsfmmwmpdhtezwdqbnk.supabase.co/auth/v1/verify?type=recovery&token=generated",
          email_otp: "123456",
          hashed_token: "hashed-token",
          redirect_to: "http://localhost:3000/reset-password",
          verification_type: "recovery",
        },
        user: {
          id: "auth-user-1",
        },
      },
      error: null,
    });
  });

  it("sends a forgot-password email through Supabase Auth", async () => {
    const response = await forgotPasswordRoute(
      new Request("http://localhost/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: "user@example.com",
        }),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      delivery: {
        transport: "supabase-auth",
      },
    });
    expect(resetPasswordForEmailMock).toHaveBeenCalledWith("user@example.com", {
      redirectTo: "http://localhost:3000/reset-password",
    });
  });

  it("falls back to a generated recovery link in local development when hosted email is rate limited", async () => {
    resetPasswordForEmailMock.mockResolvedValueOnce({
      data: {},
      error: {
        message: "Email rate limit exceeded",
      },
    });

    const response = await forgotPasswordRoute(
      new Request("http://localhost/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: "user@example.com",
        }),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      delivery: {
        transport: "generated-link",
        requiresManualDelivery: true,
      },
      developmentRecoveryLink:
        "https://kdsfmmwmpdhtezwdqbnk.supabase.co/auth/v1/verify?type=recovery&token=generated",
    });
    expect(generateLinkMock).toHaveBeenCalledWith({
      type: "recovery",
      email: "user@example.com",
      options: {
        redirectTo: "http://localhost:3000/reset-password",
      },
    });
  });

  it("updates the password for a valid recovery session", async () => {
    const response = await resetPasswordRoute(
      new Request("http://localhost/api/auth/reset-password", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          password: "Stronger12345",
          confirmPassword: "Stronger12345",
        }),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      email: "user@example.com",
    });
    expect(updateUserMock).toHaveBeenCalledWith({
      password: "Stronger12345",
    });
  });
});
