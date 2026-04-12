import { Prisma, UsageWindow, type UsageFeature } from "@prisma/client";

import { sanitizeForLog } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import {
  organizationQuotaSnapshotSelect,
  organizationUsageCounterSelect,
  organizationUsageEventSelect,
  type OrganizationQuotaSnapshotRecord,
  type OrganizationUsageCounterRecord,
  type OrganizationUsageEventRecord,
} from "@/lib/types";

const LIFETIME_PERIOD_START = new Date("1970-01-01T00:00:00.000Z");
const LIFETIME_PERIOD_END = new Date("9999-12-31T23:59:59.999Z");

type UsageTransactionClient = Pick<
  Prisma.TransactionClient,
  "usageEvent" | "usageCounter" | "quotaSnapshot"
>;
type UsageClient = UsageTransactionClient &
  Pick<typeof prisma, "$transaction">;
type UsageReadClient = Pick<
  typeof prisma,
  "usageCounter" | "quotaSnapshot"
>;

export type UsageMetadata = Record<string, unknown>;

export type UsagePeriodInput = {
  window: UsageWindow;
  at?: Date;
  periodStart?: Date;
  periodEnd?: Date;
};

export type UsagePeriod = {
  window: UsageWindow;
  periodStart: Date;
  periodEnd: Date;
};

export type UsageTrackingInput = UsagePeriodInput & {
  organizationId: string;
  feature: UsageFeature;
  quantity?: number;
  source: string;
  reason?: string | null;
  metadata?: UsageMetadata;
  recordedAt?: Date;
};

export type IncrementUsageCounterInput = UsagePeriodInput & {
  organizationId: string;
  feature: UsageFeature;
  quantity?: number;
  source: string;
  reason?: string | null;
  metadata?: UsageMetadata;
  lastEventAt?: Date;
};

export type GetCurrentUsageInput = UsagePeriodInput & {
  organizationId: string;
  feature: UsageFeature;
};

export type GetQuotaForFeatureInput = {
  organizationId: string;
  feature: UsageFeature;
  window: UsageWindow;
  at?: Date;
};

export type GetRemainingQuotaInput = UsagePeriodInput & {
  organizationId: string;
  feature: UsageFeature;
};

export type EnforceUsageQuotaInput = GetRemainingQuotaInput & {
  requestedQuantity?: number;
  message?: string;
};

export type RecordUsageEventResult = {
  event: OrganizationUsageEventRecord;
  counter: OrganizationUsageCounterRecord;
};

export type CurrentUsageResult = UsagePeriod & {
  organizationId: string;
  feature: UsageFeature;
  quantity: number;
  lastEventAt: Date | null;
  counter: OrganizationUsageCounterRecord | null;
};

export type RemainingQuotaResult = {
  quota: OrganizationQuotaSnapshotRecord | null;
  usage: CurrentUsageResult;
  remaining: number | null;
  isUnlimited: boolean;
  isExceeded: boolean;
};

export class UsageQuotaExceededError extends Error {
  constructor(
    message: string,
    readonly feature: UsageFeature,
    readonly remaining: number,
    readonly requestedQuantity: number,
    readonly status: 429 = 429
  ) {
    super(message);
    this.name = "UsageQuotaExceededError";
  }
}

type NormalizedUsageWrite = UsagePeriod & {
  organizationId: string;
  feature: UsageFeature;
  quantity: number;
  source: string;
  reason: string | null;
  metadata?: Prisma.InputJsonValue;
  recordedAt: Date;
};

type NormalizedUsageLookup = UsagePeriod & {
  organizationId: string;
  feature: UsageFeature;
  at: Date;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function normalizeDate(value: Date, fieldName: string) {
  const normalized = new Date(value);

  if (Number.isNaN(normalized.getTime())) {
    throw new Error(`${fieldName} must be a valid date.`);
  }

  return normalized;
}

function normalizeOrganizationId(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error("Usage organization id is required.");
  }

  return normalized;
}

function normalizeSource(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error("Usage source is required.");
  }

  return normalized;
}

function normalizeReason(value?: string | null) {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

function normalizeQuantity(value?: number) {
  const normalized = Math.trunc(value ?? 1);

  if (!Number.isFinite(normalized) || normalized === 0) {
    throw new Error("Usage quantity must be a non-zero integer.");
  }

  return normalized;
}

function normalizeRequestedQuantity(value?: number) {
  const normalized = Math.trunc(value ?? 1);

  if (!Number.isFinite(normalized) || normalized < 1) {
    throw new Error("Requested usage quantity must be a positive integer.");
  }

  return normalized;
}

function normalizeUsageMetadata(metadata?: UsageMetadata) {
  if (metadata === undefined) {
    return undefined;
  }

  const sanitizedMetadata = sanitizeForLog(metadata);

  if (!isPlainObject(sanitizedMetadata)) {
    return {};
  }

  return sanitizedMetadata as Prisma.InputJsonValue;
}

function createUtcDate(
  year: number,
  month: number,
  day: number,
  hours = 0,
  minutes = 0,
  seconds = 0,
  milliseconds = 0
) {
  return new Date(
    Date.UTC(year, month, day, hours, minutes, seconds, milliseconds)
  );
}

function getStartOfUtcDay(date: Date) {
  return createUtcDate(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  );
}

function getEndOfUtcDay(date: Date) {
  return createUtcDate(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    23,
    59,
    59,
    999
  );
}

function getStartOfUtcWeek(date: Date) {
  const dayOffset = (date.getUTCDay() + 6) % 7;
  const start = getStartOfUtcDay(date);
  start.setUTCDate(start.getUTCDate() - dayOffset);
  return start;
}

function getEndOfUtcWeek(date: Date) {
  const end = getStartOfUtcWeek(date);
  end.setUTCDate(end.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return end;
}

function getStartOfUtcMonth(date: Date) {
  return createUtcDate(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

function getEndOfUtcMonth(date: Date) {
  return createUtcDate(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    0,
    23,
    59,
    59,
    999
  );
}

function getStartOfUtcQuarter(date: Date) {
  const quarterStartMonth = Math.floor(date.getUTCMonth() / 3) * 3;

  return createUtcDate(date.getUTCFullYear(), quarterStartMonth, 1);
}

function getEndOfUtcQuarter(date: Date) {
  const quarterStartMonth = Math.floor(date.getUTCMonth() / 3) * 3;

  return createUtcDate(
    date.getUTCFullYear(),
    quarterStartMonth + 3,
    0,
    23,
    59,
    59,
    999
  );
}

function getStartOfUtcYear(date: Date) {
  return createUtcDate(date.getUTCFullYear(), 0, 1);
}

function getEndOfUtcYear(date: Date) {
  return createUtcDate(
    date.getUTCFullYear(),
    11,
    31,
    23,
    59,
    59,
    999
  );
}

function formatUsageFeatureLabel(feature: UsageFeature) {
  switch (feature) {
    case "SAVING_CARDS":
      return "saving card";
    case "ACTIVE_MEMBERS":
      return "active member";
    case "INVITATIONS_SENT":
      return "invitation";
    case "EVIDENCE_UPLOADS":
      return "evidence upload";
    case "API_REQUESTS":
      return "API request";
    case "JOB_EXECUTIONS":
      return "job execution";
  }
}

function buildQuotaExceededMessage(feature: UsageFeature) {
  return `The workspace has reached its ${formatUsageFeatureLabel(feature)} quota for the current period.`;
}

export function resolveUsagePeriod(input: UsagePeriodInput): UsagePeriod {
  if (input.periodStart || input.periodEnd) {
    if (!input.periodStart || !input.periodEnd) {
      throw new Error(
        "Both periodStart and periodEnd are required when providing explicit usage period bounds."
      );
    }

    const periodStart = normalizeDate(input.periodStart, "Usage period start");
    const periodEnd = normalizeDate(input.periodEnd, "Usage period end");

    if (periodEnd.getTime() < periodStart.getTime()) {
      throw new Error("Usage period end must be greater than or equal to period start.");
    }

    return {
      window: input.window,
      periodStart,
      periodEnd,
    };
  }

  const anchor = normalizeDate(input.at ?? new Date(), "Usage period anchor");

  switch (input.window) {
    case UsageWindow.LIFETIME:
      return {
        window: UsageWindow.LIFETIME,
        periodStart: new Date(LIFETIME_PERIOD_START),
        periodEnd: new Date(LIFETIME_PERIOD_END),
      };
    case UsageWindow.DAY:
      return {
        window: UsageWindow.DAY,
        periodStart: getStartOfUtcDay(anchor),
        periodEnd: getEndOfUtcDay(anchor),
      };
    case UsageWindow.WEEK:
      return {
        window: UsageWindow.WEEK,
        periodStart: getStartOfUtcWeek(anchor),
        periodEnd: getEndOfUtcWeek(anchor),
      };
    case UsageWindow.MONTH:
      return {
        window: UsageWindow.MONTH,
        periodStart: getStartOfUtcMonth(anchor),
        periodEnd: getEndOfUtcMonth(anchor),
      };
    case UsageWindow.QUARTER:
      return {
        window: UsageWindow.QUARTER,
        periodStart: getStartOfUtcQuarter(anchor),
        periodEnd: getEndOfUtcQuarter(anchor),
      };
    case UsageWindow.YEAR:
      return {
        window: UsageWindow.YEAR,
        periodStart: getStartOfUtcYear(anchor),
        periodEnd: getEndOfUtcYear(anchor),
      };
    default:
      return {
        window: input.window,
        periodStart: getStartOfUtcMonth(anchor),
        periodEnd: getEndOfUtcMonth(anchor),
      };
  }
}

function normalizeUsageWrite(input: UsageTrackingInput | IncrementUsageCounterInput): NormalizedUsageWrite {
  const resolvedPeriod = resolveUsagePeriod(input);

  return {
    organizationId: normalizeOrganizationId(input.organizationId),
    feature: input.feature,
    quantity: normalizeQuantity(input.quantity),
    source: normalizeSource(input.source),
    reason: normalizeReason(input.reason),
    metadata: normalizeUsageMetadata(input.metadata),
    recordedAt: normalizeDate(
      "recordedAt" in input && input.recordedAt
        ? input.recordedAt
        : "lastEventAt" in input && input.lastEventAt
          ? input.lastEventAt
          : new Date(),
      "Usage event timestamp"
    ),
    ...resolvedPeriod,
  };
}

function normalizeUsageLookup(
  input: GetCurrentUsageInput | GetQuotaForFeatureInput | GetRemainingQuotaInput
): NormalizedUsageLookup {
  const at = normalizeDate(input.at ?? new Date(), "Usage lookup timestamp");
  const resolvedPeriod = resolveUsagePeriod({
    window: input.window,
    at,
    periodStart: "periodStart" in input ? input.periodStart : undefined,
    periodEnd: "periodEnd" in input ? input.periodEnd : undefined,
  });

  return {
    organizationId: normalizeOrganizationId(input.organizationId),
    feature: input.feature,
    at,
    ...resolvedPeriod,
  };
}

function hasTransactionCapability(
  client: UsageClient | UsageTransactionClient
): client is UsageClient {
  return "$transaction" in client;
}

async function withUsageTransaction<T>(
  client: UsageClient | UsageTransactionClient,
  callback: (transactionClient: UsageTransactionClient) => Promise<T>
) {
  if (hasTransactionCapability(client)) {
    return client.$transaction(callback);
  }

  return callback(client);
}

function buildUsageCounterWhere(input: UsagePeriod & {
  organizationId: string;
  feature: UsageFeature;
}) {
  return {
    organizationId_feature_window_periodStart_periodEnd: {
      organizationId: input.organizationId,
      feature: input.feature,
      window: input.window,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
    },
  };
}

async function upsertUsageCounter(
  input: NormalizedUsageWrite,
  client: UsageTransactionClient | UsageReadClient
) {
  return client.usageCounter.upsert({
    where: buildUsageCounterWhere(input),
    update: {
      quantity: {
        increment: input.quantity,
      },
      source: input.source,
      reason: input.reason,
      ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
      lastEventAt: input.recordedAt,
    },
    create: {
      organizationId: input.organizationId,
      feature: input.feature,
      window: input.window,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      quantity: input.quantity,
      source: input.source,
      reason: input.reason,
      ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
      lastEventAt: input.recordedAt,
    },
    select: organizationUsageCounterSelect,
  });
}

export async function incrementUsageCounter(
  input: IncrementUsageCounterInput,
  client: UsageTransactionClient | UsageReadClient = prisma
): Promise<OrganizationUsageCounterRecord> {
  const normalizedInput = normalizeUsageWrite(input);

  return upsertUsageCounter(normalizedInput, client);
}

export async function recordUsageEvent(
  input: UsageTrackingInput,
  client: UsageClient | UsageTransactionClient = prisma
): Promise<RecordUsageEventResult> {
  const normalizedInput = normalizeUsageWrite(input);

  return withUsageTransaction(client, async (transactionClient) => {
    const event = await transactionClient.usageEvent.create({
      data: {
        organizationId: normalizedInput.organizationId,
        feature: normalizedInput.feature,
        quantity: normalizedInput.quantity,
        window: normalizedInput.window,
        periodStart: normalizedInput.periodStart,
        periodEnd: normalizedInput.periodEnd,
        source: normalizedInput.source,
        reason: normalizedInput.reason,
        ...(normalizedInput.metadata === undefined
          ? {}
          : { metadata: normalizedInput.metadata }),
        createdAt: normalizedInput.recordedAt,
      },
      select: organizationUsageEventSelect,
    });
    const counter = await upsertUsageCounter(normalizedInput, transactionClient);

    return {
      event,
      counter,
    };
  });
}

export async function getCurrentUsage(
  input: GetCurrentUsageInput,
  client: UsageReadClient = prisma
): Promise<CurrentUsageResult> {
  const normalizedInput = normalizeUsageLookup(input);
  const counter = await client.usageCounter.findUnique({
    where: buildUsageCounterWhere(normalizedInput),
    select: organizationUsageCounterSelect,
  });

  return {
    organizationId: normalizedInput.organizationId,
    feature: normalizedInput.feature,
    window: normalizedInput.window,
    periodStart: normalizedInput.periodStart,
    periodEnd: normalizedInput.periodEnd,
    quantity: counter?.quantity ?? 0,
    lastEventAt: counter?.lastEventAt ?? null,
    counter,
  };
}

export async function getQuotaForFeature(
  input: GetQuotaForFeatureInput,
  client: UsageReadClient = prisma
): Promise<OrganizationQuotaSnapshotRecord | null> {
  const normalizedInput = normalizeUsageLookup(input);

  return client.quotaSnapshot.findFirst({
    where: {
      organizationId: normalizedInput.organizationId,
      feature: normalizedInput.feature,
      window: normalizedInput.window,
      periodStart: {
        lte: normalizedInput.at,
      },
      periodEnd: {
        gte: normalizedInput.at,
      },
    },
    orderBy: [{ periodStart: "desc" }, { updatedAt: "desc" }],
    select: organizationQuotaSnapshotSelect,
  });
}

export async function getRemainingQuota(
  input: GetRemainingQuotaInput,
  client: UsageReadClient = prisma
): Promise<RemainingQuotaResult> {
  const normalizedInput = normalizeUsageLookup(input);
  const quota = await getQuotaForFeature(
    {
      organizationId: normalizedInput.organizationId,
      feature: normalizedInput.feature,
      window: normalizedInput.window,
      at: normalizedInput.at,
    },
    client
  );
  const usage = await getCurrentUsage(
    {
      organizationId: normalizedInput.organizationId,
      feature: normalizedInput.feature,
      window: normalizedInput.window,
      periodStart: quota?.periodStart ?? normalizedInput.periodStart,
      periodEnd: quota?.periodEnd ?? normalizedInput.periodEnd,
    },
    client
  );

  if (!quota || quota.limitQuantity === null) {
    return {
      quota,
      usage,
      remaining: null,
      isUnlimited: true,
      isExceeded: false,
    };
  }

  const remaining = quota.limitQuantity - usage.quantity;

  return {
    quota,
    usage,
    remaining,
    isUnlimited: false,
    isExceeded: remaining < 0,
  };
}

export async function enforceUsageQuota(
  input: EnforceUsageQuotaInput,
  client: UsageReadClient = prisma
): Promise<RemainingQuotaResult> {
  const requestedQuantity = normalizeRequestedQuantity(input.requestedQuantity);
  const remainingQuota = await getRemainingQuota(input, client);

  if (
    !remainingQuota.isUnlimited &&
    remainingQuota.remaining !== null &&
    remainingQuota.remaining < requestedQuantity
  ) {
    throw new UsageQuotaExceededError(
      input.message?.trim() || buildQuotaExceededMessage(input.feature),
      input.feature,
      remainingQuota.remaining,
      requestedQuantity
    );
  }

  return remainingQuota;
}
