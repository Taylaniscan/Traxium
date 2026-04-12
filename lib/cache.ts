type ScopedCacheKeyInput = {
  namespace: string;
  organizationId?: string | null;
  key?: string;
};

type ScopedCacheLoaderInput = ScopedCacheKeyInput & {
  ttlMs: number;
  enableInTests?: boolean;
};

type ScopedCacheEntry<T> = {
  expiresAt: number;
  value?: T;
  promise?: Promise<T>;
};

const scopedCacheStore = new Map<string, ScopedCacheEntry<unknown>>();
const TEST_CACHE_ENV_FLAG = "ENABLE_SHORT_LIVED_CACHE_IN_TESTS";

function normalizeScopedCachePart(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized || "global";
}

function isCacheEnabled(enableInTests = false) {
  if (process.env.NODE_ENV !== "test") {
    return true;
  }

  return enableInTests || process.env[TEST_CACHE_ENV_FLAG] === "true";
}

export function buildScopedCacheKey(input: ScopedCacheKeyInput) {
  return [
    normalizeScopedCachePart(input.namespace),
    normalizeScopedCachePart(input.organizationId),
    normalizeScopedCachePart(input.key),
  ].join("::");
}

export async function getScopedCachedValue<T>(
  input: ScopedCacheLoaderInput,
  loader: () => Promise<T>
): Promise<T> {
  if (input.ttlMs <= 0 || !isCacheEnabled(input.enableInTests)) {
    return loader();
  }

  const cacheKey = buildScopedCacheKey(input);
  const now = Date.now();
  const existingEntry = scopedCacheStore.get(cacheKey) as
    | ScopedCacheEntry<T>
    | undefined;

  if (existingEntry) {
    if (existingEntry.value !== undefined && existingEntry.expiresAt > now) {
      return existingEntry.value;
    }

    if (existingEntry.promise) {
      return existingEntry.promise;
    }
  }

  const promise = loader()
    .then((value) => {
      scopedCacheStore.set(cacheKey, {
        value,
        expiresAt: Date.now() + input.ttlMs,
      });
      return value;
    })
    .catch((error) => {
      scopedCacheStore.delete(cacheKey);
      throw error;
    });

  scopedCacheStore.set(cacheKey, {
    promise,
    expiresAt: now + input.ttlMs,
  });

  return promise;
}

export function invalidateScopedCache(input: {
  namespace: string;
  organizationId?: string | null;
  keyPrefix?: string;
}) {
  const namespace = normalizeScopedCachePart(input.namespace);
  const cacheKeyPrefixParts = [namespace];

  if (input.organizationId !== undefined) {
    cacheKeyPrefixParts.push(normalizeScopedCachePart(input.organizationId));
  }

  if (input.keyPrefix !== undefined) {
    cacheKeyPrefixParts.push(normalizeScopedCachePart(input.keyPrefix));
  }

  const cacheKeyPrefix = cacheKeyPrefixParts.join("::");

  for (const cacheKey of scopedCacheStore.keys()) {
    if (
      cacheKey === cacheKeyPrefix ||
      cacheKey.startsWith(`${cacheKeyPrefix}::`)
    ) {
      scopedCacheStore.delete(cacheKey);
    }
  }
}

export function clearScopedCacheForTests() {
  scopedCacheStore.clear();
}
