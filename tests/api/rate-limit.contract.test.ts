import { MembershipStatus, OrganizationRole, Role } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_ORGANIZATION_ID,
  DEFAULT_USER_ID,
  createSessionUser,
} from "../helpers/security-fixtures";

const queuePasswordRecoveryEmailJobSafelyMock = vi.hoisted(() => vi.fn());
const requireOrganizationMock = vi.hoisted(() => vi.fn());
const canManageOrganizationMembersMock = vi.hoisted(() => vi.fn());
const getOrganizationSettingsMock = vi.hoisted(() => vi.fn());
const updateOrganizationSettingsMock = vi.hoisted(() => vi.fn());
const createRouteObservabilityContextMock = vi.hoisted(() => vi.fn());
const trackServerEventMock = vi.hoisted(() => vi.fn());
const captureExceptionMock = vi.hoisted(() => vi.fn());

const createAuthGuardErrorResponseMock = vi.hoisted(() => vi.fn(() => null));

const OrganizationSettingsErrorMock = vi.hoisted(
  () =>
    class OrganizationSettingsError extends Error {
      constructor(message: string, readonly status = 400) {
        super(message);
        this.name = "OrganizationSettingsError";
      }
    }
);

vi.mock("@/lib/auth-email", () => ({
  queuePasswordRecoveryEmailJobSafely: queuePasswordRecoveryEmailJobSafelyMock,
}));

vi.mock("@/lib/auth", () => ({
  requireOrganization: requireOrganizationMock,
  createAuthGuardErrorResponse: createAuthGuardErrorResponseMock,
}));

vi.mock("@/lib/organizations", () => ({
  canManageOrganizationMembers: canManageOrganizationMembersMock,
  getOrganizationSettings: getOrganizationSettingsMock,
  updateOrganizationSettings: updateOrganizationSettingsMock,
  OrganizationSettingsError: OrganizationSettingsErrorMock,
}));

vi.mock("@/lib/observability", () => ({
  captureException: captureExceptionMock,
  createRouteObservabilityContext: createRouteObservabilityContextMock,
  trackServerEvent: trackServerEventMock,
}));

import { POST as forgotPasswordRoute } from "@/app/api/auth/forgot-password/route";
import {
  GET as getAdminSettingsRoute,
  PATCH as patchAdminSettingsRoute,
} from "@/app/api/admin/settings/route";
import {
  createMemoryRateLimitStore,
  rateLimitPolicies,
  resetRateLimitStore,
  setRateLimitStoreForTests,
  type RateLimitStore,
} from "@/lib/rate-limit";

const ORIGINAL_ENV = { ...process.env };

function createAdminSettingsRecord() {
  return {
    id: DEFAULT_ORGANIZATION_ID,
    name: "Atlas Procurement",
    description: "Global procurement savings governance workspace.",
    slug: "atlas-procurement",
    createdAt: new Date("2026-03-20T09:00:00.000Z"),
    updatedAt: new Date("2026-03-27T09:00:00.000Z"),
  };
}

function createAdminRequest(method: "GET" | "PATCH") {
  if (method === "GET") {
    return new Request("http://localhost/api/admin/settings", {
      method,
    });
  }

  return new Request("http://localhost/api/admin/settings", {
    method,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      name: "Atlas Procurement Europe",
      description: "European sourcing governance workspace.",
    }),
  });
}

function createForgotPasswordRequest(ip = "203.0.113.21") {
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

describe("rate-limit route contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...ORIGINAL_ENV,
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    };

    setRateLimitStoreForTests(createMemoryRateLimitStore());

    requireOrganizationMock.mockResolvedValue(
      createSessionUser({
        id: DEFAULT_USER_ID,
        role: Role.HEAD_OF_GLOBAL_PROCUREMENT,
        activeOrganization: {
          membershipId: "membership-admin",
          organizationId: DEFAULT_ORGANIZATION_ID,
          membershipRole: OrganizationRole.ADMIN,
          membershipStatus: MembershipStatus.ACTIVE,
        },
      })
    );
    canManageOrganizationMembersMock.mockReturnValue(true);
    getOrganizationSettingsMock.mockResolvedValue(createAdminSettingsRecord());
    updateOrganizationSettingsMock.mockResolvedValue({
      changed: true,
      organization: {
        ...createAdminSettingsRecord(),
        name: "Atlas Procurement Europe",
        description: "European sourcing governance workspace.",
      },
    });
    createRouteObservabilityContextMock.mockReturnValue({
      requestId: "request-1",
    });
    queuePasswordRecoveryEmailJobSafelyMock.mockResolvedValue({
      transport: "job-queued",
      state: "queued",
      jobId: "job-password-recovery-1",
    });
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetRateLimitStore();
    setRateLimitStoreForTests(null);
  });

  it("does not rate limit admin settings reads", async () => {
    const limit = rateLimitPolicies.adminMutation.maxRequests;
    const statuses: number[] = [];

    for (let attempt = 0; attempt < limit + 1; attempt += 1) {
      const response = await getAdminSettingsRoute(createAdminRequest("GET"));
      statuses.push(response.status);
    }

    expect(statuses).toEqual(new Array(limit + 1).fill(200));
    expect(getOrganizationSettingsMock).toHaveBeenCalledTimes(limit + 1);
  });

  it("rate limits admin settings updates per organization and authenticated user", async () => {
    const limit = rateLimitPolicies.adminMutation.maxRequests;

    for (let attempt = 0; attempt < limit; attempt += 1) {
      const response = await patchAdminSettingsRoute(createAdminRequest("PATCH"));
      expect(response.status).toBe(200);
    }

    const limitedResponse = await patchAdminSettingsRoute(
      createAdminRequest("PATCH")
    );

    expect(limitedResponse.status).toBe(429);
    await expect(limitedResponse.json()).resolves.toEqual({
      error: "Too many administrative change attempts. Please wait before trying again.",
      code: "RATE_LIMITED",
    });
    expect(limitedResponse.headers.get("retry-after")).toBeTruthy();
    expect(updateOrganizationSettingsMock).toHaveBeenCalledTimes(limit);
  });

  it("keeps admin settings reads available after the update limiter is exhausted", async () => {
    const limit = rateLimitPolicies.adminMutation.maxRequests;

    for (let attempt = 0; attempt < limit; attempt += 1) {
      await patchAdminSettingsRoute(createAdminRequest("PATCH"));
    }

    const limitedPatchResponse = await patchAdminSettingsRoute(
      createAdminRequest("PATCH")
    );
    const readResponse = await getAdminSettingsRoute(createAdminRequest("GET"));

    expect(limitedPatchResponse.status).toBe(429);
    expect(readResponse.status).toBe(200);
    expect(getOrganizationSettingsMock).toHaveBeenCalledTimes(1);
  });

  it("fails closed with a 503 route response when the shared limiter backend is unavailable", async () => {
    const failingStore: RateLimitStore = {
      kind: "failing-test-store",
      async consume() {
        throw new Error("database unavailable");
      },
    };

    setRateLimitStoreForTests(failingStore);

    const response = await forgotPasswordRoute(createForgotPasswordRequest());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Rate limit protection is temporarily unavailable. Please retry shortly.",
      code: "RATE_LIMIT_UNAVAILABLE",
    });
    expect(response.headers.get("retry-after")).toBe("60");
    expect(response.headers.get("x-ratelimit-policy")).toBe("forgotPassword");
    expect(queuePasswordRecoveryEmailJobSafelyMock).not.toHaveBeenCalled();
  });
});
