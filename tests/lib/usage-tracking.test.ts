import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UsageFeature, UsageWindow } from "@prisma/client";

import { DEFAULT_ORGANIZATION_ID, OTHER_ORGANIZATION_ID } from "../helpers/security-fixtures";

const mockPrisma = vi.hoisted(() => {
  const client = {
    $transaction: vi.fn(),
    usageEvent: {
      create: vi.fn(),
    },
    usageCounter: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
    },
    quotaSnapshot: {
      findFirst: vi.fn(),
    },
  };

  client.$transaction.mockImplementation(async (callback: (tx: typeof client) => unknown) =>
    callback(client)
  );

  return client;
});

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import {
  enforceUsageQuota,
  getCurrentUsage,
  getQuotaForFeature,
  getRemainingQuota,
  incrementUsageCounter,
  recordUsageEvent,
  UsageQuotaExceededError,
} from "@/lib/usage";

function createUsageCounterRecord(
  overrides: Partial<{
    id: string;
    organizationId: string;
    feature: UsageFeature;
    window: UsageWindow;
    periodStart: Date;
    periodEnd: Date;
    quantity: number;
    source: string;
    reason: string | null;
    metadata: Record<string, unknown> | null;
    lastEventAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }> = {}
) {
  return {
    id: "usage-counter-1",
    organizationId: DEFAULT_ORGANIZATION_ID,
    feature: UsageFeature.SAVING_CARDS,
    window: UsageWindow.MONTH,
    periodStart: new Date("2026-03-01T00:00:00.000Z"),
    periodEnd: new Date("2026-03-31T23:59:59.999Z"),
    quantity: 3,
    source: "saving-card.create",
    reason: "portfolio_growth",
    metadata: {
      actorUserId: "user-1",
    },
    lastEventAt: new Date("2026-03-27T09:00:00.000Z"),
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
    updatedAt: new Date("2026-03-27T09:00:00.000Z"),
    ...overrides,
  };
}

function createUsageEventRecord(
  overrides: Partial<{
    id: string;
    organizationId: string;
    feature: UsageFeature;
    quantity: number;
    window: UsageWindow;
    periodStart: Date;
    periodEnd: Date;
    source: string;
    reason: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: Date;
  }> = {}
) {
  return {
    id: "usage-event-1",
    organizationId: DEFAULT_ORGANIZATION_ID,
    feature: UsageFeature.SAVING_CARDS,
    quantity: 1,
    window: UsageWindow.MONTH,
    periodStart: new Date("2026-03-01T00:00:00.000Z"),
    periodEnd: new Date("2026-03-31T23:59:59.999Z"),
    source: "saving-card.create",
    reason: "portfolio_growth",
    metadata: {
      actorUserId: "user-1",
    },
    createdAt: new Date("2026-03-27T09:00:00.000Z"),
    ...overrides,
  };
}

function createQuotaSnapshotRecord(
  overrides: Partial<{
    id: string;
    organizationId: string;
    feature: UsageFeature;
    window: UsageWindow;
    periodStart: Date;
    periodEnd: Date;
    limitQuantity: number | null;
    source: string;
    reason: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: Date;
    updatedAt: Date;
  }> = {}
) {
  return {
    id: "quota-1",
    organizationId: DEFAULT_ORGANIZATION_ID,
    feature: UsageFeature.SAVING_CARDS,
    window: UsageWindow.MONTH,
    periodStart: new Date("2026-03-01T00:00:00.000Z"),
    periodEnd: new Date("2026-03-31T23:59:59.999Z"),
    limitQuantity: 10,
    source: "manual",
    reason: "launch_limit",
    metadata: {
      setBy: "admin-user-1",
    },
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
    updatedAt: new Date("2026-03-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("lib/usage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes an append-only usage event and synchronizes the counter in one transaction", async () => {
    const recordedAt = new Date("2026-03-27T09:00:00.000Z");
    const eventRecord = createUsageEventRecord({
      createdAt: recordedAt,
    });
    const counterRecord = createUsageCounterRecord({
      quantity: 4,
      lastEventAt: recordedAt,
      updatedAt: recordedAt,
    });
    mockPrisma.usageEvent.create.mockResolvedValueOnce(eventRecord);
    mockPrisma.usageCounter.upsert.mockResolvedValueOnce(counterRecord);

    const result = await recordUsageEvent({
      organizationId: DEFAULT_ORGANIZATION_ID,
      feature: UsageFeature.SAVING_CARDS,
      quantity: 1,
      window: UsageWindow.MONTH,
      periodStart: new Date("2026-03-01T00:00:00.000Z"),
      periodEnd: new Date("2026-03-31T23:59:59.999Z"),
      source: "saving-card.create",
      reason: "portfolio_growth",
      metadata: {
        actorUserId: "user-1",
        token: "secret-token",
      },
      recordedAt,
    });

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.usageEvent.create).toHaveBeenCalledWith({
      data: {
        organizationId: DEFAULT_ORGANIZATION_ID,
        feature: UsageFeature.SAVING_CARDS,
        quantity: 1,
        window: UsageWindow.MONTH,
        periodStart: new Date("2026-03-01T00:00:00.000Z"),
        periodEnd: new Date("2026-03-31T23:59:59.999Z"),
        source: "saving-card.create",
        reason: "portfolio_growth",
        metadata: {
          actorUserId: "user-1",
          token: "[REDACTED]",
        },
        createdAt: recordedAt,
      },
      select: expect.objectContaining({
        organizationId: true,
        feature: true,
        quantity: true,
      }),
    });
    expect(mockPrisma.usageCounter.upsert).toHaveBeenCalledWith({
      where: {
        organizationId_feature_window_periodStart_periodEnd: {
          organizationId: DEFAULT_ORGANIZATION_ID,
          feature: UsageFeature.SAVING_CARDS,
          window: UsageWindow.MONTH,
          periodStart: new Date("2026-03-01T00:00:00.000Z"),
          periodEnd: new Date("2026-03-31T23:59:59.999Z"),
        },
      },
      update: {
        quantity: {
          increment: 1,
        },
        source: "saving-card.create",
        reason: "portfolio_growth",
        metadata: {
          actorUserId: "user-1",
          token: "[REDACTED]",
        },
        lastEventAt: recordedAt,
      },
      create: {
        organizationId: DEFAULT_ORGANIZATION_ID,
        feature: UsageFeature.SAVING_CARDS,
        window: UsageWindow.MONTH,
        periodStart: new Date("2026-03-01T00:00:00.000Z"),
        periodEnd: new Date("2026-03-31T23:59:59.999Z"),
        quantity: 1,
        source: "saving-card.create",
        reason: "portfolio_growth",
        metadata: {
          actorUserId: "user-1",
          token: "[REDACTED]",
        },
        lastEventAt: recordedAt,
      },
      select: expect.objectContaining({
        organizationId: true,
        feature: true,
        quantity: true,
      }),
    });
    expect(result).toEqual({
      event: eventRecord,
      counter: counterRecord,
    });
  });

  it("increments usage counters with the expected organization, feature, and period unique key", async () => {
    const counterRecord = createUsageCounterRecord({
      quantity: 7,
    });
    mockPrisma.usageCounter.upsert.mockResolvedValueOnce(counterRecord);

    const result = await incrementUsageCounter({
      organizationId: DEFAULT_ORGANIZATION_ID,
      feature: UsageFeature.INVITATIONS_SENT,
      quantity: 2,
      window: UsageWindow.DAY,
      at: new Date("2026-03-27T14:15:00.000Z"),
      source: "invitation.send",
      reason: "team_growth",
    });

    expect(mockPrisma.usageCounter.upsert).toHaveBeenCalledWith({
      where: {
        organizationId_feature_window_periodStart_periodEnd: {
          organizationId: DEFAULT_ORGANIZATION_ID,
          feature: UsageFeature.INVITATIONS_SENT,
          window: UsageWindow.DAY,
          periodStart: new Date("2026-03-27T00:00:00.000Z"),
          periodEnd: new Date("2026-03-27T23:59:59.999Z"),
        },
      },
      update: {
        quantity: {
          increment: 2,
        },
        source: "invitation.send",
        reason: "team_growth",
        lastEventAt: expect.any(Date),
      },
      create: {
        organizationId: DEFAULT_ORGANIZATION_ID,
        feature: UsageFeature.INVITATIONS_SENT,
        window: UsageWindow.DAY,
        periodStart: new Date("2026-03-27T00:00:00.000Z"),
        periodEnd: new Date("2026-03-27T23:59:59.999Z"),
        quantity: 2,
        source: "invitation.send",
        reason: "team_growth",
        lastEventAt: expect.any(Date),
      },
      select: expect.objectContaining({
        organizationId: true,
        feature: true,
        quantity: true,
      }),
    });
    expect(result).toEqual(counterRecord);
  });

  it("computes quota usage and remaining capacity from the active organization snapshot", async () => {
    const quotaRecord = createQuotaSnapshotRecord({
      limitQuantity: 10,
    });
    const counterRecord = createUsageCounterRecord({
      quantity: 4,
    });
    mockPrisma.quotaSnapshot.findFirst
      .mockResolvedValueOnce(quotaRecord)
      .mockResolvedValueOnce(quotaRecord);
    mockPrisma.usageCounter.findUnique.mockResolvedValueOnce(counterRecord);

    const quota = await getQuotaForFeature({
      organizationId: DEFAULT_ORGANIZATION_ID,
      feature: UsageFeature.SAVING_CARDS,
      window: UsageWindow.MONTH,
      at: new Date("2026-03-27T12:00:00.000Z"),
    });
    const remaining = await getRemainingQuota({
      organizationId: DEFAULT_ORGANIZATION_ID,
      feature: UsageFeature.SAVING_CARDS,
      window: UsageWindow.MONTH,
      at: new Date("2026-03-27T12:00:00.000Z"),
    });

    expect(mockPrisma.quotaSnapshot.findFirst).toHaveBeenCalledWith({
      where: {
        organizationId: DEFAULT_ORGANIZATION_ID,
        feature: UsageFeature.SAVING_CARDS,
        window: UsageWindow.MONTH,
        periodStart: {
          lte: new Date("2026-03-27T12:00:00.000Z"),
        },
        periodEnd: {
          gte: new Date("2026-03-27T12:00:00.000Z"),
        },
      },
      orderBy: [{ periodStart: "desc" }, { updatedAt: "desc" }],
      select: expect.objectContaining({
        organizationId: true,
        feature: true,
        limitQuantity: true,
      }),
    });
    expect(quota).toEqual(quotaRecord);
    expect(remaining).toEqual({
      quota: quotaRecord,
      usage: {
        organizationId: DEFAULT_ORGANIZATION_ID,
        feature: UsageFeature.SAVING_CARDS,
        window: UsageWindow.MONTH,
        periodStart: new Date("2026-03-01T00:00:00.000Z"),
        periodEnd: new Date("2026-03-31T23:59:59.999Z"),
        quantity: 4,
        lastEventAt: counterRecord.lastEventAt,
        counter: counterRecord,
      },
      remaining: 6,
      isUnlimited: false,
      isExceeded: false,
    });
  });

  it("preserves organization isolation when reading current usage", async () => {
    mockPrisma.usageCounter.findUnique.mockResolvedValueOnce(null);

    const result = await getCurrentUsage({
      organizationId: OTHER_ORGANIZATION_ID,
      feature: UsageFeature.ACTIVE_MEMBERS,
      window: UsageWindow.MONTH,
      periodStart: new Date("2026-03-01T00:00:00.000Z"),
      periodEnd: new Date("2026-03-31T23:59:59.999Z"),
    });

    expect(mockPrisma.usageCounter.findUnique).toHaveBeenCalledWith({
      where: {
        organizationId_feature_window_periodStart_periodEnd: {
          organizationId: OTHER_ORGANIZATION_ID,
          feature: UsageFeature.ACTIVE_MEMBERS,
          window: UsageWindow.MONTH,
          periodStart: new Date("2026-03-01T00:00:00.000Z"),
          periodEnd: new Date("2026-03-31T23:59:59.999Z"),
        },
      },
      select: expect.objectContaining({
        organizationId: true,
        feature: true,
        quantity: true,
      }),
    });
    expect(result).toEqual({
      organizationId: OTHER_ORGANIZATION_ID,
      feature: UsageFeature.ACTIVE_MEMBERS,
      window: UsageWindow.MONTH,
      periodStart: new Date("2026-03-01T00:00:00.000Z"),
      periodEnd: new Date("2026-03-31T23:59:59.999Z"),
      quantity: 0,
      lastEventAt: null,
      counter: null,
    });
  });

  it("rejects writes that would exceed the organization quota", async () => {
    const quotaRecord = createQuotaSnapshotRecord({
      limitQuantity: 3,
    });
    const counterRecord = createUsageCounterRecord({
      quantity: 3,
    });
    mockPrisma.quotaSnapshot.findFirst.mockResolvedValueOnce(quotaRecord);
    mockPrisma.usageCounter.findUnique.mockResolvedValueOnce(counterRecord);

    await expect(
      enforceUsageQuota({
        organizationId: DEFAULT_ORGANIZATION_ID,
        feature: UsageFeature.SAVING_CARDS,
        window: UsageWindow.MONTH,
        requestedQuantity: 1,
        at: new Date("2026-03-27T12:00:00.000Z"),
        message: "Saving card quota exceeded for the current period.",
      })
    ).rejects.toMatchObject(
      new UsageQuotaExceededError(
        "Saving card quota exceeded for the current period.",
        UsageFeature.SAVING_CARDS,
        0,
        1
      )
    );
  });
});
