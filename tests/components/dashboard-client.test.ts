import React from "react";
import { OrganizationRole } from "@prisma/client";
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
    Cell: createChartPrimitive("div"),
  };
});

(globalThis as typeof globalThis & { React: typeof React }).React = React;

import {
  DashboardClient,
  deriveDashboardMetrics,
} from "@/components/dashboard/dashboard-client";
import { calculateSavings } from "@/lib/calculations";
import type { DashboardData } from "@/lib/types";
import {
  getUtopiaTraxDatasetSummary,
  UTOPIATRAX_DIRECT_CATEGORIES,
  UTOPIATRAX_SAVING_CARDS,
} from "@/scripts/seed-utopiatrax-demo";

function createDashboardCard(
  overrides: Record<string, unknown> = {}
): DashboardData["cards"][number] {
  return {
    id: "card-1",
    title: "Packaging renegotiation",
    phase: "VALIDATED",
    savingType: "PRICE_REDUCTION",
    impactType: "HARD_SAVINGS",
    impactRecurrence: "RECURRING",
    budgetImpact: "BUDGET_IMPACT",
    categoryId: "category-1",
    baselinePrice: 12,
    newPrice: 10,
    annualVolume: 1000,
    calculatedSavings: 125000,
    calculatedSavingsUSD: 125000,
    annualizedRunRate: 125000,
    annualizedRunRateUSD: 125000,
    inYearValue: 93750,
    inYearValueUSD: 93750,
    currency: "USD",
    fxRate: 1,
    frequency: "RECURRING",
    savingDriver: "Price renegotiation",
    implementationComplexity: "Low",
    qualificationStatus: "Approved",
    impactStartDate: new Date("2026-04-01T00:00:00.000Z"),
    impactEndDate: new Date("2026-12-31T00:00:00.000Z"),
    category: {
      name: "Packaging",
    },
    buyer: {
      name: "Casey Buyer",
    },
    businessUnit: {
      name: "Beverages",
    },
    evidence: [],
    ...overrides,
  } as unknown as DashboardData["cards"][number];
}

function resolveUtopiaFxRate(
  currency: (typeof UTOPIATRAX_SAVING_CARDS)[number]["currency"]
) {
  return currency === "USD" ? 0.92 : 1;
}

function parseUtopiaDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function createUtopiaDashboardCards(): DashboardData["cards"] {
  return UTOPIATRAX_SAVING_CARDS.map((card) => {
    const savings = calculateSavings({
      baselinePrice: card.baselinePrice,
      newPrice: card.newPrice,
      annualVolume: card.annualVolume,
      currency: card.currency,
      fxRate: resolveUtopiaFxRate(card.currency),
    });

    return {
      title: card.title,
      phase: card.phase,
      categoryId: `utopiatrax-category-${card.categoryName}`,
      baselinePrice: card.baselinePrice,
      newPrice: card.newPrice,
      annualVolume: card.annualVolume,
      calculatedSavings: savings.localSavings,
      calculatedSavingsUSD: savings.savingsUSD,
      annualizedRunRate: savings.localSavings,
      annualizedRunRateUSD: savings.savingsUSD,
      inYearValue: savings.localSavings,
      inYearValueUSD: savings.savingsUSD,
      currency: card.currency,
      fxRate: resolveUtopiaFxRate(card.currency),
      frequency: "RECURRING",
      savingDriver: card.savingDriver,
      implementationComplexity: card.implementationComplexity,
      qualificationStatus: card.qualificationStatus,
      impactStartDate: parseUtopiaDate(card.impactStart),
      impactEndDate: parseUtopiaDate(card.impactEnd),
      category: {
        name: card.categoryName,
      },
      buyer: {
        name: card.buyerName,
      },
      businessUnit: {
        name: card.businessUnitName,
      },
      evidence: card.evidence.map((item, index) => ({
        id: `${card.title}-evidence-${index}`,
        evidenceType: item.evidenceType,
        uploadedAt: new Date("2026-03-01T00:00:00.000Z"),
      })),
    } as unknown as DashboardData["cards"][number];
  });
}

describe("dashboard client", () => {
  it("renders chart sections when valid dashboard data is available", () => {
    const markup = renderToStaticMarkup(
      React.createElement(DashboardClient, {
        data: {
          cards: [createDashboardCard()],
        },
        readiness: null,
        viewer: {
          organizationMembershipRole: OrganizationRole.ADMIN,
        },
      })
    );

    expect(markup).toContain("Savings by Phase");
    expect(markup).toContain("Savings by Category");
    expect(markup).toContain("Savings Forecast");
    expect(markup).toContain("h-80");
    expect(markup).toContain('data-dashboard-chart-frame="Savings by Phase"');
    expect(markup).toContain("min-h-[20rem]");
    expect(markup).not.toContain("Dashboard charts are unavailable");
  });

  it("renders the first-value empty state when no saving cards exist", () => {
    const markup = renderToStaticMarkup(
      React.createElement(DashboardClient, {
        data: {
          cards: [],
        },
        readiness: null,
        viewer: {
          organizationMembershipRole: OrganizationRole.ADMIN,
        },
      })
    );

    expect(markup).toContain("No live saving cards yet.");
  });

  it("renders a visible error state when dashboard data loading fails", () => {
    const markup = renderToStaticMarkup(
      React.createElement(DashboardClient, {
        data: {
          cards: [],
        },
        readiness: null,
        loadState: {
          dataError:
            "Dashboard analytics could not be loaded right now. Refresh the page or try again in a moment.",
        },
        viewer: {
          organizationMembershipRole: OrganizationRole.ADMIN,
        },
      })
    );

    expect(markup).toContain("Dashboard charts are unavailable");
    expect(markup).toContain("Refresh dashboard");
  });

  it("shows explicit chart-empty states when cards exist but chart values are all zero", () => {
    const markup = renderToStaticMarkup(
      React.createElement(DashboardClient, {
        data: {
          cards: [
            createDashboardCard({
              calculatedSavings: 0,
              calculatedSavingsUSD: 0,
              phase: "IDEA",
            }),
          ],
        },
        readiness: null,
        viewer: {
          organizationMembershipRole: OrganizationRole.ADMIN,
        },
      })
    );

    expect(markup).toContain("No phase savings are available yet.");
    expect(markup).toContain("No category savings are available yet.");
    expect(markup).toContain("No savings forecast data is available yet.");
  });

  it("treats valid negative savings as chart data instead of misclassifying the dashboard as empty", () => {
    const markup = renderToStaticMarkup(
      React.createElement(DashboardClient, {
        data: {
          cards: [
            createDashboardCard({
              calculatedSavings: -25000,
              calculatedSavingsUSD: -25000,
              phase: "VALIDATED",
            }),
          ],
        },
        readiness: null,
        viewer: {
          organizationMembershipRole: OrganizationRole.ADMIN,
        },
      })
    );

    expect(markup).toContain("Savings by Phase");
    expect(markup).toContain("Savings by Category");
    expect(markup).toContain("Savings Forecast");
    expect(markup).not.toContain("No phase savings are available yet.");
    expect(markup).not.toContain("No category savings are available yet.");
    expect(markup).not.toContain("No savings forecast data is available yet.");
  });

  it("keeps chart sections available when malformed records are mixed with usable dashboard data", () => {
    const markup = renderToStaticMarkup(
      React.createElement(DashboardClient, {
        data: {
          cards: [
            createDashboardCard({
              title: "Valid card",
              calculatedSavings: 50000,
              calculatedSavingsUSD: 50000,
              impactStartDate: new Date("2026-04-01T00:00:00.000Z"),
            }),
            createDashboardCard({
              title: "Malformed card",
              calculatedSavings: Number.NaN,
              calculatedSavingsUSD: Number.NaN,
              impactStartDate: "not-a-real-date",
              category: {
                name: "",
              },
            }),
          ],
        },
        readiness: null,
        viewer: {
          organizationMembershipRole: OrganizationRole.ADMIN,
        },
      })
    );

    expect(markup).toContain("Savings by Phase");
    expect(markup).toContain("Savings by Category");
    expect(markup).toContain("Savings Forecast");
    expect(markup).not.toContain("No phase savings are available yet.");
    expect(markup).not.toContain("No category savings are available yet.");
    expect(markup).not.toContain("No savings forecast data is available yet.");
  });

  it("normalizes invalid dashboard chart inputs instead of throwing", () => {
    const metrics = deriveDashboardMetrics([
      createDashboardCard({
        impactStartDate: "not-a-real-date",
        calculatedSavings: 40000,
        calculatedSavingsUSD: 40000,
      }),
    ]);

    expect(metrics.monthlyTrend).toEqual([
      {
        month: "Unknown timing",
        savings: 40000,
        forecast: 48000,
      },
    ]);
  });

  it("aggregates every USD-labelled dashboard metric from persisted USD values", () => {
    const metrics = deriveDashboardMetrics([
      createDashboardCard({
        id: "usd-card",
        title: "USD card",
        phase: "REALISED",
        calculatedSavings: 100,
        calculatedSavingsUSD: 100,
        annualizedRunRate: 100,
        annualizedRunRateUSD: 100,
        inYearValue: 100,
        inYearValueUSD: 100,
        impactStartDate: new Date("2026-01-01T00:00:00.000Z"),
        impactEndDate: new Date("2026-12-31T00:00:00.000Z"),
      }),
      createDashboardCard({
        id: "eur-card",
        title: "EUR card",
        phase: "ACHIEVED",
        currency: "EUR",
        calculatedSavings: 100,
        calculatedSavingsUSD: 120,
        annualizedRunRate: 100,
        annualizedRunRateUSD: 120,
        inYearValue: 100,
        inYearValueUSD: 120,
        impactStartDate: new Date("2026-01-01T00:00:00.000Z"),
        impactEndDate: new Date("2026-12-31T00:00:00.000Z"),
      }),
    ], {
      fiscalYearStartMonth: 1,
      reportingDate: new Date("2026-06-01T00:00:00.000Z"),
    });

    expect(metrics.pipelineSavings).toBe(220);
    expect(metrics.realisedSavings).toBe(100);
    expect(metrics.achievedSavings).toBe(120);
    expect(metrics.inYearValue).toBe(220);
    expect(metrics.annualizedRunRate).toBe(220);
    expect(metrics.byCategory).toEqual([
      {
        label: "Packaging",
        savings: 220,
      },
    ]);
    expect(metrics.topProjects.map((project) => project.value)).toEqual([
      120,
      100,
    ]);
  });

  it("reports value in the workspace fiscal year and excludes non-overlapping cards", () => {
    const metrics = deriveDashboardMetrics(
      [
        createDashboardCard({
          id: "carryover-card",
          annualizedRunRateUSD: 1200,
          impactStartDate: new Date("2025-10-01T00:00:00.000Z"),
          impactEndDate: new Date("2026-09-30T00:00:00.000Z"),
          inYearValueUSD: 300,
        }),
        createDashboardCard({
          id: "future-card",
          annualizedRunRateUSD: 2400,
          impactStartDate: new Date("2027-01-01T00:00:00.000Z"),
          impactEndDate: new Date("2027-12-31T00:00:00.000Z"),
          inYearValueUSD: 2400,
        }),
        createDashboardCard({
          id: "expired-card",
          annualizedRunRateUSD: 3600,
          impactStartDate: new Date("2025-01-01T00:00:00.000Z"),
          impactEndDate: new Date("2025-12-31T00:00:00.000Z"),
          inYearValueUSD: 3600,
        }),
      ],
      {
        fiscalYearStartMonth: 1,
        reportingDate: new Date("2026-09-12T00:00:00.000Z"),
      }
    );

    expect(metrics.inYearValue).toBeCloseTo(900, 6);
  });

  it("derives populated executive metrics from the UtopiaTrax demo portfolio", () => {
    const cards = createUtopiaDashboardCards();
    const metrics = deriveDashboardMetrics(cards);
    const summary = getUtopiaTraxDatasetSummary();

    expect(cards).toHaveLength(summary.savingCardCount);
    expect(metrics.pipelineSavings).toBeGreaterThan(0);
    expect(metrics.realisedSavings).toBeGreaterThan(0);
    expect(metrics.achievedSavings).toBeGreaterThan(0);
    expect(metrics.forecastSavings).toBeGreaterThan(metrics.pipelineSavings);
    expect(metrics.monthlyTrend).toHaveLength(6);
    expect(metrics.monthlyTrend.every((point) => point.forecast > 0)).toBe(true);
    expect(metrics.topProjects).toHaveLength(5);

    for (const point of metrics.byPhase) {
      expect(point.phase).toBeDefined();
      expect(point.savings).toBeGreaterThan(0);
      if (point.phase) {
        expect(summary.phaseCounts[point.phase]).toBeGreaterThan(0);
      }
    }

    expect(metrics.byCategory.map((point) => point.label).sort()).toEqual(
      UTOPIATRAX_DIRECT_CATEGORIES.map((category) => category.name).sort()
    );

    const markup = renderToStaticMarkup(
      React.createElement(DashboardClient, {
        data: {
          cards,
        },
        readiness: null,
        viewer: {
          organizationMembershipRole: OrganizationRole.ADMIN,
        },
      })
    );

    expect(markup).toContain("Savings by Phase");
    expect(markup).toContain("Savings by Category");
    expect(markup).toContain("Savings Forecast");
    expect(markup).not.toContain("No live saving cards yet.");
    expect(markup).not.toContain("No phase savings are available yet.");
    expect(markup).not.toContain("No savings forecast data is available yet.");
  });
});
