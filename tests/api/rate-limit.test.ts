import { Role } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_ORGANIZATION_ID,
  DEFAULT_USER_ID,
  OTHER_ORGANIZATION_ID,
  createSessionUser,
} from "../helpers/security-fixtures";

const queuePasswordRecoveryEmailJobSafelyMock = vi.hoisted(() => vi.fn());
const getCurrentUserMock = vi.hoisted(() => vi.fn());
const createAuthGuardErrorResponseMock = vi.hoisted(() => vi.fn(() => null));
const getSavingCardsMock = vi.hoisted(() => vi.fn());
const createSavingCardMock = vi.hoisted(() => vi.fn());
const WorkflowErrorMock = vi.hoisted(
  () =>
    class WorkflowError extends Error {
      constructor(message: string, readonly status = 409) {
        super(message);
        this.name = "WorkflowError";
      }
    }
);
const enforceUsageQuotaMock = vi.hoisted(() => vi.fn());
const recordUsageEventMock = vi.hoisted(() => vi.fn());
const UsageQuotaExceededErrorMock = vi.hoisted(
  () =>
    class UsageQuotaExceededError extends Error {
      constructor(message: string, readonly status = 429) {
        super(message);
        this.name = "UsageQuotaExceededError";
      }
    }
);
const prismaMock = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  rateLimitBucket: {
    deleteMany: vi.fn(),
  },
}));

vi.mock("@/lib/auth-email", () => ({
  queuePasswordRecoveryEmailJobSafely: queuePasswordRecoveryEmailJobSafelyMock,
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: getCurrentUserMock,
  requireUser: getCurrentUserMock,
  createAuthGuardErrorResponse: createAuthGuardErrorResponseMock,
}));

vi.mock("@/lib/data", () => ({
  getSavingCards: getSavingCardsMock,
  createSavingCard: createSavingCardMock,
  WorkflowError: WorkflowErrorMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/usage", () => ({
  enforceUsageQuota: enforceUsageQuotaMock,
  recordUsageEvent: recordUsageEventMock,
  UsageQuotaExceededError: UsageQuotaExceededErrorMock,
}));

import { POST as forgotPasswordRoute } from "@/app/api/auth/forgot-password/route";
import { POST as postSavingCardsRoute } from "@/app/api/saving-cards/route";
import {
  createMemoryRateLimitStore,
  rateLimitPolicies,
  resetRateLimitStore,
  setRateLimitStoreForTests,
} from "@/lib/rate-limit";

function createForgotPasswordRequest(ip: string) {
  return new Request("http://localhost/api/auth/forgot-password", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify({
      email: "user@example.com",
    }),
  });
}

function createSavingCardRequest(ip = "198.51.100.20") {
  return new Request("http://localhost/api/saving-cards", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify({
      title: "Resin renegotiation",
      description: "Renegotiate the resin packaging contract for margin improvement.",
      savingType: "Cost reduction",
      phase: "IDEA",
      supplier: { name: "Supplier A" },
      material: { name: "PET Resin" },
      alternativeSupplier: {},
      alternativeMaterial: {},
      category: { name: "Packaging" },
      plant: { name: "Amsterdam" },
      businessUnit: { name: "Beverages" },
      buyer: { name: "Strategic Buyer" },
      baselinePrice: 10,
      newPrice: 8,
      annualVolume: 100,
      currency: "EUR",
      fxRate: 1.1,
      frequency: "RECURRING",
      savingDriver: "Negotiation",
      implementationComplexity: "Medium",
      qualificationStatus: "Not Started",
      startDate: "2025-01-01T00:00:00.000Z",
      endDate: "2025-12-31T00:00:00.000Z",
      impactStartDate: "2025-02-01T00:00:00.000Z",
      impactEndDate: "2025-12-31T00:00:00.000Z",
      cancellationReason: "",
      stakeholderIds: ["stakeholder-1"],
      evidence: [],
    }),
  });
}

describe("rate limit enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setRateLimitStoreForTests(createMemoryRateLimitStore());
    resetRateLimitStore();
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

    queuePasswordRecoveryEmailJobSafelyMock.mockResolvedValue({
      transport: "job-queued",
      state: "queued",
      jobId: "job-password-recovery-1",
    });
    getCurrentUserMock.mockResolvedValue(
      createSessionUser({
        id: DEFAULT_USER_ID,
        role: Role.GLOBAL_CATEGORY_LEADER,
        organizationId: DEFAULT_ORGANIZATION_ID,
      })
    );
    getSavingCardsMock.mockResolvedValue([]);
    createSavingCardMock.mockResolvedValue({
      id: "card-1",
      title: "Resin renegotiation",
    });
    enforceUsageQuotaMock.mockResolvedValue(undefined);
    recordUsageEventMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    resetRateLimitStore();
    setRateLimitStoreForTests(null);
  });

  it("allows forgot-password requests while the IP stays under the configured limit", async () => {
    const limit = rateLimitPolicies.forgotPassword.maxRequests;

    for (let attempt = 0; attempt < limit; attempt += 1) {
      const response = await forgotPasswordRoute(
        createForgotPasswordRequest("203.0.113.10")
      );

      expect(response.status).toBe(200);
    }

    expect(queuePasswordRecoveryEmailJobSafelyMock).toHaveBeenCalledTimes(limit);
  });

  it("returns a consistent 429 response once the forgot-password IP limit is exceeded", async () => {
    const limit = rateLimitPolicies.forgotPassword.maxRequests;

    for (let attempt = 0; attempt < limit; attempt += 1) {
      await forgotPasswordRoute(createForgotPasswordRequest("203.0.113.11"));
    }

    const response = await forgotPasswordRoute(
      createForgotPasswordRequest("203.0.113.11")
    );

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      error: "Too many password recovery attempts. Please try again later.",
      code: "RATE_LIMITED",
    });
    expect(response.headers.get("retry-after")).toBeTruthy();
    expect(queuePasswordRecoveryEmailJobSafelyMock).toHaveBeenCalledTimes(limit);
  });

  it("keeps public auth rate limits isolated by IP address", async () => {
    const limit = rateLimitPolicies.forgotPassword.maxRequests;

    for (let attempt = 0; attempt < limit; attempt += 1) {
      await forgotPasswordRoute(createForgotPasswordRequest("203.0.113.12"));
    }

    const differentIpResponse = await forgotPasswordRoute(
      createForgotPasswordRequest("203.0.113.13")
    );

    expect(differentIpResponse.status).toBe(200);
    expect(queuePasswordRecoveryEmailJobSafelyMock).toHaveBeenCalledTimes(limit + 1);
  });

  it("scopes saving-card mutation limits by organization and authenticated user", async () => {
    const limit = rateLimitPolicies.savingCardMutation.maxRequests;

    getCurrentUserMock.mockResolvedValue(
      createSessionUser({
        id: DEFAULT_USER_ID,
        role: Role.GLOBAL_CATEGORY_LEADER,
        organizationId: DEFAULT_ORGANIZATION_ID,
      })
    );

    for (let attempt = 0; attempt < limit; attempt += 1) {
      const response = await postSavingCardsRoute(createSavingCardRequest());
      expect(response.status).toBe(201);
    }

    const limitedResponse = await postSavingCardsRoute(createSavingCardRequest());

    expect(limitedResponse.status).toBe(429);
    await expect(limitedResponse.json()).resolves.toEqual({
      error:
        "Too many saving card creation attempts. Please slow down and try again shortly.",
      code: "RATE_LIMITED",
    });

    getCurrentUserMock.mockResolvedValue(
      createSessionUser({
        id: DEFAULT_USER_ID,
        role: Role.GLOBAL_CATEGORY_LEADER,
        organizationId: OTHER_ORGANIZATION_ID,
      })
    );

    const otherTenantResponse = await postSavingCardsRoute(
      createSavingCardRequest()
    );

    expect(otherTenantResponse.status).toBe(201);

    getCurrentUserMock.mockResolvedValue(
      createSessionUser({
        id: "user-2",
        role: Role.GLOBAL_CATEGORY_LEADER,
        organizationId: DEFAULT_ORGANIZATION_ID,
      })
    );

    const otherUserResponse = await postSavingCardsRoute(
      createSavingCardRequest()
    );

    expect(otherUserResponse.status).toBe(201);
  });
});
