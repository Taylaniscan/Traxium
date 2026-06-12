import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  organization: { findMany: vi.fn() },
  user: { findMany: vi.fn() },
  notification: { createMany: vi.fn() },
}));

const enqueueJob = vi.hoisted(() => vi.fn());
const getMonthlyCloseSummary = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/jobs", async () => {
  const actual = await vi.importActual<typeof import("@/lib/jobs")>("@/lib/jobs");
  return { ...actual, enqueueJob };
});
vi.mock("@/lib/monthly-close-data", () => ({ getMonthlyCloseSummary }));

import { jobTypes } from "@/lib/jobs";
import {
  buildMonthlyCloseReminderKey,
  enqueueDueMonthlyCloseReminders,
  processMonthlyCloseReminderJob,
} from "@/lib/monthly-close-reminder";

function summary(overrides: Record<string, unknown> = {}) {
  return {
    month: "2026-05",
    monthLabel: "May 2026",
    totalCards: 8,
    closedCount: 0,
    missingActualsCount: 6,
    needsFinanceReviewCount: 2,
    totalForecastSavingsUSD: 0,
    totalActualSavingsUSD: 0,
    cards: [],
    ...overrides,
  };
}

describe("enqueueDueMonthlyCloseReminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.organization.findMany.mockResolvedValue([
      { id: "org-a" },
      { id: "org-b" },
    ]);
    enqueueJob.mockResolvedValue({ id: "job-1" });
  });

  it("does nothing when the run is not on the first of the month", async () => {
    const result = await enqueueDueMonthlyCloseReminders({
      now: new Date("2026-06-12T03:00:00.000Z"),
    });
    expect(result.due).toBe(false);
    expect(result.enqueued).toBe(0);
    expect(enqueueJob).not.toHaveBeenCalled();
  });

  it("enqueues one idempotent job per org for the prior month on the 1st", async () => {
    const now = new Date("2026-06-01T00:05:00.000Z");
    const result = await enqueueDueMonthlyCloseReminders({ now });

    expect(result.due).toBe(true);
    expect(result.month).toBe("2026-05");
    expect(result.enqueued).toBe(2);
    expect(enqueueJob).toHaveBeenCalledTimes(2);
    expect(enqueueJob).toHaveBeenCalledWith({
      type: jobTypes.MONTHLY_CLOSE_REMINDER,
      organizationId: "org-a",
      idempotencyKey: buildMonthlyCloseReminderKey("org-a", "2026-05"),
      payload: { organizationId: "org-a", month: "2026-05" },
    });
  });

  it("uses a stable idempotency key so a second pass cannot duplicate", async () => {
    const now = new Date("2026-06-01T00:05:00.000Z");
    await enqueueDueMonthlyCloseReminders({ now });
    await enqueueDueMonthlyCloseReminders({ now });
    const keysForOrgA = enqueueJob.mock.calls
      .filter((call) => call[0].organizationId === "org-a")
      .map((call) => call[0].idempotencyKey);
    expect(new Set(keysForOrgA).size).toBe(1);
  });
});

describe("processMonthlyCloseReminderJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "user-1" },
      { id: "user-2" },
    ]);
    mockPrisma.notification.createMany.mockResolvedValue({ count: 2 });
  });

  it("notifies finance/owner recipients with the close counts", async () => {
    getMonthlyCloseSummary.mockResolvedValue(summary());

    await processMonthlyCloseReminderJob({
      job: {
        type: jobTypes.MONTHLY_CLOSE_REMINDER,
        organizationId: "org-a",
        payload: { organizationId: "org-a", month: "2026-05" },
      },
    } as never);

    expect(getMonthlyCloseSummary).toHaveBeenCalledWith(
      "org-a",
      new Date(Date.UTC(2026, 4, 1))
    );
    expect(mockPrisma.notification.createMany).toHaveBeenCalledTimes(1);
    const arg = mockPrisma.notification.createMany.mock.calls[0][0];
    expect(arg.data).toHaveLength(2);
    expect(arg.data[0]).toMatchObject({
      organizationId: "org-a",
      userId: "user-1",
      href: "/monthly-close?month=2026-05",
    });
    expect(arg.data[0].message).toContain("6 cards need actuals");
    expect(arg.data[0].message).toContain("2 need finance review");
    expect(arg.data[0].title).toContain("May");
  });

  it("does not create notifications when nothing needs attention", async () => {
    getMonthlyCloseSummary.mockResolvedValue(
      summary({ missingActualsCount: 0, needsFinanceReviewCount: 0 })
    );

    await processMonthlyCloseReminderJob({
      job: {
        type: jobTypes.MONTHLY_CLOSE_REMINDER,
        organizationId: "org-a",
        payload: { organizationId: "org-a", month: "2026-05" },
      },
    } as never);

    expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
  });

  it("ignores jobs with an unparseable month payload", async () => {
    await processMonthlyCloseReminderJob({
      job: {
        type: jobTypes.MONTHLY_CLOSE_REMINDER,
        organizationId: "org-a",
        payload: { organizationId: "org-a", month: "not-a-month" },
      },
    } as never);

    expect(getMonthlyCloseSummary).not.toHaveBeenCalled();
    expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
  });
});
