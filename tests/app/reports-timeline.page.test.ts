import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createUtopiaTraxPortfolioCards,
  createUtopiaTraxReadiness,
  createUtopiaTraxReferenceData,
} from "../helpers/utopiatrax-demo-fixtures";

const TimelineBoardMock = vi.hoisted(() => vi.fn(() => null));
const requireUserMock = vi.hoisted(() => vi.fn());
const getSavingCardsMock = vi.hoisted(() => vi.fn());
const getReferenceDataMock = vi.hoisted(() => vi.fn());
const getWorkspaceReadinessMock = vi.hoisted(() => vi.fn());
const captureExceptionMock = vi.hoisted(() => vi.fn());

vi.mock("@/components/timeline/timeline-board", () => ({
  TimelineBoard: TimelineBoardMock,
}));

vi.mock("@/lib/auth", () => ({
  requireUser: requireUserMock,
}));

vi.mock("@/lib/data", () => ({
  getSavingCards: getSavingCardsMock,
  getReferenceData: getReferenceDataMock,
  getWorkspaceReadiness: getWorkspaceReadinessMock,
}));

vi.mock("@/lib/observability", () => ({
  captureException: captureExceptionMock,
}));

(globalThis as typeof globalThis & { React: typeof React }).React = React;

import ReportsTimelinePage from "@/app/(app)/reports/timeline/page";

// children: [SectionHeading, TimelineBoard]
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getBoardElement(page: any): any {
  return page.props.children[1];
}

describe("reports timeline page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({
      id: "user-1",
      organizationId: "org-1",
    });
    getSavingCardsMock.mockResolvedValue([]);
    getReferenceDataMock.mockResolvedValue({
      users: [],
      buyers: [],
      suppliers: [],
      materials: [],
      categories: [],
      plants: [],
      businessUnits: [],
      fxRates: [],
    });
    getWorkspaceReadinessMock.mockResolvedValue(null);
  });

  it("passes cards, filters, and readiness through to the timeline board", async () => {
    const page = await ReportsTimelinePage();
    const boardElement = getBoardElement(page);

    expect(boardElement).toMatchObject({
      type: TimelineBoardMock,
      props: {
        cards: [],
        filters: {
          categories: [],
          buyers: [],
          suppliers: [],
          businessUnits: [],
        },
        readiness: null,
      },
    });
    expect(boardElement.props.nowIso).toEqual(expect.any(String));
  });

  it("passes a populated UtopiaTrax timeline and filter set", async () => {
    getSavingCardsMock.mockResolvedValue(createUtopiaTraxPortfolioCards());
    getReferenceDataMock.mockResolvedValue(createUtopiaTraxReferenceData());
    getWorkspaceReadinessMock.mockResolvedValue(createUtopiaTraxReadiness());

    const page = await ReportsTimelinePage();
    const boardElement = getBoardElement(page);

    expect(boardElement.props.cards).toHaveLength(25);
    expect(boardElement.props.filters.categories).toHaveLength(6);
    expect(boardElement.props.filters.suppliers).toHaveLength(25);
    expect(boardElement.props.readiness.isWorkspaceReady).toBe(true);
  });

  it("keeps the timeline usable with empty fallbacks and captures each degraded dependency", async () => {
    getSavingCardsMock.mockRejectedValueOnce(new Error("Cards query failed."));
    getReferenceDataMock.mockRejectedValueOnce(
      new Error("Reference data query failed.")
    );
    getWorkspaceReadinessMock.mockRejectedValueOnce(
      new Error("Readiness query failed.")
    );

    const page = await ReportsTimelinePage();
    const boardElement = getBoardElement(page);

    expect(boardElement).toMatchObject({
      type: TimelineBoardMock,
      props: {
        cards: [],
        readiness: null,
      },
    });
    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        event: "reports.timeline.page.cards_load_failed",
        route: "/reports/timeline",
        organizationId: "org-1",
        userId: "user-1",
      })
    );
    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        event: "reports.timeline.page.reference_data_load_failed",
        route: "/reports/timeline",
      })
    );
    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        event: "reports.timeline.page.readiness_load_failed",
        route: "/reports/timeline",
      })
    );
  });
});
