import React from "react";
import { Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createUtopiaTraxCommandCenterData,
  createUtopiaTraxReadiness,
} from "../helpers/utopiatrax-demo-fixtures";

const CommandCenterClientMock = vi.hoisted(() => vi.fn(() => null));
const requireUserMock = vi.hoisted(() => vi.fn());
const getCommandCenterDataMock = vi.hoisted(() => vi.fn());
const getCommandCenterFilterOptionsMock = vi.hoisted(() => vi.fn());
const getWorkspaceReadinessMock = vi.hoisted(() => vi.fn());
const captureExceptionMock = vi.hoisted(() => vi.fn());

vi.mock("@/components/command-center/command-center-client", () => ({
  CommandCenterClient: CommandCenterClientMock,
}));

vi.mock("@/lib/auth", () => ({
  requireUser: requireUserMock,
}));

vi.mock("@/lib/data", () => ({
  getCommandCenterData: getCommandCenterDataMock,
  getCommandCenterFilterOptions: getCommandCenterFilterOptionsMock,
  getWorkspaceReadiness: getWorkspaceReadinessMock,
}));

vi.mock("@/lib/observability", () => ({
  captureException: captureExceptionMock,
}));

(globalThis as typeof globalThis & { React: typeof React }).React = React;

import CommandCenterPage from "@/app/(app)/command-center/page";

describe("command center page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({
      id: "user-1",
      role: Role.GLOBAL_CATEGORY_LEADER,
      organizationId: "org-1",
    });
    getCommandCenterDataMock.mockResolvedValue({
      filters: {},
      kpis: {
        totalPipelineSavings: 0,
        realisedSavings: 0,
        achievedSavings: 0,
        savingsForecast: 0,
        activeProjects: 0,
        pendingApprovals: 0,
      },
      pipelineByPhase: [],
      forecastCurve: [],
      topSuppliers: [],
      savingsByRiskLevel: [],
      savingsByQualificationStatus: [],
    });
    getCommandCenterFilterOptionsMock.mockResolvedValue({
      categories: [],
      businessUnits: [],
      buyers: [],
      plants: [],
      suppliers: [],
    });
    getWorkspaceReadinessMock.mockResolvedValue(null);
  });

  it("passes successful command center payloads through to the client", async () => {
    const page = await CommandCenterPage();
    const clientElement = page.props.children[1];

    expect(clientElement).toMatchObject({
      type: CommandCenterClientMock,
      props: {
        loadState: {
          dataError: null,
          filterOptionsError: null,
          readinessError: null,
        },
      },
    });
  });

  it("passes populated UtopiaTrax executive queues and indicators", async () => {
    const data = createUtopiaTraxCommandCenterData();
    getCommandCenterDataMock.mockResolvedValue(data);
    getCommandCenterFilterOptionsMock.mockResolvedValue({
      categories: [{ id: "category-1", name: "Polymer Carriers" }],
      businessUnits: [{ id: "unit-1", name: "Packaging Colorants" }],
      buyers: [{ id: "buyer-1", name: "Aylin Demir" }],
      plants: [{ id: "plant-1", name: "Apeldoorn Plant" }],
      suppliers: [{ id: "supplier-1", name: "Borealis Polymers" }],
    });
    getWorkspaceReadinessMock.mockResolvedValue(createUtopiaTraxReadiness());

    const page = await CommandCenterPage();
    const clientElement = page.props.children[1];

    expect(clientElement.props.initialData.kpis.activeProjects).toBe(23);
    expect(clientElement.props.initialData.pendingApprovalQueue).not.toHaveLength(0);
    expect(clientElement.props.initialData.financeLockedItems).not.toHaveLength(0);
    expect(clientElement.props.filterOptions.categories).not.toHaveLength(0);
  });

  it("surfaces command center data and filter failures as visible client load state", async () => {
    getCommandCenterDataMock.mockRejectedValue(
      new Error("Command center query failed.")
    );
    getCommandCenterFilterOptionsMock.mockRejectedValue(
      new Error("Filter lookup failed.")
    );

    const page = await CommandCenterPage();
    const clientElement = page.props.children[1];

    expect(clientElement).toMatchObject({
      type: CommandCenterClientMock,
      props: {
        loadState: {
          dataError:
            "Command center analytics could not be loaded right now. Refresh the page or try again in a moment.",
          filterOptionsError:
            "Command center filters could not be loaded. Filter options are temporarily unavailable.",
        },
      },
    });
    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        event: "command_center.page.data_load_failed",
        route: "/command-center",
        organizationId: "org-1",
        userId: "user-1",
      })
    );
    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        event: "command_center.page.filter_options_load_failed",
        route: "/command-center",
        organizationId: "org-1",
        userId: "user-1",
      })
    );
  });
});
