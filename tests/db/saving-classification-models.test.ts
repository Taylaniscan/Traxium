import { readFileSync } from "node:fs";
import path from "node:path";

import {
  Prisma,
  SavingType,
  SavingsBudgetImpact,
  SavingsImpactRecurrence,
  SavingsImpactType,
} from "@prisma/client";
import { describe, expect, it } from "vitest";

function getSavingCardField(name: string) {
  const model = Prisma.dmmf.datamodel.models.find(
    (candidate) => candidate.name === "SavingCard"
  );
  const field = model?.fields.find((candidate) => candidate.name === name);

  if (!field) throw new Error(`SavingCard.${name} is missing.`);
  return field;
}

describe("saving classification schema", () => {
  it("defines required enum fields with finance-safe defaults", () => {
    expect(getSavingCardField("savingType")).toMatchObject({
      kind: "enum",
      type: "SavingType",
      isRequired: true,
      hasDefaultValue: true,
      default: "PRICE_REDUCTION",
    });
    expect(getSavingCardField("impactType")).toMatchObject({
      kind: "enum",
      type: "SavingsImpactType",
      default: "HARD_SAVINGS",
    });
    expect(getSavingCardField("impactRecurrence")).toMatchObject({
      kind: "enum",
      type: "SavingsImpactRecurrence",
      default: "RECURRING",
    });
    expect(getSavingCardField("budgetImpact")).toMatchObject({
      kind: "enum",
      type: "SavingsBudgetImpact",
      default: "BUDGET_IMPACT",
    });
  });

  it("exposes every supported classification enum value through Prisma client", () => {
    expect(Object.values(SavingType)).toEqual([
      "PRICE_REDUCTION",
      "SUPPLIER_SWITCH",
      "REBATE_CREDIT",
      "SPECIFICATION_CHANGE",
      "VOLUME_CONSOLIDATION",
      "FREIGHT_LOGISTICS",
      "PAYMENT_TERMS",
      "PROCESS_TOLLING",
      "COST_AVOIDANCE",
      "OTHER",
    ]);
    expect(Object.values(SavingsImpactType)).toContain("COST_AVOIDANCE");
    expect(Object.values(SavingsImpactRecurrence)).toEqual([
      "RECURRING",
      "ONE_TIME",
      "TEMPORARY",
      "UNKNOWN",
    ]);
    expect(Object.values(SavingsBudgetImpact)).toContain("FORECAST_AVOIDANCE");
  });

  it("preserves the old free-text field during migration", () => {
    const migration = readFileSync(
      path.join(
        process.cwd(),
        "prisma/migrations/20260605120000_add_savings_classification/migration.sql"
      ),
      "utf8"
    );

    expect(migration).toContain(
      'RENAME COLUMN "savingType" TO "legacySavingsMethod"'
    );
    expect(migration).toContain(
      "ADD COLUMN \"savingType\" \"SavingType\" NOT NULL DEFAULT 'PRICE_REDUCTION'"
    );
  });
});
