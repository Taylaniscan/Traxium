import React from "react";
import { Phase } from "@prisma/client";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useRouterMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: useRouterMock,
}));

(globalThis as typeof globalThis & { React: typeof React }).React = React;

import { OpenActionsList } from "@/components/open-actions/open-actions-list";

function createAction(overrides: Record<string, unknown> = {}) {
  return {
    id: "approval-1",
    requestId: "request-1",
    savingCardId: "card-1",
    savingCardTitle: "Resin renegotiation",
    requestedBy: "Jamie Doe",
    requestedAt: "2026-04-13T10:00:00.000Z",
    currentPhase: Phase.IDEA,
    requestedPhase: Phase.VALIDATED,
    comment: "Ready for review.",
    canDecide: true,
    pendingApproverSummary: "Assigned to you",
    ...overrides,
  };
}

describe("open actions list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRouterMock.mockReturnValue({
      refresh: vi.fn(),
    });
  });

  it("shows bulk approval for multiple assigned actions", () => {
    const markup = renderToStaticMarkup(
      React.createElement(OpenActionsList, {
        actions: [
          createAction(),
          createAction({
            id: "approval-2",
            requestId: "request-2",
            savingCardId: "card-2",
            savingCardTitle: "Film supplier validation",
          }),
        ],
        view: "mine",
      })
    );

    expect(markup).toContain("Approve All");
    expect(markup).toContain("Assigned to you");
  });

  it("hides bulk approval in the workspace-wide queue", () => {
    const markup = renderToStaticMarkup(
      React.createElement(OpenActionsList, {
        actions: [
          createAction(),
          createAction({
            id: "approval-2",
            requestId: "request-2",
            savingCardId: "card-2",
            savingCardTitle: "Film supplier validation",
          }),
        ],
        view: "all",
      })
    );

    expect(markup).not.toContain("Approve All");
    expect(markup).toContain("Workspace Workflow Filters");
  });
});
