import { afterEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  rateLimitBucket: {
    deleteMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import {
  createDatabaseRateLimitStore,
  createMemoryRateLimitStore,
  createRateLimitErrorResponse,
  consumeRateLimit,
  enforceRateLimit,
  RateLimitBackendUnavailableError,
  rateLimitPolicies,
  resetRateLimitStore,
  setRateLimitStoreForTests,
  type RateLimitStore,
} from "@/lib/rate-limit";

function createRequest(ip = "203.0.113.10") {
  return new Request("http://localhost/api/test", {
    headers: {
      "x-forwarded-for": ip,
    },
  });
}

afterEach(() => {
  resetRateLimitStore();
  setRateLimitStoreForTests(null);
});

describe("rate limit store", () => {
  it("defaults to a PostgreSQL-backed distributed store for production usage", () => {
    expect(createDatabaseRateLimitStore(prismaMock).kind).toBe("postgresql");
  });

  it("uses the shared PostgreSQL store abstraction when no test override is configured", async () => {
    prismaMock.rateLimitBucket.deleteMany.mockResolvedValueOnce({ count: 0 });
    prismaMock.$queryRaw.mockResolvedValueOnce([
      {
        hits: 1,
        expiresAt: new Date("2026-03-28T12:30:00.000Z"),
      },
    ]);

    const result = await enforceRateLimit({
      policy: "forgotPassword",
      request: createRequest("203.0.113.16"),
      action: "auth.forgot-password",
    });

    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    expect(result.limit).toBe(rateLimitPolicies.forgotPassword.maxRequests);
    expect(result.remaining).toBe(
      rateLimitPolicies.forgotPassword.maxRequests - 1
    );
  });

  it("enforces shared bucket state across separate store instances", async () => {
    const sharedEntries = new Map();
    const storeA = createMemoryRateLimitStore(sharedEntries);
    const storeB = createMemoryRateLimitStore(sharedEntries);
    const limit = rateLimitPolicies.forgotPassword.maxRequests;

    for (let attempt = 0; attempt < limit; attempt += 1) {
      const result = await consumeRateLimit(
        "forgotPassword",
        { ip: "203.0.113.15" },
        {
          action: "auth.forgot-password",
          store: attempt % 2 === 0 ? storeA : storeB,
        }
      );

      expect(result.allowed).toBe(true);
    }

    const limitedResult = await consumeRateLimit(
      "forgotPassword",
      { ip: "203.0.113.15" },
      {
        action: "auth.forgot-password",
        store: storeB,
      }
    );

    expect(limitedResult.allowed).toBe(false);
    expect(limitedResult.limit).toBe(limit);
    expect(limitedResult.remaining).toBe(0);
  });

  it("separates counters by organization, user, and route action", async () => {
    const store = createMemoryRateLimitStore();
    const limit = rateLimitPolicies.adminMutation.maxRequests;

    for (let attempt = 0; attempt < limit; attempt += 1) {
      const result = await consumeRateLimit(
        "adminMutation",
        {
          organizationId: "org-1",
          userId: "user-1",
        },
        {
          action: "admin.members.remove",
          store,
        }
      );

      expect(result.allowed).toBe(true);
    }

    const sameActionLimited = await consumeRateLimit(
      "adminMutation",
      {
        organizationId: "org-1",
        userId: "user-1",
      },
      {
        action: "admin.members.remove",
        store,
      }
    );
    const differentActionAllowed = await consumeRateLimit(
      "adminMutation",
      {
        organizationId: "org-1",
        userId: "user-1",
      },
      {
        action: "admin.members.role_update",
        store,
      }
    );
    const differentOrganizationAllowed = await consumeRateLimit(
      "adminMutation",
      {
        organizationId: "org-2",
        userId: "user-1",
      },
      {
        action: "admin.members.remove",
        store,
      }
    );
    const differentUserAllowed = await consumeRateLimit(
      "adminMutation",
      {
        organizationId: "org-1",
        userId: "user-2",
      },
      {
        action: "admin.members.remove",
        store,
      }
    );

    expect(sameActionLimited.allowed).toBe(false);
    expect(differentActionAllowed.allowed).toBe(true);
    expect(differentOrganizationAllowed.allowed).toBe(true);
    expect(differentUserAllowed.allowed).toBe(true);
  });

  it("fails closed with a controlled 503 when the backend is unavailable", async () => {
    const failingStore: RateLimitStore = {
      kind: "failing-test-store",
      async consume() {
        throw new Error("database unavailable");
      },
    };

    setRateLimitStoreForTests(failingStore);

    const error = await enforceRateLimit({
      policy: "forgotPassword",
      request: createRequest("203.0.113.25"),
      action: "auth.forgot-password",
    }).catch((failure: unknown) => failure);

    expect(error).toBeInstanceOf(RateLimitBackendUnavailableError);

    const response = createRateLimitErrorResponse(
      error as RateLimitBackendUnavailableError
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Rate limit protection is temporarily unavailable. Please retry shortly.",
      code: "RATE_LIMIT_UNAVAILABLE",
    });
  });
});
