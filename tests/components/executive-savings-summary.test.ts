import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

import { ExecutiveSavingsSummary } from "@/components/reports/executive-savings-summary";
import type { CommandCenterData, DashboardData } from "@/lib/types";

function createCommandCenterData(
  overrides: Partial<CommandCenterData> = {}
): CommandCenterData {
  return {
    filters: {},
    kpis: {
      totalPipelineSavings: 420000,
      realisedSavings: 160000,
      achievedSavings: 90000,
      savingsForecast: 310000,
      activeProjects: 8,
      pendingApprovals: 3,
    },
    pipelineByPhase: [],
    forecastCurve: [],
    topSuppliers: [],
    savingsByRiskLevel: [],
    savingsByQualificationStatus: [],
    pendingApprovalQueue: [
      {
        requestId: "req-1",
        savingCardId: "card-1",
        savingCardTitle: "Packaging renegotiation",
        currentPhase: "Validated",
        requestedPhase: "Realised",
        requestedByName: "Alex Buyer",
        requestedByRole: "Buyer",
        createdAt: "2026-04-01T00:00:00.000Z",
        ageDays: 9,
        isOverdue: true,
        pendingApproverCount: 2,
        pendingApproverRoles: ["Procurement Manager"],
        savings: 55000,
        financeLocked: false,
      },
    ],
    overdueItems: [
      {
        savingCardId: "card-2",
        title: "Copper hedge refresh",
        phase: "Realised",
        buyerName: "Taylor Buyer",
        categoryName: "Metals",
        dateLabel: "Due date",
        dateValue: "2026-03-25T00:00:00.000Z",
        ageDays: 12,
        savings: 45000,
        financeLocked: false,
      },
    ],
    financeLockedItems: [
      {
        savingCardId: "card-3",
        title: "Resin index adjustment",
        phase: "Validated",
        buyerName: "Jordan Buyer",
        categoryName: "Chemicals",
        dateLabel: "Last updated",
        dateValue: "2026-04-10T00:00:00.000Z",
        ageDays: 2,
        savings: 38000,
        financeLocked: true,
      },
    ],
    recentDecisions: [
      {
        approvalId: "approval-1",
        savingCardId: "card-4",
        savingCardTitle: "Freight lane consolidation",
        phase: "Achieved",
        approverName: "Morgan Finance",
        approverRole: "Finance Approver",
        status: "APPROVED",
        approved: true,
        createdAt: "2026-04-11T00:00:00.000Z",
        comment: "Validated and released.",
      },
    ],
    recentActivity: [],
    ...overrides,
  };
}

function createDashboardData(
  overrides: Record<string, unknown> = {}
): DashboardData {
  return {
    cards: [{ title: "Card 1" }, { title: "Card 2" }, { title: "Card 3" }],
    annualTarget: 350000,
    ...overrides,
  } as DashboardData;
}

describe("executive savings summary", () => {
  it("renders the key executive metrics and recent decisions", () => {
    const markup = renderToStaticMarkup(
      React.createElement(ExecutiveSavingsSummary, {
        commandCenterData: createCommandCenterData(),
        dashboardData: createDashboardData(),
      })
    );

    expect(markup).toContain("Executive Savings Summary");
    expect(markup).toContain("Pipeline Savings");
    expect(markup).toContain("Realised Savings");
    expect(markup).toContain("Achieved Savings");
    expect(markup).toContain("Forecast");
    expect(markup).toContain("Pending Approvals");
    expect(markup).toContain("Delayed Initiatives");
    expect(markup).toContain("Recent Wins &amp; Decisions");
    expect(markup).toContain("Freight lane consolidation");
    expect(markup).toContain("Approved");
    expect(markup).toContain("€420k");
  });

  it("renders an explicit empty state when no executive data is available", () => {
    const markup = renderToStaticMarkup(
      React.createElement(ExecutiveSavingsSummary, {
        commandCenterData: createCommandCenterData({
          kpis: {
            totalPipelineSavings: 0,
            realisedSavings: 0,
            achievedSavings: 0,
            savingsForecast: 0,
            activeProjects: 0,
            pendingApprovals: 0,
          },
          pendingApprovalQueue: [],
          overdueItems: [],
          financeLockedItems: [],
          recentDecisions: [],
        }),
        dashboardData: createDashboardData({
          cards: [],
          annualTarget: 0,
        }),
      })
    );

    expect(markup).toContain("No executive savings data is available yet");
    expect(markup).toContain("Create saving card");
    expect(markup).toContain("Open command center");
  });
});
