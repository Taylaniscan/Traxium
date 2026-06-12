import { describe, expect, it } from "vitest";

import {
  assembleMonthlyClose,
  computeActualizedSavings,
  lastCompletedMonthStart,
  monthCoverageFraction,
  monthKey,
  parseMonthKey,
} from "@/lib/monthly-close";

describe("month helpers", () => {
  it("resolves the last completed month (UTC), wrapping the year", () => {
    expect(monthKey(lastCompletedMonthStart(new Date("2026-04-10T00:00:00Z")))).toBe(
      "2026-03"
    );
    expect(monthKey(lastCompletedMonthStart(new Date("2026-01-05T00:00:00Z")))).toBe(
      "2025-12"
    );
  });

  it("parses YYYY-MM into a first-of-month UTC date and rejects junk", () => {
    expect(monthKey(parseMonthKey("2026-03")!)).toBe("2026-03");
    expect(parseMonthKey("nope")).toBeNull();
    expect(parseMonthKey("2026-13")).toBeNull();
  });

  it("prorates month coverage by day for partial impact windows", () => {
    const march = new Date(Date.UTC(2026, 2, 1));
    // Full coverage
    expect(
      monthCoverageFraction(
        new Date(Date.UTC(2026, 0, 1)),
        new Date(Date.UTC(2026, 11, 31)),
        march
      )
    ).toBeCloseTo(1, 6);
    // Impact starts mid-March (16th) -> 16 of 31 days covered
    expect(
      monthCoverageFraction(
        new Date(Date.UTC(2026, 2, 16)),
        new Date(Date.UTC(2026, 11, 31)),
        march
      )
    ).toBeCloseTo(16 / 31, 6);
    // No overlap
    expect(
      monthCoverageFraction(
        new Date(Date.UTC(2026, 5, 1)),
        new Date(Date.UTC(2026, 11, 31)),
        march
      )
    ).toBe(0);
  });
});

describe("computeActualizedSavings", () => {
  it("sums actual quantity times the hard-savings unit delta in USD", () => {
    const result = computeActualizedSavings({
      baselinePrice: 10,
      newPrice: 8,
      impactType: "HARD_SAVINGS",
      currency: "USD",
      fxRate: 1,
      actuals: [{ actualQty: 100 }, { actualQty: 150 }],
    });
    // (10 - 8) * 250
    expect(result.actualizedLocal).toBe(500);
    expect(result.actualizedUSD).toBe(500);
    expect(result.actualPeriodCount).toBe(2);
  });

  it("uses the reference price for the cost-avoidance basis", () => {
    const result = computeActualizedSavings({
      baselinePrice: 10,
      newPrice: 12,
      referencePrice: 15,
      impactType: "COST_AVOIDANCE",
      currency: "USD",
      fxRate: 1,
      actuals: [{ actualQty: 100 }],
    });
    // (15 - 12) * 100
    expect(result.actualizedLocal).toBe(300);
    expect(result.actualizedUSD).toBe(300);
  });

  it("converts a non-USD card to USD with its fx rate", () => {
    const result = computeActualizedSavings({
      baselinePrice: 10,
      newPrice: 8,
      currency: "EUR",
      fxRate: 1.1,
      actuals: [{ actualQty: 100 }],
    });
    expect(result.actualizedLocal).toBe(200);
    expect(result.actualizedUSD).toBeCloseTo(220, 6);
  });
});

describe("assembleMonthlyClose", () => {
  const march = new Date(Date.UTC(2026, 2, 1));

  const baseCard = {
    id: "card-1",
    title: "Resin renegotiation",
    phase: "VALIDATED" as const,
    currency: "USD" as const,
    impactType: "HARD_SAVINGS" as const,
    baselinePrice: 10,
    newPrice: 8,
    referencePrice: null,
    fxRate: 1,
    annualizedRunRate: 24000,
    annualizedRunRateUSD: 24000,
    impactStartDate: new Date(Date.UTC(2026, 0, 1)),
    impactEndDate: new Date(Date.UTC(2026, 11, 31)),
  };

  it("groups cards into closed / missing-actuals / needs-finance-review and prorates the month value", () => {
    const summary = assembleMonthlyClose({
      monthStart: march,
      cards: [
        baseCard,
        { ...baseCard, id: "card-2", title: "Missing one" },
        { ...baseCard, id: "card-3", title: "Pending review" },
        {
          ...baseCard,
          id: "card-4",
          title: "Out of window",
          impactStartDate: new Date(Date.UTC(2026, 5, 1)),
          impactEndDate: new Date(Date.UTC(2026, 11, 31)),
        },
      ],
      forecastsByCard: new Map([
        ["card-1", 100],
        ["card-2", 100],
        ["card-3", 100],
      ]),
      actualsByCard: new Map([
        ["card-1", 120],
        ["card-3", 90],
      ]),
      pendingRequestCardIds: new Set(["card-3"]),
    });

    // card-4 has no March overlap -> excluded
    expect(summary.totalCards).toBe(3);
    expect(summary.closedCount).toBe(1); // card-1
    expect(summary.missingActualsCount).toBe(1); // card-2
    expect(summary.needsFinanceReviewCount).toBe(1); // card-3 (pending request)

    const byId = new Map(summary.cards.map((c) => [c.savingCardId, c]));
    expect(byId.get("card-1")!.status).toBe("closed");
    expect(byId.get("card-2")!.status).toBe("missing-actuals");
    expect(byId.get("card-3")!.status).toBe("needs-finance-review");

    // Variance: card-1 actual 120 vs forecast 100 = +20
    expect(byId.get("card-1")!.varianceQty).toBe(20);
    // Prorated month value at run-rate: 24000 / 12 * full coverage = 2000
    expect(byId.get("card-1")!.proratedMonthValueUSD).toBeCloseTo(2000, 6);
    // Forecast/actual savings: (10-8) * qty
    expect(byId.get("card-1")!.actualSavingsUSD).toBe(240);
    expect(summary.totalForecastSavingsUSD).toBe(600); // 3 cards * 100 * 2
    expect(summary.totalActualSavingsUSD).toBe(420); // (120 + 90) * 2
    expect(summary.month).toBe("2026-03");
  });
});
