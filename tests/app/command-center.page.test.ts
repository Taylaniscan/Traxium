import React from "react";
import { Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const CommandCenterClientMock = vi.hoisted(() => vi.fn(() => null));
const requireUserMock = vi.hoisted(() => vi.fn());
const getCommandCenterDataMock = vi.hoisted(() => vi.fn());
const getCommandCenterFilterOptionsMock = vi.hoisted(() => vi.fn());
const getWorkspaceReadinessMock = vi.hoisted(() => vi.fn());

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

(globalThis as typeof globalThis & { React: typeof React }).React = React;

import CommandCenterPage from "@/app/(app)/command-center/page";

describe("command center page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
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
  });
});
