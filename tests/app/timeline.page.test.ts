import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

import TimelinePage from "@/app/(app)/timeline/page";

describe("timeline page", () => {
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
    const page = await TimelinePage();
    const boardElement = page.props.children[1];

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

  it("keeps the timeline usable with empty fallbacks and captures each degraded dependency", async () => {
    getSavingCardsMock.mockRejectedValueOnce(new Error("Cards query failed."));
    getReferenceDataMock.mockRejectedValueOnce(
      new Error("Reference data query failed.")
    );
    getWorkspaceReadinessMock.mockRejectedValueOnce(
      new Error("Readiness query failed.")
    );

    const page = await TimelinePage();
    const boardElement = page.props.children[1];

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
    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        event: "timeline.page.cards_load_failed",
        route: "/timeline",
        organizationId: "org-1",
        userId: "user-1",
      })
    );
    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        event: "timeline.page.reference_data_load_failed",
        route: "/timeline",
        organizationId: "org-1",
        userId: "user-1",
      })
    );
    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        event: "timeline.page.readiness_load_failed",
        route: "/timeline",
        organizationId: "org-1",
        userId: "user-1",
      })
    );
  });
});
