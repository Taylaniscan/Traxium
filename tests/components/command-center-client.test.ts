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
    function ChartPrimitive({ children }: { children?: React.ReactNode }) {
      return React.createElement(tag, null, children);
    }

    ChartPrimitive.displayName = `Mock${tag}`;
    return ChartPrimitive;
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
import { calculateSavings } from "@/lib/calculations";
import { phaseLabels, phases } from "@/lib/constants";
import type { CommandCenterData, CommandCenterFilterOptions } from "@/lib/types";
import {
  getUtopiaTraxDatasetSummary,
  getUtopiaTraxExpectedPendingOpenActionCount,
  UTOPIATRAX_DIRECT_CATEGORIES,
  UTOPIATRAX_PENDING_PHASE_REQUESTS,
  UTOPIATRAX_SAVING_CARDS,
  UTOPIATRAX_SUPPLIERS,
} from "@/scripts/seed-utopiatrax-demo";

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

function createStableSeedId(prefix: string, value: string) {
  return `${prefix}-${value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
}

function resolveUtopiaFxRate(
  currency: (typeof UTOPIATRAX_SAVING_CARDS)[number]["currency"]
) {
  return currency === "USD" ? 0.92 : 1;
}

function parseUtopiaDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function formatUtopiaMonth(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(parseUtopiaDate(value));
}

function getUtopiaSavingsEUR(card: (typeof UTOPIATRAX_SAVING_CARDS)[number]) {
  return calculateSavings({
    baselinePrice: card.baselinePrice,
    newPrice: card.newPrice,
    annualVolume: card.annualVolume,
    currency: card.currency,
    fxRate: resolveUtopiaFxRate(card.currency),
  }).localSavings;
}

function sumSavings(
  cards: readonly (typeof UTOPIATRAX_SAVING_CARDS)[number][]
) {
  return cards.reduce((sum, card) => sum + getUtopiaSavingsEUR(card), 0);
}

function buildUtopiaCommandCenterFilterOptions(): CommandCenterFilterOptions {
  const buyerNames = [...new Set(UTOPIATRAX_SAVING_CARDS.map((card) => card.buyerName))];
  const businessUnitNames = [
    ...new Set(UTOPIATRAX_SAVING_CARDS.map((card) => card.businessUnitName)),
  ];

  return {
    categories: UTOPIATRAX_DIRECT_CATEGORIES.map((category) => ({
      id: createStableSeedId("category", category.name),
      name: category.name,
    })),
    businessUnits: businessUnitNames.map((name) => ({
      id: createStableSeedId("business-unit", name),
      name,
    })),
    buyers: buyerNames.map((name) => ({
      id: createStableSeedId("buyer", name),
      name,
    })),
    plants: [],
    suppliers: UTOPIATRAX_SUPPLIERS.map((supplier) => ({
      id: createStableSeedId("supplier", supplier.name),
      name: supplier.name,
    })),
  };
}

function buildUtopiaCommandCenterData(): CommandCenterData {
  const activeCards = UTOPIATRAX_SAVING_CARDS.filter(
    (card) => card.phase !== "CANCELLED"
  );
  const cardsByTitle = new Map(
    UTOPIATRAX_SAVING_CARDS.map((card) => [card.title, card])
  );
  const forecastByMonth = new Map<string, number>();
  const supplierSavings = new Map<string, number>();
  const riskSavings = new Map<string, number>();
  const qualificationSavings = new Map<string, number>();

  for (const card of UTOPIATRAX_SAVING_CARDS) {
    const savings = getUtopiaSavingsEUR(card);
    const month = formatUtopiaMonth(card.impactStart);
    forecastByMonth.set(month, (forecastByMonth.get(month) ?? 0) + savings);
    supplierSavings.set(
      card.supplierName,
      (supplierSavings.get(card.supplierName) ?? 0) + savings
    );
    riskSavings.set(
      card.alternative?.riskLevel ?? "No alternative",
      (riskSavings.get(card.alternative?.riskLevel ?? "No alternative") ?? 0) +
        savings
    );
    qualificationSavings.set(
      card.qualificationStatus,
      (qualificationSavings.get(card.qualificationStatus) ?? 0) + savings
    );
  }

  return {
    filters: {},
    kpis: {
      totalPipelineSavings: sumSavings(activeCards),
      realisedSavings: sumSavings(
        UTOPIATRAX_SAVING_CARDS.filter((card) => card.phase === "REALISED")
      ),
      achievedSavings: sumSavings(
        UTOPIATRAX_SAVING_CARDS.filter((card) => card.phase === "ACHIEVED")
      ),
      savingsForecast: sumSavings(activeCards) * 1.2,
      activeProjects: activeCards.length,
      pendingApprovals: getUtopiaTraxExpectedPendingOpenActionCount(),
    },
    pipelineByPhase: phases.map((phase) => ({
      phase,
      label: phaseLabels[phase],
      savings: sumSavings(
        UTOPIATRAX_SAVING_CARDS.filter((card) => card.phase === phase)
      ),
    })),
    forecastCurve: [...forecastByMonth.entries()].map(([month, savings]) => ({
      month,
      savings,
      forecast: savings * 1.2,
    })),
    topSuppliers: [...supplierSavings.entries()]
      .map(([supplier, savings]) => ({ supplier, savings }))
      .sort((left, right) => right.savings - left.savings)
      .slice(0, 5),
    savingsByRiskLevel: [...riskSavings.entries()].map(([level, savings]) => ({
      level,
      savings,
    })),
    savingsByQualificationStatus: [...qualificationSavings.entries()].map(
      ([status, savings]) => ({
        status,
        savings,
      })
    ),
    pendingApprovalQueue: UTOPIATRAX_PENDING_PHASE_REQUESTS.map(
      (request, index) => {
        const card = cardsByTitle.get(request.cardTitle);
        if (!card) {
          throw new Error(`Missing UtopiaTrax card for ${request.cardTitle}`);
        }

        const requiresFinance = request.requestedPhase !== "VALIDATED";

        return {
          requestId: `utopiatrax-request-${index}`,
          savingCardId: createStableSeedId("card", card.title),
          savingCardTitle: card.title,
          currentPhase: phaseLabels[card.phase],
          requestedPhase: phaseLabels[request.requestedPhase],
          requestedByName: request.requestedByEmail.includes("+7")
            ? "Can Kaya"
            : "Aylin Demir",
          requestedByRole: request.requestedByEmail.includes("+7")
            ? "TACTICAL_BUYER"
            : "GLOBAL_CATEGORY_LEADER",
          createdAt: request.createdAt,
          ageDays: 30 + index,
          isOverdue: true,
          pendingApproverCount: requiresFinance ? 1 : 2,
          pendingApproverRoles: requiresFinance
            ? ["FINANCIAL_CONTROLLER"]
            : ["HEAD_OF_GLOBAL_PROCUREMENT", "FINANCIAL_CONTROLLER"],
          savings: getUtopiaSavingsEUR(card),
          financeLocked: card.financeLocked ?? false,
        };
      }
    ),
    financeLockedItems: UTOPIATRAX_SAVING_CARDS.filter(
      (card) => card.financeLocked
    ).map((card) => ({
      savingCardId: createStableSeedId("card", card.title),
      title: card.title,
      phase: phaseLabels[card.phase],
      buyerName: card.buyerName,
      categoryName: card.categoryName,
      dateLabel: "Impact start",
      dateValue: parseUtopiaDate(card.impactStart).toISOString(),
      ageDays: 14,
      savings: getUtopiaSavingsEUR(card),
      financeLocked: true,
    })),
    recentDecisions: UTOPIATRAX_SAVING_CARDS.filter((card) =>
      ["ACHIEVED", "REALISED"].includes(card.phase)
    )
      .slice(0, 4)
      .map((card, index) => ({
        approvalId: `utopiatrax-decision-${index}`,
        savingCardId: createStableSeedId("card", card.title),
        savingCardTitle: card.title,
        phase: phaseLabels[card.phase],
        approverName: "Deniz Arslan",
        approverRole: "FINANCIAL_CONTROLLER",
        status: "APPROVED",
        approved: true,
        createdAt: parseUtopiaDate(card.impactStart).toISOString(),
        comment: "Demo approval confirms finance-reviewed savings.",
      })),
  };
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

  it("renders UtopiaTrax executive queues and portfolio context from seed data", () => {
    const data = buildUtopiaCommandCenterData();
    const normalized = normalizeCommandCenterData(data);
    const summary = getUtopiaTraxDatasetSummary();

    expect(normalized.kpis.activeProjects).toBe(
      summary.savingCardCount - summary.phaseCounts.CANCELLED
    );
    expect(normalized.kpis.pendingApprovals).toBe(
      summary.expectedPendingOpenActions
    );
    expect(normalized.pendingApprovalQueue).toHaveLength(
      UTOPIATRAX_PENDING_PHASE_REQUESTS.length
    );
    expect(normalized.financeLockedItems?.length).toBeGreaterThan(0);
    expect(normalized.recentDecisions?.length).toBeGreaterThan(0);
    expect(
      normalized.pendingApprovalQueue?.map((item) => item.savingCardTitle)
    ).toContain("Bio-based carrier pilot sourcing");
    expect(
      normalized.pendingApprovalQueue?.map((item) => item.savingCardTitle)
    ).toContain("Antioxidant blend supplier switch");
    expect(
      normalized.pipelineByPhase.every((point) => point.savings > 0)
    ).toBe(true);

    const markup = renderToStaticMarkup(
      React.createElement(CommandCenterClient, {
        initialData: data,
        filterOptions: buildUtopiaCommandCenterFilterOptions(),
        readiness: null,
      })
    );

    expect(markup).toContain("Savings Pipeline by Phase");
    expect(markup).toContain("Pending approvals");
    expect(markup).toContain("Finance Locked");
    expect(markup).toContain("Recent decisions");
    expect(markup).not.toContain("No live command-center data yet");
    expect(markup).not.toContain(
      "No pipeline savings are available for the current view."
    );
  });
});
