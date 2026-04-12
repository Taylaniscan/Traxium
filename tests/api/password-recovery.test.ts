import { beforeEach, describe, expect, it, vi } from "vitest";

const createSupabasePublicClientMock = vi.hoisted(() => vi.fn());
const createSupabaseServerClientMock = vi.hoisted(() => vi.fn());
const createSupabaseAdminClientMock = vi.hoisted(() => vi.fn());
const resetPasswordForEmailMock = vi.hoisted(() => vi.fn());
const getUserMock = vi.hoisted(() => vi.fn());
const updateUserMock = vi.hoisted(() => vi.fn());
const generateLinkMock = vi.hoisted(() => vi.fn());
const enforceRateLimitMock = vi.hoisted(() => vi.fn());
const createRateLimitErrorResponseMock = vi.hoisted(() => vi.fn());
const RateLimitExceededErrorMock = vi.hoisted(
  () =>
    class RateLimitExceededError extends Error {
      constructor(message: string, readonly status = 429) {
        super(message);
        this.name = "RateLimitExceededError";
      }
    }
);
const mockPrisma = vi.hoisted(() => ({
  job: {
    create: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: createSupabaseAdminClientMock,
  createSupabasePublicClient: createSupabasePublicClientMock,
  createSupabaseServerClient: createSupabaseServerClientMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: enforceRateLimitMock,
  createRateLimitErrorResponse: createRateLimitErrorResponseMock,
  RateLimitExceededError: RateLimitExceededErrorMock,
}));

import { POST as forgotPasswordRoute } from "@/app/api/auth/forgot-password/route";
import { POST as resetPasswordRoute } from "@/app/api/auth/reset-password/route";

describe("password recovery routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    enforceRateLimitMock.mockResolvedValue(undefined);
    createRateLimitErrorResponseMock.mockImplementation((error: { message: string; status?: number }) =>
      Response.json(
        { error: error.message, code: "RATE_LIMITED" },
        { status: error.status ?? 429 }
      )
    );
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
    mockPrisma.job.upsert.mockResolvedValue({
      id: "job-password-recovery-1",
    });
  });

  it("queues a forgot-password delivery job without waiting for Supabase Auth", async () => {
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
        transport: "job-queued",
        state: "queued",
        jobId: "job-password-recovery-1",
      },
    });
    expect(mockPrisma.job.upsert).toHaveBeenCalledWith({
      where: {
        type_idempotencyKey: {
          type: "auth_email.password_recovery_delivery",
          idempotencyKey: expect.stringMatching(
            /^password-recovery:user@example\.com:http:\/\/localhost:3000\/reset-password:\d+$/
          ),
        },
      },
      update: {},
      create: {
        type: "auth_email.password_recovery_delivery",
        idempotencyKey: expect.stringMatching(
          /^password-recovery:user@example\.com:http:\/\/localhost:3000\/reset-password:\d+$/
        ),
        organizationId: null,
        payload: {
          email: "user@example.com",
          redirectTo: "http://localhost:3000/reset-password",
        },
        scheduledAt: expect.any(Date),
        maxAttempts: 3,
      },
    });
    expect(resetPasswordForEmailMock).not.toHaveBeenCalled();
    expect(generateLinkMock).not.toHaveBeenCalled();
  });

  it("accepts forgot-password requests even when job scheduling is unavailable", async () => {
    mockPrisma.job.upsert.mockRejectedValueOnce(
      new Error("Queue storage is unavailable.")
    );

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
        transport: "queue-unavailable",
        state: "unavailable",
      },
    });
    expect(resetPasswordForEmailMock).not.toHaveBeenCalled();
    expect(generateLinkMock).not.toHaveBeenCalled();
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
