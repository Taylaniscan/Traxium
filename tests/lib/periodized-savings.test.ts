import { describe, expect, it } from "vitest";

import {
  calculatePeriodizedSavings,
  impactDurationYears,
} from "@/lib/calculations";

const baseArgs = {
  baselinePrice: 100,
  newPrice: 90,
  annualVolume: 1000,
  fxRate: 1,
  currency: "USD" as const,
  // 12-month impact window beginning at the start of a calendar fiscal year.
  impactStartDate: new Date(Date.UTC(2026, 0, 1)),
  impactEndDate: new Date(Date.UTC(2026, 11, 31)),
  fiscalYear: { startMonth: 1 },
};

describe("calculatePeriodizedSavings", () => {
  it("annualizes the run-rate as price delta times annual volume", () => {
    const result = calculatePeriodizedSavings(baseArgs);

    expect(result.annualizedRunRate).toBe(10_000);
  });

  it("prorates in-year value to the fiscal year that contains the impact start (Oct start, Jan FY -> 3/12)", () => {
    const result = calculatePeriodizedSavings({
      ...baseArgs,
      impactStartDate: new Date(Date.UTC(2026, 9, 1)), // Oct 1
      impactEndDate: new Date(Date.UTC(2027, 8, 30)), // Sep 30 next year (12-month run)
    });

    // Oct, Nov, Dec fall inside the Jan-Dec 2026 fiscal year: 3/12 of the run-rate.
    expect(result.inYearValue).toBeCloseTo(2_500, 6);
    expect(result.annualizedRunRate).toBe(10_000);
  });

  it("gives a full in-year value when the impact spans the whole fiscal year", () => {
    const result = calculatePeriodizedSavings(baseArgs);

    expect(result.inYearValue).toBeCloseTo(10_000, 6);
  });

  it("computes multi-year total value as run-rate times duration in years", () => {
    const result = calculatePeriodizedSavings({
      ...baseArgs,
      impactStartDate: new Date(Date.UTC(2026, 0, 1)),
      impactEndDate: new Date(Date.UTC(2028, 11, 31)), // 3 full years
    });

    expect(result.totalValue).toBeCloseTo(30_000, 6);
  });

  it("uses reference price for the delta on cost-avoidance cards", () => {
    const result = calculatePeriodizedSavings({
      ...baseArgs,
      impactType: "COST_AVOIDANCE",
      baselinePrice: 100,
      newPrice: 100, // no reduction against baseline
      referencePrice: 120, // avoided a 20/unit increase
    });

    expect(result.annualizedRunRate).toBe(20_000);
  });

  it("converts to USD using the fx rate for EUR cards and is identity for USD cards", () => {
    const eur = calculatePeriodizedSavings({
      ...baseArgs,
      currency: "EUR",
      fxRate: 1.1,
    });
    const usd = calculatePeriodizedSavings({ ...baseArgs, currency: "USD", fxRate: 1.1 });

    expect(eur.annualizedRunRate).toBe(10_000);
    expect(eur.annualizedRunRateUSD).toBeCloseTo(11_000, 6);
    expect(usd.annualizedRunRateUSD).toBe(10_000);
  });

  it("derives impact duration in years from the impact window (replacing the magic multiplier)", () => {
    expect(
      impactDurationYears(
        new Date(Date.UTC(2026, 0, 1)),
        new Date(Date.UTC(2026, 11, 31))
      )
    ).toBeCloseTo(1, 6);
    expect(
      impactDurationYears(
        new Date(Date.UTC(2026, 0, 1)),
        new Date(Date.UTC(2028, 11, 31))
      )
    ).toBeCloseTo(3, 6);
    expect(
      impactDurationYears(
        new Date(Date.UTC(2026, 11, 31)),
        new Date(Date.UTC(2026, 0, 1))
      )
    ).toBe(0);
  });

  it("returns zeros for invalid numeric input", () => {
    const result = calculatePeriodizedSavings({
      ...baseArgs,
      baselinePrice: Number.NaN,
    });

    expect(result.annualizedRunRate).toBe(0);
    expect(result.inYearValue).toBe(0);
    expect(result.totalValue).toBe(0);
  });
});
