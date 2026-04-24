import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const OpenActionsListMock = vi.hoisted(() => vi.fn(() => null));
const requireUserMock = vi.hoisted(() => vi.fn());
const getPendingApprovalsMock = vi.hoisted(() => vi.fn());
const getPendingPhaseChangeRequestsMock = vi.hoisted(() => vi.fn());
const getWorkspaceReadinessMock = vi.hoisted(() => vi.fn());
const captureExceptionMock = vi.hoisted(() => vi.fn());

vi.mock("@/components/open-actions/open-actions-list", () => ({
  OpenActionsList: OpenActionsListMock,
}));

vi.mock("@/lib/auth", () => ({
  requireUser: requireUserMock,
}));

vi.mock("@/lib/data", () => ({
  getPendingApprovals: getPendingApprovalsMock,
  getPendingPhaseChangeRequests: getPendingPhaseChangeRequestsMock,
  getWorkspaceReadiness: getWorkspaceReadinessMock,
}));

vi.mock("@/lib/observability", () => ({
  captureException: captureExceptionMock,
}));

(globalThis as typeof globalThis & { React: typeof React }).React = React;

import OpenActionsPage from "@/app/(app)/open-actions/page";

describe("open actions page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({
      id: "user-1",
      organizationId: "org-1",
    });
    getPendingApprovalsMock.mockResolvedValue([
      {
        id: "approval-1",
        phaseChangeRequest: {
          id: "request-1",
          savingCard: {
            id: "card-1",
            title: "Resin renegotiation",
          },
          requestedBy: {
            name: "Jamie Doe",
          },
          createdAt: new Date("2026-04-13T10:00:00.000Z"),
          currentPhase: "IDEA",
          requestedPhase: "VALIDATED",
          comment: "Ready for review.",
        },
      },
    ]);
    getPendingPhaseChangeRequestsMock.mockResolvedValue([]);
    getWorkspaceReadinessMock.mockResolvedValue(null);
  });

  it("maps pending approvals into action-list props", async () => {
    const page = await OpenActionsPage({
      searchParams: Promise.resolve({}),
    });
    const listElement = page.props.children[1];

    expect(listElement).toMatchObject({
      type: OpenActionsListMock,
      props: {
        actions: [
          {
            id: "approval-1",
            requestId: "request-1",
            savingCardId: "card-1",
            savingCardTitle: "Resin renegotiation",
            requestedBy: "Jamie Doe",
            requestedAt: "2026-04-13T10:00:00.000Z",
            currentPhase: "IDEA",
            requestedPhase: "VALIDATED",
            comment: "Ready for review.",
            canDecide: true,
            pendingApproverSummary: "Assigned to you",
          },
        ],
        readiness: null,
        view: "mine",
      },
    });
  });

  it("keeps rendering an empty actions fallback and captures partial failures", async () => {
    getPendingApprovalsMock.mockRejectedValueOnce(
      new Error("Approvals query failed.")
    );
    getWorkspaceReadinessMock.mockRejectedValueOnce(
      new Error("Readiness query failed.")
    );

    const page = await OpenActionsPage({
      searchParams: Promise.resolve({}),
    });
    const listElement = page.props.children[1];

    expect(listElement).toMatchObject({
      type: OpenActionsListMock,
      props: {
        actions: [],
        readiness: null,
      },
    });
    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        event: "open_actions.page.actions_load_failed",
        route: "/open-actions",
        organizationId: "org-1",
        userId: "user-1",
      })
    );
    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        event: "open_actions.page.readiness_load_failed",
        route: "/open-actions",
        organizationId: "org-1",
        userId: "user-1",
      })
    );
  });

  it("maps workspace-wide pending requests into a portfolio view", async () => {
    getPendingPhaseChangeRequestsMock.mockResolvedValueOnce([
      {
        id: "request-1",
        savingCard: {
          id: "card-1",
          title: "Resin renegotiation",
        },
        requestedBy: {
          name: "Jamie Doe",
        },
        approvals: [
          {
            approverId: "user-1",
            approver: {
              role: "HEAD_OF_GLOBAL_PROCUREMENT",
            },
          },
          {
            approverId: "user-2",
            approver: {
              role: "FINANCIAL_CONTROLLER",
            },
          },
        ],
        createdAt: new Date("2026-04-13T10:00:00.000Z"),
        currentPhase: "IDEA",
        requestedPhase: "VALIDATED",
        comment: "Ready for review.",
      },
    ]);

    const page = await OpenActionsPage({
      searchParams: Promise.resolve({ view: "all" }),
    });
    const listElement = page.props.children[1];

    expect(getPendingPhaseChangeRequestsMock).toHaveBeenCalledWith("org-1");
    expect(getPendingApprovalsMock).not.toHaveBeenCalled();
    expect(listElement).toMatchObject({
      props: {
        view: "all",
        actions: [
          expect.objectContaining({
            id: "request-1",
            requestId: "request-1",
            canDecide: true,
            pendingApproverSummary:
              "2 pending approvers · Procurement Manager, Finance Approver",
          }),
        ],
      },
    });
  });
});
