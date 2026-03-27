import { NextResponse } from "next/server";

type RateLimitStoreEntry = {
  count: number;
  resetAtMs: number;
};

type RateLimitStoreState = {
  entries: Map<string, RateLimitStoreEntry>;
  lastSweepAtMs: number;
};

type GlobalWithRateLimitStore = typeof globalThis & {
  __traxiumRateLimitStore?: RateLimitStoreState;
};

type RateLimitScope = "ip" | "user" | "organization" | "organization-user";

type RateLimitPolicy = {
  scope: RateLimitScope;
  maxRequests: number;
  windowMs: number;
};

export const rateLimitPolicies = {
  forgotPassword: {
    scope: "ip",
    maxRequests: 5,
    windowMs: 10 * 60 * 1000,
  },
  resetPassword: {
    scope: "ip",
    maxRequests: 10,
    windowMs: 10 * 60 * 1000,
  },
  savingCardMutation: {
    scope: "organization-user",
    maxRequests: 20,
    windowMs: 60 * 1000,
  },
  bulkImport: {
    scope: "organization-user",
    maxRequests: 3,
    windowMs: 15 * 60 * 1000,
  },
  evidenceUpload: {
    scope: "organization-user",
    maxRequests: 10,
    windowMs: 5 * 60 * 1000,
  },
  invitationCreate: {
    scope: "organization-user",
    maxRequests: 20,
    windowMs: 60 * 60 * 1000,
  },
} as const satisfies Record<string, RateLimitPolicy>;

export type RateLimitPolicyKey = keyof typeof rateLimitPolicies;

export type RateLimitIdentity = {
  ip?: string | null;
  userId?: string | null;
  organizationId?: string | null;
};

export type EnforceRateLimitInput = {
  policy: RateLimitPolicyKey;
  request: Request;
  userId?: string | null;
  organizationId?: string | null;
  message?: string;
};

export type RateLimitResult = {
  policy: RateLimitPolicyKey;
  key: string;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfterSeconds: number;
};

export class RateLimitExceededError extends Error {
  constructor(
    message: string,
    readonly policy: RateLimitPolicyKey,
    readonly key: string,
    readonly limit: number,
    readonly remaining: number,
    readonly resetAt: Date,
    readonly retryAfterSeconds: number,
    readonly status: 429 = 429
  ) {
    super(message);
    this.name = "RateLimitExceededError";
  }
}

function getStore() {
  const globalWithStore = globalThis as GlobalWithRateLimitStore;

  if (!globalWithStore.__traxiumRateLimitStore) {
    globalWithStore.__traxiumRateLimitStore = {
      entries: new Map(),
      lastSweepAtMs: 0,
    };
  }

  return globalWithStore.__traxiumRateLimitStore;
}

function normalizeIdentifier(value: string | null | undefined, fieldName: string) {
  const normalized = value?.trim();

  if (!normalized) {
    throw new Error(`${fieldName} is required for rate limiting.`);
  }

  return normalized;
}

function resolveRequestIp(request: Request) {
  const headerNames = [
    "x-forwarded-for",
    "x-real-ip",
    "cf-connecting-ip",
    "x-vercel-forwarded-for",
  ];

  for (const name of headerNames) {
    const value = request.headers.get(name)?.trim();

    if (!value) {
      continue;
    }

    const [firstHop = ""] = value.split(",");
    const normalized = firstHop.trim();

    if (normalized) {
      return normalized;
    }
  }

  return "unknown";
}

function buildIdentity(request: Request, input: Omit<EnforceRateLimitInput, "policy" | "message" | "request">): RateLimitIdentity {
  return {
    ip: resolveRequestIp(request),
    userId: input.userId ?? null,
    organizationId: input.organizationId ?? null,
  };
}

const scopedKeyBuilders: Record<
  RateLimitScope,
  (policy: RateLimitPolicyKey, identity: RateLimitIdentity) => string
> = {
  ip: (policy, identity) =>
    `policy:${policy}:ip:${normalizeIdentifier(identity.ip, "Rate limit IP")}`,
  user: (policy, identity) =>
    `policy:${policy}:user:${normalizeIdentifier(identity.userId, "Rate limit user id")}`,
  organization: (policy, identity) =>
    `policy:${policy}:org:${normalizeIdentifier(identity.organizationId, "Rate limit organization id")}`,
  "organization-user": (policy, identity) =>
    [
      `policy:${policy}`,
      `org:${normalizeIdentifier(identity.organizationId, "Rate limit organization id")}`,
      `user:${normalizeIdentifier(identity.userId, "Rate limit user id")}`,
    ].join(":"),
};

function buildScopedKey(policy: RateLimitPolicyKey, identity: RateLimitIdentity) {
  const config = rateLimitPolicies[policy];
  return scopedKeyBuilders[config.scope](policy, identity);
}

function maybeSweepExpiredEntries(nowMs: number) {
  const store = getStore();

  if (nowMs - store.lastSweepAtMs < 60_000) {
    return;
  }

  for (const [key, entry] of store.entries.entries()) {
    if (entry.resetAtMs <= nowMs) {
      store.entries.delete(key);
    }
  }

  store.lastSweepAtMs = nowMs;
}

function buildRateLimitMessage(policy: RateLimitPolicyKey) {
  switch (policy) {
    case "forgotPassword":
      return "Too many password recovery attempts. Please try again later.";
    case "resetPassword":
      return "Too many password reset attempts. Please try again later.";
    case "savingCardMutation":
      return "Too many saving card creation attempts. Please slow down and try again shortly.";
    case "bulkImport":
      return "Too many import attempts. Please wait before starting another import.";
    case "evidenceUpload":
      return "Too many evidence upload attempts. Please wait before uploading again.";
    case "invitationCreate":
      return "Too many invitation attempts. Please wait before sending more invites.";
  }
}

export function resetRateLimitStore() {
  const store = getStore();
  store.entries.clear();
  store.lastSweepAtMs = 0;
}

export function consumeRateLimit(
  policy: RateLimitPolicyKey,
  identity: RateLimitIdentity,
  nowMs = Date.now()
) {
  maybeSweepExpiredEntries(nowMs);

  const config = rateLimitPolicies[policy];
  const key = buildScopedKey(policy, identity);
  const store = getStore();
  const existing = store.entries.get(key);
  const nextEntry =
    !existing || existing.resetAtMs <= nowMs
      ? {
          count: 1,
          resetAtMs: nowMs + config.windowMs,
        }
      : {
          count: existing.count + 1,
          resetAtMs: existing.resetAtMs,
        };

  store.entries.set(key, nextEntry);

  const remaining = Math.max(0, config.maxRequests - nextEntry.count);
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((nextEntry.resetAtMs - nowMs) / 1000)
  );

  return {
    allowed: nextEntry.count <= config.maxRequests,
    policy,
    key,
    limit: config.maxRequests,
    remaining,
    resetAt: new Date(nextEntry.resetAtMs),
    retryAfterSeconds,
  };
}

export async function enforceRateLimit(
  input: EnforceRateLimitInput
): Promise<RateLimitResult> {
  const identity = buildIdentity(input.request, input);
  const result = consumeRateLimit(input.policy, identity);

  if (!result.allowed) {
    throw new RateLimitExceededError(
      input.message?.trim() || buildRateLimitMessage(input.policy),
      result.policy,
      result.key,
      result.limit,
      result.remaining,
      result.resetAt,
      result.retryAfterSeconds
    );
  }

  return {
    policy: result.policy,
    key: result.key,
    limit: result.limit,
    remaining: result.remaining,
    resetAt: result.resetAt,
    retryAfterSeconds: result.retryAfterSeconds,
  };
}

export function createRateLimitErrorResponse(error: RateLimitExceededError) {
  return NextResponse.json(
    {
      error: error.message,
      code: "RATE_LIMITED",
    },
    {
      status: error.status,
      headers: {
        "Retry-After": String(error.retryAfterSeconds),
        "X-RateLimit-Limit": String(error.limit),
        "X-RateLimit-Remaining": String(error.remaining),
        "X-RateLimit-Reset": error.resetAt.toISOString(),
      },
    }
  );
}
