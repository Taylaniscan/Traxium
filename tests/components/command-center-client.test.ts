import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    prefetch: _prefetch,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    prefetch?: boolean;
  }) => React.createElement("a", { href, ...props }, children),
}));

vi.mock("recharts", () => {
  function createChartPrimitive(tag: string) {
    return ({ children }: { children?: React.ReactNode }) =>
      React.createElement(tag, null, children);
  }

  return {
    ResponsiveContainer: createChartPrimitive("div"),
    BarChart: createChartPrimitive("div"),
    AreaChart: createChartPrimitive("div"),
    CartesianGrid: createChartPrimitive("div"),
    Tooltip: createChartPrimitive("div"),
    XAxis: createChartPrimitive("div"),
    YAxis: createChartPrimitive("div"),
    Bar: createChartPrimitive("div"),
    Area: createChartPrimitive("div"),
  };
});

(globalThis as typeof globalThis & { React: typeof React }).React = React;

import {
  buildCommandCenterSearchParams,
  CommandCenterClient,
  normalizeCommandCenterData,
} from "@/components/command-center/command-center-client";
import type { CommandCenterData } from "@/lib/types";

function createCommandCenterData(
  overrides: Record<string, unknown> = {}
): CommandCenterData {
  return {
    filters: {},
    kpis: {
      totalPipelineSavings: 100000,
      realisedSavings: 30000,
      achievedSavings: 20000,
      savingsForecast: 45000,
      activeProjects: 4,
      pendingApprovals: 2,
    },
    pipelineByPhase: [
      {
        phase: "VALIDATED",
        label: "Validated",
        savings: 50000,
      },
    ],
    forecastCurve: [
      {
        month: "Apr 2026",
        savings: 30000,
        forecast: 45000,
      },
    ],
    topSuppliers: [
      {
        supplier: "Atlas Chemicals",
        savings: 25000,
      },
    ],
    savingsByRiskLevel: [
      {
        level: "Medium",
        savings: 12000,
      },
    ],
    savingsByQualificationStatus: [
      {
        status: "Approved",
        savings: 20000,
      },
    ],
    ...overrides,
  } as CommandCenterData;
}

describe("command center client", () => {
  it("renders chart sections when valid command-center data is available", () => {
    const markup = renderToStaticMarkup(
      React.createElement(CommandCenterClient, {
        initialData: createCommandCenterData(),
        filterOptions: {
          categories: [],
          businessUnits: [],
          buyers: [],
          plants: [],
          suppliers: [],
        },
        readiness: null,
      })
    );

    expect(markup).toContain("Savings Pipeline by Phase");
    expect(markup).toContain("Savings Forecast Over Time");
    expect(markup).toContain("Top Suppliers by Savings Impact");
    expect(markup).toContain("h-80");
    expect(markup).toContain("h-[420px]");
  });

  it("renders a visible error state when command-center data loading fails", () => {
    const markup = renderToStaticMarkup(
      React.createElement(CommandCenterClient, {
        initialData: createCommandCenterData({
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
        }),
        filterOptions: {
          categories: [],
          businessUnits: [],
          buyers: [],
          plants: [],
          suppliers: [],
        },
        readiness: null,
        loadState: {
          dataError:
            "Command center analytics could not be loaded right now. Refresh the page or try again in a moment.",
        },
      })
    );

    expect(markup).toContain("Command center charts are unavailable");
    expect(markup).toContain("Refresh command center");
  });

  it("renders an explicit empty state instead of a blank chart area when no meaningful data exists", () => {
    const markup = renderToStaticMarkup(
      React.createElement(CommandCenterClient, {
        initialData: createCommandCenterData({
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
        }),
        filterOptions: {
          categories: [],
          businessUnits: [],
          buyers: [],
          plants: [],
          suppliers: [],
        },
        readiness: {
          workspace: {
            id: "org-1",
            name: "Atlas",
            slug: "atlas",
            createdAt: new Date("2026-03-01T00:00:00.000Z"),
            updatedAt: new Date("2026-03-01T00:00:00.000Z"),
          },
          counts: {
            users: 1,
            buyers: 1,
            suppliers: 1,
            materials: 1,
            categories: 1,
            plants: 1,
            businessUnits: 1,
            savingCards: 2,
          },
          masterData: [],
          workflowCoverage: [],
          coverage: {
            masterDataReadyCount: 0,
            masterDataTotal: 0,
            workflowReadyCount: 0,
            workflowTotal: 0,
            overallPercent: 100,
          },
          activity: {
            firstSavingCardCreatedAt: null,
            lastPortfolioUpdateAt: null,
          },
          isMasterDataReady: true,
          isWorkflowReady: true,
          isWorkspaceReady: true,
          missingCoreSetup: [],
          missingWorkflowCoverage: [],
        },
      })
    );

    expect(markup).toContain("No live command-center data yet");
    expect(markup).toContain("Create saving card");
  });

  it("shows explicit chart-empty states when KPI cards exist but chart arrays are empty", () => {
    const markup = renderToStaticMarkup(
      React.createElement(CommandCenterClient, {
        initialData: createCommandCenterData({
          kpis: {
            totalPipelineSavings: 0,
            realisedSavings: 0,
            achievedSavings: 0,
            savingsForecast: 0,
            activeProjects: 2,
            pendingApprovals: 1,
          },
          pipelineByPhase: [],
          forecastCurve: [],
          topSuppliers: [],
          savingsByRiskLevel: [],
          savingsByQualificationStatus: [],
        }),
        filterOptions: {
          categories: [],
          businessUnits: [],
          buyers: [],
          plants: [],
          suppliers: [],
        },
        readiness: null,
      })
    );

    expect(markup).toContain(
      "No pipeline savings are available for the current view."
    );
    expect(markup).toContain(
      "No savings forecast data is available for the current view."
    );
    expect(markup).toContain(
      "No supplier savings exposure is available for the current view."
    );
  });

  it("normalizes invalid command-center payload values safely", () => {
    const normalized = normalizeCommandCenterData(
      createCommandCenterData({
        topSuppliers: [
          {
            supplier: "",
            savings: Number.NaN,
          },
        ],
        forecastCurve: [
          {
            month: "",
            savings: Number.NaN,
            forecast: 5000,
          },
        ],
      })
    );

    expect(normalized.topSuppliers).toEqual([
      {
        supplier: "Unknown supplier",
        savings: 0,
      },
    ]);
    expect(normalized.forecastCurve).toEqual([
      {
        month: "Unknown timing",
        savings: 0,
        forecast: 5000,
      },
    ]);
  });

  it("builds stable search params when filters change", () => {
    expect(
      buildCommandCenterSearchParams({
        buyerId: "buyer-1",
        supplierId: "",
        categoryId: "category-9",
      }).toString()
    ).toBe("categoryId=category-9&buyerId=buyer-1");
  });
});
