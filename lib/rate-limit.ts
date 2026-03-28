import { createHash } from "node:crypto";

import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

type RateLimitScope = "ip" | "user" | "organization" | "organization-user";
type RateLimitFailureMode = "open" | "closed";

type RateLimitPolicy = {
  scope: RateLimitScope;
  maxRequests: number;
  windowMs: number;
  failureMode: RateLimitFailureMode;
};

type RateLimitStoreConsumeInput = {
  bucketKey: string;
  policy: string;
  action: string | null;
  scope: RateLimitScope;
  now: Date;
  expiresAt: Date;
};

type RateLimitStoreConsumeResult = {
  hits: number;
  resetAt: Date;
};

type PrismaRateLimitClient = Pick<typeof prisma, "$queryRaw"> & {
  rateLimitBucket?: {
    deleteMany(args: { where: { expiresAt: { lt: Date } } }): Promise<unknown>;
  };
};

type RateLimitComputationResult = {
  allowed: boolean;
  policy: RateLimitPolicyKey;
  key: string;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfterSeconds: number;
};

export type RateLimitStore = {
  kind: string;
  consume(input: RateLimitStoreConsumeInput): Promise<RateLimitStoreConsumeResult>;
  reset?(): void | Promise<void>;
};

export const rateLimitPolicies = {
  forgotPassword: {
    scope: "ip",
    maxRequests: 5,
    windowMs: 10 * 60 * 1000,
    failureMode: "closed",
  },
  resetPassword: {
    scope: "ip",
    maxRequests: 10,
    windowMs: 10 * 60 * 1000,
    failureMode: "closed",
  },
  savingCardMutation: {
    scope: "organization-user",
    maxRequests: 20,
    windowMs: 60 * 1000,
    failureMode: "closed",
  },
  savingCardUpdate: {
    scope: "organization-user",
    maxRequests: 30,
    windowMs: 60 * 1000,
    failureMode: "closed",
  },
  bulkImport: {
    scope: "organization-user",
    maxRequests: 3,
    windowMs: 15 * 60 * 1000,
    failureMode: "closed",
  },
  volumeImport: {
    scope: "organization-user",
    maxRequests: 6,
    windowMs: 15 * 60 * 1000,
    failureMode: "closed",
  },
  evidenceUpload: {
    scope: "organization-user",
    maxRequests: 10,
    windowMs: 5 * 60 * 1000,
    failureMode: "closed",
  },
  invitationCreate: {
    scope: "organization-user",
    maxRequests: 20,
    windowMs: 60 * 60 * 1000,
    failureMode: "closed",
  },
  adminMutation: {
    scope: "organization-user",
    maxRequests: 30,
    windowMs: 10 * 60 * 1000,
    failureMode: "closed",
  },
  dataExport: {
    scope: "organization-user",
    maxRequests: 12,
    windowMs: 15 * 60 * 1000,
    failureMode: "closed",
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
  action?: string | null;
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

type MemoryRateLimitEntry = {
  hits: number;
  resetAtMs: number;
};

type ConsumeRateLimitOptions = {
  action?: string | null;
  now?: Date;
  store?: RateLimitStore;
};

const RATE_LIMIT_PRUNE_INTERVAL_MS = 10 * 60 * 1000;
const RATE_LIMIT_BACKEND_RETRY_AFTER_SECONDS = 60;

let activeRateLimitStoreOverride: RateLimitStore | null = null;
let lastPrunedExpiredBucketsAtMs = 0;

export class RateLimitExceededError extends Error {
  constructor(
    message: string,
    readonly policy: RateLimitPolicyKey,
    readonly key: string,
    readonly limit: number,
    readonly remaining: number,
    readonly resetAt: Date,
    readonly retryAfterSeconds: number,
    readonly status: 429 | 503 = 429
  ) {
    super(message);
    this.name = "RateLimitExceededError";
  }
}

export class RateLimitBackendUnavailableError extends RateLimitExceededError {
  constructor(
    message: string,
    policy: RateLimitPolicyKey,
    key: string,
    limit: number,
    resetAt: Date,
    retryAfterSeconds: number
  ) {
    super(message, policy, key, limit, 0, resetAt, retryAfterSeconds, 503);
    this.name = "RateLimitBackendUnavailableError";
  }
}

function normalizeIdentifier(value: string | null | undefined, fieldName: string) {
  const normalized = value?.trim();

  if (!normalized) {
    throw new Error(`${fieldName} is required for rate limiting.`);
  }

  return normalized;
}

function normalizeAction(value: string | null | undefined) {
  const normalized = value?.trim();

  if (!normalized) {
    return null;
  }

  return normalized.replace(/[^a-zA-Z0-9._:-]+/gu, "-");
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

function buildIdentity(
  request: Request,
  input: Omit<EnforceRateLimitInput, "policy" | "message" | "request">
): RateLimitIdentity {
  return {
    ip: resolveRequestIp(request),
    userId: input.userId ?? null,
    organizationId: input.organizationId ?? null,
  };
}

function hashRateLimitKey(rawKey: string) {
  return createHash("sha256").update(rawKey).digest("hex");
}

function buildKeyPrefix(
  policy: RateLimitPolicyKey,
  action: string | null
) {
  const actionSegment = action ? `:action:${action}` : "";
  return `policy:${policy}${actionSegment}`;
}

const scopedKeyBuilders: Record<
  RateLimitScope,
  (
    prefix: string,
    identity: RateLimitIdentity
  ) => string
> = {
  ip: (prefix, identity) =>
    `${prefix}:ip:${normalizeIdentifier(identity.ip, "Rate limit IP")}`,
  user: (prefix, identity) =>
    `${prefix}:user:${normalizeIdentifier(identity.userId, "Rate limit user id")}`,
  organization: (prefix, identity) =>
    `${prefix}:org:${normalizeIdentifier(identity.organizationId, "Rate limit organization id")}`,
  "organization-user": (prefix, identity) =>
    [
      prefix,
      `org:${normalizeIdentifier(identity.organizationId, "Rate limit organization id")}`,
      `user:${normalizeIdentifier(identity.userId, "Rate limit user id")}`,
    ].join(":"),
};

function buildScopedKey(
  policy: RateLimitPolicyKey,
  identity: RateLimitIdentity,
  action: string | null
) {
  const config = rateLimitPolicies[policy] as RateLimitPolicy;
  const rawKey = scopedKeyBuilders[config.scope](
    buildKeyPrefix(policy, action),
    identity
  );

  return hashRateLimitKey(rawKey);
}

function toSafeInteger(value: bigint | number) {
  return typeof value === "bigint" ? Number(value) : value;
}

function maybePruneExpiredBuckets(
  client: PrismaRateLimitClient,
  now: Date
) {
  if (!client.rateLimitBucket) {
    return;
  }

  const nowMs = now.getTime();

  if (nowMs - lastPrunedExpiredBucketsAtMs < RATE_LIMIT_PRUNE_INTERVAL_MS) {
    return;
  }

  lastPrunedExpiredBucketsAtMs = nowMs;

  void client.rateLimitBucket
    .deleteMany({
      where: {
        expiresAt: {
          lt: now,
        },
      },
    })
    .catch(() => undefined);
}

export function createDatabaseRateLimitStore(
  client: PrismaRateLimitClient = prisma
): RateLimitStore {
  return {
    kind: "postgresql",
    async consume(input) {
      maybePruneExpiredBuckets(client, input.now);

      const rows = await client.$queryRaw<
        Array<{ hits: bigint | number; expiresAt: Date }>
      >(Prisma.sql`
        INSERT INTO "RateLimitBucket" (
          "bucketKey",
          "policy",
          "action",
          "scope",
          "hits",
          "windowStartedAt",
          "expiresAt",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${input.bucketKey},
          ${input.policy},
          ${input.action},
          ${input.scope},
          1,
          ${input.now},
          ${input.expiresAt},
          ${input.now},
          ${input.now}
        )
        ON CONFLICT ("bucketKey") DO UPDATE
        SET
          "policy" = EXCLUDED."policy",
          "action" = EXCLUDED."action",
          "scope" = EXCLUDED."scope",
          "hits" = CASE
            WHEN "RateLimitBucket"."expiresAt" <= ${input.now} THEN 1
            ELSE "RateLimitBucket"."hits" + 1
          END,
          "windowStartedAt" = CASE
            WHEN "RateLimitBucket"."expiresAt" <= ${input.now} THEN ${input.now}
            ELSE "RateLimitBucket"."windowStartedAt"
          END,
          "expiresAt" = CASE
            WHEN "RateLimitBucket"."expiresAt" <= ${input.now} THEN ${input.expiresAt}
            ELSE "RateLimitBucket"."expiresAt"
          END,
          "updatedAt" = ${input.now}
        RETURNING "hits", "expiresAt"
      `);

      const row = rows[0];

      if (!row) {
        throw new Error("Rate limit store did not return an updated bucket.");
      }

      return {
        hits: toSafeInteger(row.hits),
        resetAt: new Date(row.expiresAt),
      };
    },
  };
}

export function createMemoryRateLimitStore(
  sharedEntries: Map<string, MemoryRateLimitEntry> = new Map()
): RateLimitStore {
  return {
    kind: "memory-test",
    async consume(input) {
      const existing = sharedEntries.get(input.bucketKey);
      const nowMs = input.now.getTime();
      const nextEntry =
        !existing || existing.resetAtMs <= nowMs
          ? {
              hits: 1,
              resetAtMs: input.expiresAt.getTime(),
            }
          : {
              hits: existing.hits + 1,
              resetAtMs: existing.resetAtMs,
            };

      sharedEntries.set(input.bucketKey, nextEntry);

      return {
        hits: nextEntry.hits,
        resetAt: new Date(nextEntry.resetAtMs),
      };
    },
    reset() {
      sharedEntries.clear();
    },
  };
}

export function setRateLimitStoreForTests(store: RateLimitStore | null) {
  activeRateLimitStoreOverride = store;
}

export function resetRateLimitStore() {
  activeRateLimitStoreOverride?.reset?.();
  lastPrunedExpiredBucketsAtMs = 0;
}

function getRateLimitStore() {
  return activeRateLimitStoreOverride ?? createDatabaseRateLimitStore();
}

function buildRateLimitMessage(policy: RateLimitPolicyKey) {
  switch (policy) {
    case "forgotPassword":
      return "Too many password recovery attempts. Please try again later.";
    case "resetPassword":
      return "Too many password reset attempts. Please try again later.";
    case "savingCardMutation":
      return "Too many saving card creation attempts. Please slow down and try again shortly.";
    case "savingCardUpdate":
      return "Too many saving card update attempts. Please slow down and try again shortly.";
    case "bulkImport":
      return "Too many import attempts. Please wait before starting another import.";
    case "volumeImport":
      return "Too many volume import attempts. Please wait before uploading again.";
    case "evidenceUpload":
      return "Too many evidence upload attempts. Please wait before uploading again.";
    case "invitationCreate":
      return "Too many invitation attempts. Please wait before sending more invites.";
    case "adminMutation":
      return "Too many administrative change attempts. Please wait before trying again.";
    case "dataExport":
      return "Too many export attempts. Please wait before starting another export.";
  }
}

function buildRateLimitBackendUnavailableMessage(policy: RateLimitPolicyKey) {
  switch (policy) {
    case "forgotPassword":
    case "resetPassword":
      return "Rate limit protection is temporarily unavailable. Please retry shortly.";
    default:
      return "Request throttling is temporarily unavailable. Please retry shortly.";
  }
}

export async function consumeRateLimit(
  policy: RateLimitPolicyKey,
  identity: RateLimitIdentity,
  options: ConsumeRateLimitOptions = {}
): Promise<RateLimitComputationResult & { degraded: boolean }> {
  const config = rateLimitPolicies[policy] as RateLimitPolicy;
  const now = options.now ?? new Date();
  const action = normalizeAction(options.action);
  const key = buildScopedKey(policy, identity, action);
  const store = options.store ?? getRateLimitStore();
  const expiresAt = new Date(now.getTime() + config.windowMs);

  try {
    const result = await store.consume({
      bucketKey: key,
      policy,
      action,
      scope: config.scope,
      now,
      expiresAt,
    });
    const remaining = Math.max(0, config.maxRequests - result.hits);
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((result.resetAt.getTime() - now.getTime()) / 1000)
    );

    return {
      allowed: result.hits <= config.maxRequests,
      degraded: false,
      policy,
      key,
      limit: config.maxRequests,
      remaining,
      resetAt: result.resetAt,
      retryAfterSeconds,
    };
  } catch (error) {
    if (config.failureMode === "open") {
      return {
        allowed: true,
        degraded: true,
        policy,
        key,
        limit: config.maxRequests,
        remaining: config.maxRequests,
        resetAt: expiresAt,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil(config.windowMs / 1000)
        ),
      };
    }

    throw new RateLimitBackendUnavailableError(
      buildRateLimitBackendUnavailableMessage(policy),
      policy,
      key,
      config.maxRequests,
      new Date(
        now.getTime() + RATE_LIMIT_BACKEND_RETRY_AFTER_SECONDS * 1000
      ),
      RATE_LIMIT_BACKEND_RETRY_AFTER_SECONDS
    );
  }
}

export async function enforceRateLimit(
  input: EnforceRateLimitInput
): Promise<RateLimitResult> {
  const identity = buildIdentity(input.request, input);
  const result = await consumeRateLimit(input.policy, identity, {
    action: input.action,
  });

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
  const code =
    error instanceof RateLimitBackendUnavailableError
      ? "RATE_LIMIT_UNAVAILABLE"
      : "RATE_LIMITED";

  return NextResponse.json(
    {
      error: error.message,
      code,
    },
    {
      status: error.status,
      headers: {
        "Retry-After": String(error.retryAfterSeconds),
        "X-RateLimit-Limit": String(error.limit),
        "X-RateLimit-Remaining": String(error.remaining),
        "X-RateLimit-Reset": error.resetAt.toISOString(),
        "X-RateLimit-Policy": error.policy,
      },
    }
  );
}
