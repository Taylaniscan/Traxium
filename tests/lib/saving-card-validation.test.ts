import { describe, expect, it } from "vitest";

import { savingCardSchema } from "@/lib/validation";

function createValidSavingCardInput(
  overrides: Record<string, unknown> = {}
) {
  return {
    title: "Resin renegotiation",
    description: "Annual resin price renegotiation with the incumbent supplier.",
    savingType: "PRICE_REDUCTION",
    impactType: "HARD_SAVINGS",
    impactRecurrence: "RECURRING",
    budgetImpact: "BUDGET_IMPACT",
    phase: "IDEA",
    supplier: { name: "Supplier A" },
    material: { name: "PET Resin" },
    category: { name: "Packaging" },
    plant: { name: "Amsterdam" },
    businessUnit: { name: "Beverages" },
    buyer: { name: "Strategic Buyer" },
    baselinePrice: 10,
    newPrice: 8,
    annualVolume: 1000,
    currency: "USD",
    fxRate: 1,
    frequency: "RECURRING",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    impactStartDate: "2026-01-01",
    impactEndDate: "2026-12-31",
    ...overrides,
  };
}

describe("savingCardSchema", () => {
  it("accepts a hard-savings card where the new price is below the baseline", () => {
    const result = savingCardSchema.safeParse(createValidSavingCardInput());
    expect(result.success).toBe(true);
  });

  it("rejects a hard-savings card where the new price exceeds the baseline", () => {
    const result = savingCardSchema.safeParse(
      createValidSavingCardInput({ baselinePrice: 10, newPrice: 12 })
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) =>
            issue.path.includes("newPrice") &&
            issue.message.includes("hard savings")
        )
      ).toBe(true);
    }
  });

  it("accepts a cost-avoidance card where the new price exceeds the baseline (mitigated increase)", () => {
    const result = savingCardSchema.safeParse(
      createValidSavingCardInput({
        impactType: "COST_AVOIDANCE",
        baselinePrice: 10,
        newPrice: 12,
        referencePrice: 15,
      })
    );

    expect(result.success).toBe(true);
  });

  it("requires a reference price for cost-avoidance cards", () => {
    const result = savingCardSchema.safeParse(
      createValidSavingCardInput({ impactType: "COST_AVOIDANCE" })
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path.includes("referencePrice"))
      ).toBe(true);
    }
  });

  it("rejects a cost-avoidance card whose reference price is not above the new price", () => {
    const result = savingCardSchema.safeParse(
      createValidSavingCardInput({
        impactType: "COST_AVOIDANCE",
        newPrice: 8,
        referencePrice: 8,
      })
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) =>
            issue.path.includes("referencePrice") &&
            issue.message.includes("greater than the new price")
        )
      ).toBe(true);
    }
  });
});
