import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const KanbanBoardMock = vi.hoisted(() => vi.fn(() => null));
const requireUserMock = vi.hoisted(() => vi.fn());
const getSavingCardsMock = vi.hoisted(() => vi.fn());
const getWorkspaceReadinessMock = vi.hoisted(() => vi.fn());
const captureExceptionMock = vi.hoisted(() => vi.fn());

vi.mock("@/components/kanban/kanban-board", () => ({
  KanbanBoard: KanbanBoardMock,
}));

vi.mock("@/lib/auth", () => ({
  requireUser: requireUserMock,
}));

vi.mock("@/lib/data", () => ({
  getSavingCards: getSavingCardsMock,
  getWorkspaceReadiness: getWorkspaceReadinessMock,
}));

vi.mock("@/lib/observability", () => ({
  captureException: captureExceptionMock,
}));

(globalThis as typeof globalThis & { React: typeof React }).React = React;

import KanbanPage from "@/app/(app)/kanban/page";

describe("kanban page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({
      id: "user-1",
      organizationId: "org-1",
    });
    getWorkspaceReadinessMock.mockResolvedValue(null);
  });

  it("passes loaded kanban data through to the board", async () => {
    getSavingCardsMock.mockResolvedValue([]);

    const page = await KanbanPage();
    const boardElement = page.props.children[1];

    expect(boardElement).toMatchObject({
      type: KanbanBoardMock,
      props: {
        initialCards: [],
        readiness: null,
        loadState: {
          cardsError: null,
          readinessError: null,
        },
      },
    });
  });

  it("surfaces kanban load failures instead of silently rendering an empty board", async () => {
    getSavingCardsMock.mockRejectedValue(new Error("Kanban query failed."));

    const page = await KanbanPage();
    const boardElement = page.props.children[1];

    expect(boardElement).toMatchObject({
      type: KanbanBoardMock,
      props: {
        initialCards: [],
        loadState: {
          cardsError:
            "Kanban board data could not be loaded right now. Refresh the page or try again in a moment.",
        },
      },
    });
    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        event: "kanban.page.cards_load_failed",
        route: "/kanban",
        organizationId: "org-1",
        userId: "user-1",
      })
    );
  });
});
