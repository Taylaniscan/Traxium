import { describe, expect, it } from "vitest";

import { calculateSavings } from "@/lib/calculations";

describe("calculateSavings (USD canonical reporting)", () => {
  it("reports USD equal to local for a USD card", () => {
    const result = calculateSavings({
      baselinePrice: 10,
      newPrice: 8,
      annualVolume: 1000,
      fxRate: 1,
      currency: "USD",
    });

    expect(result.localSavings).toBe(2000);
    expect(result.savingsUSD).toBe(2000);
  });

  it("converts a non-USD card to USD using the fx rate", () => {
    const result = calculateSavings({
      baselinePrice: 10,
      newPrice: 8,
      annualVolume: 1000,
      fxRate: 1.1, // EUR -> USD
      currency: "EUR",
    });

    expect(result.localSavings).toBe(2000);
    expect(result.savingsUSD).toBeCloseTo(2200, 6);
  });

  it("does not expose a EUR pivot figure", () => {
    const result = calculateSavings({
      baselinePrice: 10,
      newPrice: 8,
      annualVolume: 1000,
      fxRate: 1,
      currency: "USD",
    });

    expect("savingsEUR" in result).toBe(false);
  });

  it("uses the reference price for cost-avoidance savings", () => {
    const result = calculateSavings({
      baselinePrice: 10,
      newPrice: 12,
      annualVolume: 1000,
      fxRate: 1,
      currency: "USD",
      impactType: "COST_AVOIDANCE",
      referencePrice: 15,
    });

    expect(result.savingsUSD).toBe(3000);
  });
});
