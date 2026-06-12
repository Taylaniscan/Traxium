import React from "react";
import { Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const MonthlyCloseViewMock = vi.hoisted(() => vi.fn(() => null));
const requireUserMock = vi.hoisted(() => vi.fn());
const getMonthlyCloseSummaryMock = vi.hoisted(() => vi.fn());
const captureExceptionMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  })
);

vi.mock("@/components/monthly-close/monthly-close-view", () => ({
  MonthlyCloseView: MonthlyCloseViewMock,
}));

vi.mock("@/lib/auth", () => ({
  requireUser: requireUserMock,
}));

vi.mock("@/lib/monthly-close-data", () => ({
  getMonthlyCloseSummary: getMonthlyCloseSummaryMock,
}));

vi.mock("@/lib/observability", () => ({
  captureException: captureExceptionMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

(globalThis as typeof globalThis & { React: typeof React }).React = React;

import MonthlyClosePage from "@/app/(app)/monthly-close/page";

function summaryFixture(overrides: Record<string, unknown> = {}) {
  return {
    month: "2026-03",
    monthLabel: "March 2026",
    totalCards: 3,
    closedCount: 1,
    missingActualsCount: 1,
    needsFinanceReviewCount: 1,
    totalForecastSavingsUSD: 600,
    totalActualSavingsUSD: 420,
    cards: [],
    ...overrides,
  };
}

// children: [SectionHeading, MonthlyCloseView]
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getViewElement(page: any): any {
  return page.props.children[1];
}

describe("monthly close page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({
      id: "user-1",
      role: Role.FINANCIAL_CONTROLLER,
      organizationId: "org-1",
    });
    getMonthlyCloseSummaryMock.mockResolvedValue(summaryFixture());
  });

  it("loads the requested month and passes the summary to the view", async () => {
    const page = await MonthlyClosePage({
      searchParams: Promise.resolve({ month: "2026-03" }),
    });
    const view = getViewElement(page);

    expect(getMonthlyCloseSummaryMock).toHaveBeenCalledWith(
      "org-1",
      new Date(Date.UTC(2026, 2, 1))
    );
    expect(view.type).toBe(MonthlyCloseViewMock);
    expect(view.props.summary.month).toBe("2026-03");
    expect(view.props.loadError).toBeNull();
    expect(view.props.monthOptions.some((option: { active: boolean }) => option.active)).toBe(
      true
    );
  });

  it("falls back to the last completed month when no month is provided", async () => {
    await MonthlyClosePage({});
    const [, monthArg] = getMonthlyCloseSummaryMock.mock.calls[0];
    const now = new Date();
    const expected = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    expect((monthArg as Date).getTime()).toBe(expected.getTime());
  });

  it("renders a degraded view and reports when the loader fails", async () => {
    getMonthlyCloseSummaryMock.mockRejectedValue(new Error("query failed"));

    const page = await MonthlyClosePage({
      searchParams: Promise.resolve({ month: "2026-03" }),
    });
    const view = getViewElement(page);

    expect(view.type).toBe(MonthlyCloseViewMock);
    expect(view.props.loadError).toMatch(/could not be loaded/i);
    expect(view.props.summary.totalCards).toBe(0);
    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        event: "monthly_close.page.load_failed",
        route: "/monthly-close",
        organizationId: "org-1",
        userId: "user-1",
      })
    );
  });

  it("redirects users without report access away from the view", async () => {
    requireUserMock.mockResolvedValue({
      id: "user-2",
      role: Role.TACTICAL_BUYER,
      organizationId: "org-1",
    });

    await expect(
      MonthlyClosePage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow("REDIRECT:/dashboard");
    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
    expect(getMonthlyCloseSummaryMock).not.toHaveBeenCalled();
  });
});
