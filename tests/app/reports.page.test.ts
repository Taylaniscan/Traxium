import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ImportExportPanelMock = vi.hoisted(() => vi.fn(() => null));
const ExecutiveSavingsSummaryMock = vi.hoisted(() => vi.fn(() => null));
const requireUserMock = vi.hoisted(() => vi.fn());
const getWorkspaceReadinessMock = vi.hoisted(() => vi.fn());
const getCommandCenterDataMock = vi.hoisted(() => vi.fn());
const getDashboardDataMock = vi.hoisted(() => vi.fn());
const captureExceptionMock = vi.hoisted(() => vi.fn());

vi.mock("@/components/reports/import-export-panel", () => ({
  ImportExportPanel: ImportExportPanelMock,
}));

vi.mock("@/components/reports/executive-savings-summary", () => ({
  ExecutiveSavingsSummary: ExecutiveSavingsSummaryMock,
}));

vi.mock("@/lib/auth", () => ({
  requireUser: requireUserMock,
}));

vi.mock("@/lib/data", () => ({
  getWorkspaceReadiness: getWorkspaceReadinessMock,
  getCommandCenterData: getCommandCenterDataMock,
  getDashboardData: getDashboardDataMock,
}));

vi.mock("@/lib/observability", () => ({
  captureException: captureExceptionMock,
}));

(globalThis as typeof globalThis & { React: typeof React }).React = React;

import ReportsPage from "@/app/(app)/reports/page";

describe("reports page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({
      id: "user-1",
      organizationId: "org-1",
    });
    getWorkspaceReadinessMock.mockResolvedValue(null);
    getCommandCenterDataMock.mockResolvedValue({
      filters: {},
      kpis: {
        totalPipelineSavings: 100000,
        realisedSavings: 40000,
        achievedSavings: 25000,
        savingsForecast: 90000,
        activeProjects: 5,
        pendingApprovals: 2,
      },
      pipelineByPhase: [],
      forecastCurve: [],
      topSuppliers: [],
      savingsByRiskLevel: [],
      savingsByQualificationStatus: [],
      pendingApprovalQueue: [],
      overdueItems: [],
      financeLockedItems: [],
      recentDecisions: [],
      recentActivity: [],
    });
    getDashboardDataMock.mockResolvedValue({
      cards: [],
      annualTarget: 120000,
    });
  });

  it("passes executive summary data and readiness through to the reports surfaces", async () => {
    const page = await ReportsPage();
    const summaryElement = page.props.children[1];
    const panelElement = page.props.children[2];

    expect(summaryElement).toMatchObject({
      type: ExecutiveSavingsSummaryMock,
      props: {
        loadState: {
          commandCenterError: null,
          dashboardError: null,
        },
      },
    });
    expect(panelElement).toMatchObject({
      type: ImportExportPanelMock,
      props: {
        readiness: null,
      },
    });
  });

  it("keeps the reports page render safe and captures executive-summary failures", async () => {
    getCommandCenterDataMock.mockRejectedValueOnce(
      new Error("Command center summary query failed.")
    );
    getDashboardDataMock.mockRejectedValueOnce(
      new Error("Dashboard summary query failed.")
    );
    getWorkspaceReadinessMock.mockRejectedValueOnce(
      new Error("Workspace readiness query failed.")
    );

    const page = await ReportsPage();
    const summaryElement = page.props.children[1];
    const panelElement = page.props.children[2];

    expect(summaryElement).toMatchObject({
      type: ExecutiveSavingsSummaryMock,
      props: {
        loadState: {
          commandCenterError:
            "Executive workflow indicators could not be loaded. Pending approvals and recent decisions may be incomplete.",
          dashboardError:
            "Portfolio savings totals could not be loaded. Financial summary values may be incomplete.",
        },
      },
    });
    expect(panelElement).toMatchObject({
      type: ImportExportPanelMock,
      props: {
        readiness: null,
      },
    });
    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        event: "reports.page.readiness_load_failed",
        route: "/reports",
        organizationId: "org-1",
        userId: "user-1",
      })
    );
    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        event: "reports.page.command_center_summary_load_failed",
        route: "/reports",
        organizationId: "org-1",
        userId: "user-1",
      })
    );
    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        event: "reports.page.dashboard_summary_load_failed",
        route: "/reports",
        organizationId: "org-1",
        userId: "user-1",
      })
    );
  });
});
