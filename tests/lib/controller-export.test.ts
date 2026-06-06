import { Phase } from "@prisma/client";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import {
  buildControllerWorkbookModel,
  controllerSavingCardColumns,
  importTemplateColumns,
  mapSavingCardsForControllerExport,
} from "@/lib/export/controller-workbook";
import { renderControllerWorkbookXlsx } from "@/lib/export/controller-workbook-xlsx";
import type { SavingCardPortfolio, WorkspaceReadiness } from "@/lib/types";

function createCard(
  overrides: Partial<SavingCardPortfolio> = {}
): SavingCardPortfolio {
  return {
    id: "card-1",
    title: "PP carrier negotiation",
    description: "Annual supplier negotiation using an approved price baseline.",
    savingType: "PRICE_REDUCTION",
    impactType: "HARD_SAVINGS",
    impactRecurrence: "RECURRING",
    budgetImpact: "BUDGET_IMPACT",
    phase: Phase.VALIDATED,
    supplierId: "supplier-1",
    materialId: "material-1",
    categoryId: "category-1",
    plantId: "plant-1",
    businessUnitId: "business-unit-1",
    buyerId: "buyer-1",
    alternativeSupplierManualName: "Backup Polymer Supplier",
    alternativeMaterialManualName: null,
    baselinePrice: 12,
    newPrice: 10,
    annualVolume: 1000,
    volumeUnit: "lb",
    currency: "USD",
    calculatedSavings: 1840,
    calculatedSavingsUSD: 2000,
    frequency: "RECURRING",
    savingDriver: "Negotiation",
    implementationComplexity: "Medium",
    qualificationStatus: "Approved",
    startDate: new Date("2026-01-01T00:00:00.000Z"),
    endDate: new Date("2026-12-31T00:00:00.000Z"),
    impactStartDate: new Date("2026-02-01T00:00:00.000Z"),
    impactEndDate: new Date("2026-12-31T00:00:00.000Z"),
    financeLocked: true,
    cancellationReason: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-04-01T00:00:00.000Z"),
    evidence: [
      {
        id: "evidence-1",
        evidenceType: "SUPPLIER_QUOTE",
        uploadedAt: new Date("2026-03-15T00:00:00.000Z"),
      },
    ],
    supplier: { id: "supplier-1", name: "Current Polymer Supplier" },
    material: { id: "material-1", name: "PP Homopolymer Carrier" },
    alternativeSupplier: null,
    alternativeMaterial: null,
    category: { id: "category-1", name: "Polymer Carriers" },
    buyer: { id: "buyer-1", name: "Strategic Buyer" },
    plant: { id: "plant-1", name: "Ohio Compounding Site" },
    businessUnit: {
      id: "business-unit-1",
      name: "Packaging Colorants",
    },
    phaseChangeRequests: [
      {
        id: "request-1",
        approvalStatus: "PENDING",
        requestedPhase: Phase.REALISED,
        requestedBy: {
          id: "user-1",
          name: "Strategic Buyer",
        },
      },
    ],
    phaseHistory: [
      {
        toPhase: Phase.VALIDATED,
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
      },
    ],
    ...overrides,
  };
}

function createReadiness(): WorkspaceReadiness {
  return {
    workspace: {
      id: "org-1",
      name: "Atlas Manufacturing",
      slug: "atlas-manufacturing",
      description: "Manufacturing procurement workspace.",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-04-01T00:00:00.000Z"),
    },
    counts: {
      users: 4,
      buyers: 2,
      suppliers: 3,
      materials: 3,
      categories: 2,
      plants: 1,
      businessUnits: 1,
      savingCards: 3,
    },
    masterData: [],
    workflowCoverage: [],
    coverage: {
      masterDataReadyCount: 6,
      masterDataTotal: 6,
      workflowReadyCount: 3,
      workflowTotal: 3,
      overallPercent: 100,
    },
    activity: {
      firstSavingCardCreatedAt: new Date("2026-01-01T00:00:00.000Z"),
      lastPortfolioUpdateAt: new Date("2026-04-01T00:00:00.000Z"),
    },
    isMasterDataReady: true,
    isWorkflowReady: true,
    isWorkspaceReady: true,
    missingCoreSetup: [],
    missingWorkflowCoverage: [],
  };
}

describe("controller workbook model", () => {
  it("builds controller-facing rows without internal IDs or storage details", () => {
    const rows = mapSavingCardsForControllerExport([createCard()]);
    const serialized = JSON.stringify(rows).toLowerCase();

    expect(controllerSavingCardColumns).toContain("Saving Card Title");
    expect(controllerSavingCardColumns).toContain("Finance Lock Status");
    expect(controllerSavingCardColumns).toContain("Evidence Status");
    expect(controllerSavingCardColumns).toContain("Pending Approval Status");
    expect(controllerSavingCardColumns).not.toContain("Card ID");
    expect(rows[0]).toMatchObject({
      "Saving Card Title": "PP carrier negotiation",
      Phase: "Finance Validated",
      "Savings Type": "Price Reduction",
      "Buyer / Owner": "Strategic Buyer",
      Plant: "Ohio Compounding Site",
      "Alternative Supplier": "Backup Polymer Supplier",
      "Calculated Savings (Local)": 2000,
      "Savings EUR": 1840,
      "Finance Lock Status": "Locked",
      "Evidence Status": "Evidence attached",
      "Pending Approval Status": "Pending: Implemented",
    });
    expect(serialized).not.toContain("storagepath");
    expect(serialized).not.toContain("storagebucket");
    expect(serialized).not.toContain("signedurl");
    expect(serialized).not.toContain("token");
    expect(serialized).not.toContain("providerid");
  });

  it("reconciles active totals, phase counts, evidence coverage, and canceled-card treatment", () => {
    const cards = [
      createCard(),
      createCard({
        id: "card-2",
        title: "Captured rebate",
        phase: Phase.ACHIEVED,
        calculatedSavings: 30000,
        calculatedSavingsUSD: 32608.7,
        financeLocked: false,
        evidence: [],
        phaseChangeRequests: [],
      }),
      createCard({
        id: "card-3",
        title: "Canceled specification trial",
        phase: Phase.CANCELLED,
        calculatedSavings: 12000,
        calculatedSavingsUSD: 13043.48,
        financeLocked: false,
        cancellationReason: "Technical qualification failed.",
        evidence: [],
        phaseChangeRequests: [],
      }),
    ];
    const model = buildControllerWorkbookModel({
      cards,
      generatedAt: new Date("2026-06-05T12:00:00.000Z"),
      workspaceReadiness: createReadiness(),
    });

    expect(model.savingCardRows).toHaveLength(3);
    expect(model.evidenceSummaryRows).toHaveLength(3);
    expect(model.importTemplateRows).toHaveLength(1);
    expect(importTemplateColumns).toContain("Business Case / Notes");
    expect(model.importTemplateRows[0]).toMatchObject({
      Phase: "Proposed",
      Currency: "EUR",
    });
    expect(model.reconciliation).toMatchObject({
      activeCardCount: 2,
      activeSavings: 31840,
      activeRowSavings: 31840,
      difference: 0,
      evidenceCoveragePercent: 50,
      financeLockedSavings: 1840,
    });
    expect(model.reconciliation.phaseCounts).toMatchObject({
      VALIDATED: 1,
      ACHIEVED: 1,
      CANCELLED: 1,
    });
    expect(model.dataDictionaryRows).toContainEqual([
      "Savings Formula",
      "(Baseline Price - New Price) × Annual Volume",
      "Traxium does not calculate accounting recognition.",
    ]);
    expect(
      model.portfolioSummaryRows.find(
        (row) => row[0] === "Reconciliation Difference (EUR)"
      )
    ).toEqual([
      "Reconciliation Difference (EUR)",
      0,
      "Expected to equal zero",
    ]);
  });

  it("renders and parses the five required XLSX sheets", () => {
    const model = buildControllerWorkbookModel({
      cards: [createCard()],
      generatedAt: new Date("2026-06-05T12:00:00.000Z"),
      workspaceReadiness: createReadiness(),
    });
    const buffer = renderControllerWorkbookXlsx({
      model,
      workspaceName: "Atlas Manufacturing",
    });
    const workbook = XLSX.read(buffer, {
      type: "buffer",
      cellDates: true,
      cellStyles: true,
    });

    expect(workbook.SheetNames).toEqual([
      "Portfolio Summary",
      "Saving Cards",
      "Data Dictionary",
      "Import Template",
      "Evidence Summary",
    ]);
    expect(
      XLSX.utils.sheet_to_json(workbook.Sheets["Saving Cards"])
    ).toHaveLength(1);
    expect(
      XLSX.utils.sheet_to_json(workbook.Sheets["Import Template"])
    ).toHaveLength(1);
    expect(
      XLSX.utils.sheet_to_json(workbook.Sheets["Portfolio Summary"], {
        header: 1,
      })
    ).toContainEqual([
      "Reconciliation Difference (EUR)",
      0,
      "Expected to equal zero",
    ]);
  });
});
