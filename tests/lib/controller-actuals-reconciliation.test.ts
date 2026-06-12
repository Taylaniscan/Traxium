import { Phase } from "@prisma/client";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import {
  buildActualsReconciliationRows,
  buildControllerWorkbookModel,
  controllerActualsReconciliationColumns,
  type ControllerActualsByCard,
} from "@/lib/export/controller-workbook";
import { renderControllerWorkbookXlsx } from "@/lib/export/controller-workbook-xlsx";
import type { SavingCardPortfolio, WorkspaceReadiness } from "@/lib/types";

function createCard(
  overrides: Partial<Record<keyof SavingCardPortfolio, unknown>> = {}
): SavingCardPortfolio {
  return {
    id: "card-1",
    title: "PP carrier negotiation",
    description: "Annual negotiation.",
    savingType: "PRICE_REDUCTION",
    impactType: "HARD_SAVINGS",
    impactRecurrence: "RECURRING",
    budgetImpact: "BUDGET_IMPACT",
    phase: Phase.VALIDATED,
    supplierId: null,
    materialId: null,
    categoryId: null,
    plantId: null,
    businessUnitId: null,
    buyerId: null,
    alternativeSupplierManualName: null,
    alternativeMaterialManualName: null,
    baselinePrice: 12,
    newPrice: 10,
    referencePrice: null,
    annualVolume: 1000,
    volumeUnit: "lb",
    currency: "USD",
    calculatedSavings: 2000,
    calculatedSavingsUSD: 2000,
    annualizedRunRate: 2000,
    annualizedRunRateUSD: 2000,
    inYearValue: 2000,
    inYearValueUSD: 2000,
    frequency: "RECURRING",
    savingDriver: "Negotiation",
    implementationComplexity: "Medium",
    qualificationStatus: "Approved",
    startDate: new Date("2026-01-01T00:00:00.000Z"),
    endDate: new Date("2026-12-31T00:00:00.000Z"),
    impactStartDate: new Date("2026-01-01T00:00:00.000Z"),
    impactEndDate: new Date("2026-12-31T00:00:00.000Z"),
    financeLocked: false,
    cancellationReason: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-04-01T00:00:00.000Z"),
    evidence: [],
    supplier: null,
    material: null,
    alternativeSupplier: null,
    alternativeMaterial: null,
    category: null,
    buyer: null,
    plant: null,
    businessUnit: null,
    phaseChangeRequests: [],
    phaseHistory: [],
    ...overrides,
  } as unknown as SavingCardPortfolio;
}

const workspaceReadiness = {
  workspace: { name: "UtopiaTrax", slug: "utopiatrax" },
  activity: { lastPortfolioUpdateAt: null },
} as unknown as WorkspaceReadiness;

describe("buildActualsReconciliationRows", () => {
  it("emits a row per card-period with forecast/actual qty, invoice and actualized value", () => {
    const card = createCard();
    const actuals: ControllerActualsByCard = new Map([
      [
        "card-1",
        {
          forecasts: [
            { period: new Date(Date.UTC(2026, 2, 1)), forecastQty: 100 },
            { period: new Date(Date.UTC(2026, 3, 1)), forecastQty: 100 },
          ],
          actuals: [
            {
              period: new Date(Date.UTC(2026, 2, 1)),
              actualQty: 90,
              invoiceRef: "INV-1",
            },
          ],
        },
      ],
    ]);

    const rows = buildActualsReconciliationRows([card], actuals);
    expect(rows).toHaveLength(2);

    const march = rows[0];
    expect(march["Period"]).toBe("2026-03");
    expect(march["Forecast Qty"]).toBe(100);
    expect(march["Actual Qty"]).toBe(90);
    expect(march["Variance Qty"]).toBe(-10);
    expect(march["Invoice Ref"]).toBe("INV-1");
    expect(march["Unit Saving (Local)"]).toBe(2);
    expect(march["Forecast Value (Local)"]).toBe(200);
    expect(march["Actual Value (Local)"]).toBe(180);
    expect(march["Actual Value (USD)"]).toBe(180);

    const april = rows[1];
    expect(april["Period"]).toBe("2026-04");
    expect(april["Actual Qty"]).toBe("");
    expect(april["Actual Value (USD)"]).toBe(0);
  });

  it("uses the cost-avoidance basis (reference - new) for the unit delta", () => {
    const card = createCard({
      impactType: "COST_AVOIDANCE",
      baselinePrice: 0,
      newPrice: 12,
      referencePrice: 15,
    });
    const actuals: ControllerActualsByCard = new Map([
      [
        "card-1",
        {
          forecasts: [],
          actuals: [
            {
              period: new Date(Date.UTC(2026, 4, 1)),
              actualQty: 100,
              invoiceRef: null,
            },
          ],
        },
      ],
    ]);

    const rows = buildActualsReconciliationRows([card], actuals);
    expect(rows[0]["Unit Saving (Local)"]).toBe(3);
    expect(rows[0]["Actual Value (Local)"]).toBe(300);
  });

  it("converts non-USD actual value with the card's effective FX ratio", () => {
    const card = createCard({
      currency: "EUR",
      calculatedSavings: 1000,
      calculatedSavingsUSD: 1100,
    });
    const actuals: ControllerActualsByCard = new Map([
      [
        "card-1",
        {
          forecasts: [],
          actuals: [
            {
              period: new Date(Date.UTC(2026, 4, 1)),
              actualQty: 100,
              invoiceRef: null,
            },
          ],
        },
      ],
    ]);

    const rows = buildActualsReconciliationRows([card], actuals);
    expect(rows[0]["Actual Value (Local)"]).toBe(200);
    expect(rows[0]["Actual Value (USD)"]).toBeCloseTo(220, 6);
  });
});

describe("buildControllerWorkbookModel with actuals", () => {
  it("attaches reconciliation rows and estimate-vs-actual USD totals", () => {
    const card = createCard();
    const actuals: ControllerActualsByCard = new Map([
      [
        "card-1",
        {
          forecasts: [
            { period: new Date(Date.UTC(2026, 2, 1)), forecastQty: 100 },
            { period: new Date(Date.UTC(2026, 3, 1)), forecastQty: 100 },
          ],
          actuals: [
            {
              period: new Date(Date.UTC(2026, 2, 1)),
              actualQty: 90,
              invoiceRef: "INV-1",
            },
          ],
        },
      ],
    ]);

    const model = buildControllerWorkbookModel({
      cards: [card],
      generatedAt: new Date("2026-05-01T00:00:00.000Z"),
      workspaceReadiness,
      actuals,
    });

    expect(model.actualsReconciliationRows).toHaveLength(2);
    expect(model.reconciliation.actualsForecastValueUSD).toBe(400);
    expect(model.reconciliation.actualsActualValueUSD).toBe(180);
    expect(model.reconciliation.actualsVarianceUSD).toBe(-220);
  });

  it("renders an Actuals Reconciliation sheet in the workbook", () => {
    const card = createCard();
    const actuals: ControllerActualsByCard = new Map([
      [
        "card-1",
        {
          forecasts: [{ period: new Date(Date.UTC(2026, 2, 1)), forecastQty: 100 }],
          actuals: [
            {
              period: new Date(Date.UTC(2026, 2, 1)),
              actualQty: 90,
              invoiceRef: "INV-1",
            },
          ],
        },
      ],
    ]);

    const model = buildControllerWorkbookModel({
      cards: [card],
      generatedAt: new Date("2026-05-01T00:00:00.000Z"),
      workspaceReadiness,
      actuals,
    });
    const buffer = renderControllerWorkbookXlsx({
      model,
      workspaceName: "UtopiaTrax",
    });
    const workbook = XLSX.read(buffer, { type: "buffer" });
    expect(workbook.SheetNames).toContain("Actuals Reconciliation");

    const sheet = workbook.Sheets["Actuals Reconciliation"];
    const headerRow = (
      XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })[0] ?? []
    ) as string[];
    for (const column of controllerActualsReconciliationColumns) {
      expect(headerRow).toContain(column);
    }
  });

  it("produces an empty reconciliation set when no actuals are supplied", () => {
    const model = buildControllerWorkbookModel({
      cards: [createCard()],
      generatedAt: new Date("2026-05-01T00:00:00.000Z"),
      workspaceReadiness,
    });
    expect(model.actualsReconciliationRows).toEqual([]);
    expect(model.reconciliation.actualsActualValueUSD).toBe(0);
  });
});
