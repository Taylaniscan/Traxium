import { describe, expect, it } from "vitest";

import {
  parseSavingType,
  parseSavingsBudgetImpact,
  parseSavingsImpactRecurrence,
  parseSavingsImpactType,
  savingTypeLabels,
  savingsBudgetImpactLabels,
  savingsImpactRecurrenceLabels,
  savingsImpactTypeLabels,
} from "@/lib/constants";

describe("procurement savings classification", () => {
  it("maps customer-facing labels and reasonable value aliases to enums", () => {
    expect(parseSavingType("Rebate / Credit")).toBe("REBATE_CREDIT");
    expect(parseSavingType("Commercial negotiation")).toBe("PRICE_REDUCTION");
    expect(parseSavingType("Supplier Change")).toBe("SUPPLIER_SWITCH");
    expect(parseSavingsImpactType("Risk / Continuity Benefit")).toBe(
      "RISK_CONTINUITY_BENEFIT"
    );
    expect(parseSavingsImpactRecurrence("One Time")).toBe("ONE_TIME");
    expect(parseSavingsBudgetImpact("Operational Benefit")).toBe(
      "NON_BUDGET_OPERATIONAL_BENEFIT"
    );
  });

  it("maps enums back to controller-friendly labels", () => {
    expect(savingTypeLabels.FREIGHT_LOGISTICS).toBe("Freight / Logistics");
    expect(savingsImpactTypeLabels.HARD_SAVINGS).toBe("Hard Savings");
    expect(savingsImpactRecurrenceLabels.ONE_TIME).toBe("One-Time");
    expect(savingsBudgetImpactLabels.FORECAST_AVOIDANCE).toBe(
      "Forecast Avoidance"
    );
  });

  it("does not guess when a supplied classification label is invalid", () => {
    expect(parseSavingType("Guaranteed audited saving")).toBeNull();
    expect(parseSavingsImpactType("Margin magic")).toBeNull();
    expect(parseSavingsImpactRecurrence("Forever maybe")).toBeNull();
    expect(parseSavingsBudgetImpact("GAAP recognized")).toBeNull();
  });
});
