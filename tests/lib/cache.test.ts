import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearScopedCacheForTests,
  getScopedCachedValue,
  invalidateScopedCache,
} from "@/lib/cache";

describe("lib/cache", () => {
  const originalCacheEnv = process.env.ENABLE_SHORT_LIVED_CACHE_IN_TESTS;

  beforeEach(() => {
    vi.clearAllMocks();
    clearScopedCacheForTests();
    process.env.ENABLE_SHORT_LIVED_CACHE_IN_TESTS = "true";
  });

  afterEach(() => {
    process.env.ENABLE_SHORT_LIVED_CACHE_IN_TESTS = originalCacheEnv;
    clearScopedCacheForTests();
  });

  it("keeps tenant-scoped cache entries isolated and invalidates all keys for one organization", async () => {
    const orgOneTakeTenLoader = vi.fn().mockResolvedValue("org-1-take-10");
    const orgOneTakeTwentyFiveLoader = vi.fn().mockResolvedValue("org-1-take-25");
    const orgTwoTakeTenLoader = vi.fn().mockResolvedValue("org-2-take-10");

    await getScopedCachedValue(
      {
        namespace: "organization-jobs",
        organizationId: "org-1",
        key: "take:10",
        ttlMs: 1_000,
      },
      orgOneTakeTenLoader
    );
    await getScopedCachedValue(
      {
        namespace: "organization-jobs",
        organizationId: "org-1",
        key: "take:25",
        ttlMs: 1_000,
      },
      orgOneTakeTwentyFiveLoader
    );
    await getScopedCachedValue(
      {
        namespace: "organization-jobs",
        organizationId: "org-2",
        key: "take:10",
        ttlMs: 1_000,
      },
      orgTwoTakeTenLoader
    );

    invalidateScopedCache({
      namespace: "organization-jobs",
      organizationId: "org-1",
    });

    const orgOneReloadLoader = vi.fn().mockResolvedValue("org-1-take-10-reloaded");
    const orgOneSecondReloadLoader = vi.fn().mockResolvedValue(
      "org-1-take-25-reloaded"
    );
    const orgTwoCacheHitLoader = vi.fn().mockResolvedValue("org-2-should-stay-cached");

    const orgOneTakeTen = await getScopedCachedValue(
      {
        namespace: "organization-jobs",
        organizationId: "org-1",
        key: "take:10",
        ttlMs: 1_000,
      },
      orgOneReloadLoader
    );
    const orgOneTakeTwentyFive = await getScopedCachedValue(
      {
        namespace: "organization-jobs",
        organizationId: "org-1",
        key: "take:25",
        ttlMs: 1_000,
      },
      orgOneSecondReloadLoader
    );
    const orgTwoTakeTen = await getScopedCachedValue(
      {
        namespace: "organization-jobs",
        organizationId: "org-2",
        key: "take:10",
        ttlMs: 1_000,
      },
      orgTwoCacheHitLoader
    );

    expect(orgOneTakeTen).toBe("org-1-take-10-reloaded");
    expect(orgOneTakeTwentyFive).toBe("org-1-take-25-reloaded");
    expect(orgTwoTakeTen).toBe("org-2-take-10");
    expect(orgOneReloadLoader).toHaveBeenCalledTimes(1);
    expect(orgOneSecondReloadLoader).toHaveBeenCalledTimes(1);
    expect(orgTwoCacheHitLoader).not.toHaveBeenCalled();
  });
});
