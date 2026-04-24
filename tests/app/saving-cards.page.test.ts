import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const SavingCardTableMock = vi.hoisted(() => vi.fn(() => null));
const requireUserMock = vi.hoisted(() => vi.fn());
const getSavingCardsMock = vi.hoisted(() => vi.fn());
const getPendingApprovalsMock = vi.hoisted(() => vi.fn());
const getWorkspaceReadinessMock = vi.hoisted(() => vi.fn());
const captureExceptionMock = vi.hoisted(() => vi.fn());

vi.mock("@/components/saving-cards/saving-card-table", () => ({
  SavingCardTable: SavingCardTableMock,
}));

vi.mock("@/lib/auth", () => ({
  requireUser: requireUserMock,
}));

vi.mock("@/lib/data", () => ({
  getSavingCards: getSavingCardsMock,
  getPendingApprovals: getPendingApprovalsMock,
  getWorkspaceReadiness: getWorkspaceReadinessMock,
}));

vi.mock("@/lib/observability", () => ({
  captureException: captureExceptionMock,
}));

(globalThis as typeof globalThis & { React: typeof React }).React = React;

import SavingCardsPage from "@/app/(app)/saving-cards/page";

describe("saving cards page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({
      id: "user-1",
      organizationId: "org-1",
    });
    getSavingCardsMock.mockResolvedValue([]);
    getPendingApprovalsMock.mockResolvedValue([]);
    getWorkspaceReadinessMock.mockResolvedValue(null);
  });

  it("passes loaded cards and readiness through to the table", async () => {
    const page = await SavingCardsPage({
      searchParams: Promise.resolve({}),
    });
    const tableElement = page.props.children[1];

    expect(tableElement).toMatchObject({
      type: SavingCardTableMock,
      props: {
        cards: [],
        readiness: null,
        scope: "all",
        viewOptions: expect.arrayContaining([
          expect.objectContaining({ label: "All Cards", active: true }),
        ]),
      },
    });
    expect(getSavingCardsMock).toHaveBeenCalledWith("org-1", undefined);
  });

  it("keeps rendering a safe fallback and captures degraded page loads", async () => {
    getSavingCardsMock.mockRejectedValueOnce(new Error("Cards query failed."));
    getWorkspaceReadinessMock.mockRejectedValueOnce(
      new Error("Readiness query failed.")
    );

    const page = await SavingCardsPage({
      searchParams: Promise.resolve({}),
    });
    const tableElement = page.props.children[1];

    expect(tableElement).toMatchObject({
      type: SavingCardTableMock,
      props: {
        cards: [],
        readiness: null,
      },
    });
    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        event: "saving_cards.page.cards_load_failed",
        route: "/saving-cards",
        organizationId: "org-1",
        userId: "user-1",
      })
    );
    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        event: "saving_cards.page.readiness_load_failed",
        route: "/saving-cards",
        organizationId: "org-1",
        userId: "user-1",
      })
    );
  });

  it("loads stakeholder-scoped cards for the My Cards view", async () => {
    await SavingCardsPage({
      searchParams: Promise.resolve({ view: "mine" }),
    });

    expect(getSavingCardsMock).toHaveBeenCalledWith("org-1", {
      stakeholderUserId: "user-1",
    });
    expect(getPendingApprovalsMock).not.toHaveBeenCalled();
  });

  it("loads approval-scoped cards for the My Approvals view", async () => {
    getPendingApprovalsMock.mockResolvedValueOnce([
      {
        phaseChangeRequest: {
          savingCardId: "card-1",
        },
      },
      {
        phaseChangeRequest: {
          savingCardId: "card-2",
        },
      },
      {
        phaseChangeRequest: {
          savingCardId: "card-1",
        },
      },
    ]);

    const page = await SavingCardsPage({
      searchParams: Promise.resolve({ view: "approvals" }),
    });
    const tableElement = page.props.children[1];

    expect(getPendingApprovalsMock).toHaveBeenCalledWith("user-1", "org-1");
    expect(getSavingCardsMock).toHaveBeenCalledWith("org-1", {
      ids: ["card-1", "card-2"],
    });
    expect(tableElement).toMatchObject({
      props: {
        scope: "approvals",
      },
    });
  });
});
