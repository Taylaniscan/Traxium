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

vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  const ReactModule = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    // Recharts can render deterministically in this Node test runtime once the
    // container has a concrete size. We only shim ResponsiveContainer so the
    // real BarChart and AreaChart paths still execute.
    ResponsiveContainer: ({
      children,
    }: {
      children?: React.ReactNode;
      width?: number | string;
      height?: number | string;
    }) => {
      if (!ReactModule.isValidElement(children)) {
        return null;
      }

      return ReactModule.createElement(
        "div",
        {
          className: "recharts-responsive-container",
          style: {
            width: "100%",
            height: "100%",
            minWidth: 0,
          },
        },
        ReactModule.cloneElement(
          children as React.ReactElement<{
            width?: number;
            height?: number;
          }>,
          {
            width: 640,
            height: 320,
          }
        )
      );
    },
  };
});

(globalThis as typeof globalThis & { React: typeof React }).React = React;

import { DashboardClient } from "@/components/dashboard/dashboard-client";
import type { DashboardData } from "@/lib/types";

function createDashboardCard(
  overrides: Record<string, unknown> = {}
): DashboardData["cards"][number] {
  return {
    id: "card-1",
    title: "Packaging renegotiation",
    phase: "VALIDATED",
    categoryId: "category-1",
    baselinePrice: 12,
    newPrice: 10,
    annualVolume: 1000,
    calculatedSavings: 125000,
    frequency: "RECURRING",
    savingDriver: "Price renegotiation",
    implementationComplexity: "Low",
    qualificationStatus: "Approved",
    impactStartDate: new Date("2026-04-01T00:00:00.000Z"),
    category: {
      name: "Packaging",
    },
    buyer: {
      name: "Casey Buyer",
    },
    businessUnit: {
      name: "Beverages",
    },
    ...overrides,
  } as DashboardData["cards"][number];
}

function renderDashboard(cards: DashboardData["cards"]) {
  return renderToStaticMarkup(
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
}

function countMatches(markup: string, pattern: RegExp) {
  return markup.match(pattern)?.length ?? 0;
}

describe("dashboard client runtime regression", () => {
  it("renders real chart output for valid non-zero dashboard data instead of falling back to chart-empty messaging", () => {
    const markup = renderDashboard([
      createDashboardCard({
        title: "Packaging recovery",
        phase: "VALIDATED",
        calculatedSavings: -25000,
        impactStartDate: new Date("2026-04-01T00:00:00.000Z"),
        category: {
          name: "Packaging",
        },
      }),
      createDashboardCard({
        title: "Freight correction",
        phase: "REALISED",
        calculatedSavings: -10000,
        impactStartDate: new Date("2026-05-01T00:00:00.000Z"),
        category: {
          name: "Logistics",
        },
      }),
    ]);

    expect(markup).toContain("Savings by Phase");
    expect(markup).toContain("Savings by Category");
    expect(markup).toContain("Savings Forecast");
    expect(markup).toContain("Apr 2026");
    expect(markup).toContain("May 2026");
    expect(countMatches(markup, /data-dashboard-chart-frame=/g)).toBe(3);
    expect(countMatches(markup, /min-h-\[20rem\]/g)).toBe(3);
    expect(countMatches(markup, /class="recharts-wrapper"/g)).toBe(3);
    expect(countMatches(markup, /class="recharts-surface"/g)).toBe(3);
    expect(markup).not.toContain("No phase savings are available yet.");
    expect(markup).not.toContain("No category savings are available yet.");
    expect(markup).not.toContain("No savings forecast data is available yet.");
    expect(markup).not.toContain("No live saving cards yet.");
  });

  it("keeps the dashboard charts mounted when malformed records are mixed with usable data", () => {
    const markup = renderDashboard([
      createDashboardCard({
        title: "Valid savings line",
        phase: "VALIDATED",
        calculatedSavings: 50000,
        impactStartDate: new Date("2026-04-01T00:00:00.000Z"),
        category: {
          name: "Resins",
        },
      }),
      createDashboardCard({
        title: "Malformed savings line",
        phase: "REALISED",
        calculatedSavings: Number.NaN,
        impactStartDate: "not-a-real-date",
        category: {
          name: "",
        },
      }),
    ]);

    expect(markup).toContain("Savings by Phase");
    expect(markup).toContain("Savings by Category");
    expect(markup).toContain("Savings Forecast");
    expect(markup).toContain("Development data warning");
    expect(countMatches(markup, /data-dashboard-chart-frame=/g)).toBe(3);
    expect(countMatches(markup, /class="recharts-wrapper"/g)).toBe(3);
    expect(countMatches(markup, /class="recharts-surface"/g)).toBe(3);
    expect(markup).not.toContain("Dashboard charts are unavailable");
    expect(markup).not.toContain("No live saving cards yet.");
    expect(markup).not.toContain("No phase savings are available yet.");
    expect(markup).not.toContain("No category savings are available yet.");
    expect(markup).not.toContain("No savings forecast data is available yet.");
  });
});
