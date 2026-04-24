import React from "react";
import { OrganizationRole, Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const DashboardClientMock = vi.hoisted(() => vi.fn(() => null));
const requireUserMock = vi.hoisted(() => vi.fn());
const getDashboardDataMock = vi.hoisted(() => vi.fn());
const getWorkspaceReadinessMock = vi.hoisted(() => vi.fn());
const captureExceptionMock = vi.hoisted(() => vi.fn());

vi.mock("@/components/dashboard/dashboard-client", () => ({
  DashboardClient: DashboardClientMock,
}));

vi.mock("@/lib/auth", () => ({
  requireUser: requireUserMock,
}));

vi.mock("@/lib/data", () => ({
  getDashboardData: getDashboardDataMock,
  getWorkspaceReadiness: getWorkspaceReadinessMock,
}));

vi.mock("@/lib/observability", () => ({
  captureException: captureExceptionMock,
}));

(globalThis as typeof globalThis & { React: typeof React }).React = React;

import DashboardPage from "@/app/(app)/dashboard/page";

describe("dashboard page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({
      id: "user-1",
      role: Role.GLOBAL_CATEGORY_LEADER,
      organizationId: "org-1",
      activeOrganization: {
        membershipRole: OrganizationRole.ADMIN,
      },
    });
    getWorkspaceReadinessMock.mockResolvedValue(null);
  });

  it("passes loaded dashboard data through to the client", async () => {
    getDashboardDataMock.mockResolvedValue({
      cards: [],
    });

    const page = await DashboardPage();
    const dashboardClientElement = page.props.children[1];

    expect(dashboardClientElement).toMatchObject({
      type: DashboardClientMock,
      props: {
        data: {
          cards: [],
        },
        readiness: null,
        loadState: {
          dataError: null,
          readinessError: null,
        },
        viewer: {
          organizationMembershipRole: OrganizationRole.ADMIN,
        },
      },
    });
  });

  it("surfaces dashboard data failures as a user-visible client load state instead of silently masking them", async () => {
    getDashboardDataMock.mockRejectedValue(new Error("Dashboard query failed."));

    const page = await DashboardPage();
    const dashboardClientElement = page.props.children[1];

    expect(dashboardClientElement).toMatchObject({
      type: DashboardClientMock,
      props: {
        data: {
          cards: [],
        },
        loadState: {
          dataError:
            "Dashboard analytics could not be loaded right now. Refresh the page or try again in a moment.",
        },
      },
    });
    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        event: "dashboard.page.data_load_failed",
        route: "/dashboard",
        organizationId: "org-1",
        userId: "user-1",
      })
    );
  });
});
