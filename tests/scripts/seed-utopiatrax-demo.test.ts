import {
  Currency,
  EvidenceType,
  Frequency,
  Phase,
  SavingType,
  SavingsBudgetImpact,
  SavingsImpactRecurrence,
  SavingsImpactType,
} from "@prisma/client";
import { describe, expect, it } from "vitest";

import { calculateSavings } from "@/lib/calculations";
import { buildControllerWorkbookModel } from "@/lib/export/controller-workbook";
import type { SavingCardPortfolio, WorkspaceReadiness } from "@/lib/types";
import {
  getUnexpectedUtopiaTraxWorkspaceUsers,
  getUtopiaTraxResetSafetyViolations,
  UTOPIATRAX_SHOWCASE_CARD_TITLE,
} from "@/scripts/utopiatrax-demo-contract";
import {
  getUtopiaTraxExpectedPendingOpenActionCount,
  getUtopiaTraxDatasetSummary,
  getUtopiaTraxNaturalKeys,
  UTOPIATRAX_DEMO_TRIAL_END,
  UTOPIATRAX_DIRECT_CATEGORIES,
  UTOPIATRAX_PENDING_PHASE_REQUESTS,
  UTOPIATRAX_SAVING_CARDS,
  shouldPersistUtopiaTraxEvidenceRecord,
  validateUtopiaTraxDemoDataset,
} from "@/scripts/seed-utopiatrax-demo";
import { createUtopiaTraxReadiness } from "../helpers/utopiatrax-demo-fixtures";

describe("UtopiaTrax demo seed dataset", () => {
  it("defines the required manufacturing demo portfolio shape", () => {
    const summary = getUtopiaTraxDatasetSummary();

    expect(validateUtopiaTraxDemoDataset()).toEqual([]);
    expect(summary.savingCardCount).toBe(25);
    expect(summary.directCategoryCount).toBe(6);
    expect(summary.phaseCounts).toEqual({
      [Phase.IDEA]: 5,
      [Phase.VALIDATED]: 7,
      [Phase.REALISED]: 7,
      [Phase.ACHIEVED]: 4,
      [Phase.CANCELLED]: 2,
    });
    expect(summary.categoriesRepresented).toEqual(
      [...UTOPIATRAX_DIRECT_CATEGORIES.map((category) => category.name)].sort()
    );
  });

  it("keeps finance locks restricted to Validated saving cards", () => {
    const financeLockedCards = UTOPIATRAX_SAVING_CARDS.filter(
      (card) => card.financeLocked
    );

    expect(financeLockedCards.length).toBeGreaterThanOrEqual(5);
    expect(financeLockedCards.every((card) => card.phase === Phase.VALIDATED)).toBe(
      true
    );
    expect(getUtopiaTraxDatasetSummary().financeLockedViolations).toEqual([]);
  });

  it("includes evidence, alternatives, and USD-only currency data for demo surfaces", () => {
    const summary = getUtopiaTraxDatasetSummary();
    const currencies = new Set(UTOPIATRAX_SAVING_CARDS.map((card) => card.currency));

    expect(summary.evidenceCount).toBeGreaterThanOrEqual(12);
    expect(
      UTOPIATRAX_SAVING_CARDS.filter((card) => card.evidence.length > 0).length
    ).toBeGreaterThanOrEqual(12);
    expect(
      UTOPIATRAX_SAVING_CARDS.flatMap((card) => card.evidence).every(
        (item) => item.fileName.endsWith(".pdf")
      )
    ).toBe(true);
    expect(summary.alternativeCount).toBeGreaterThanOrEqual(8);
    // USD-only demo workspace: every card is USD and no EUR appears.
    expect(currencies.has(Currency.EUR)).toBe(false);
    expect([...currencies]).toEqual([Currency.USD]);
    expect(shouldPersistUtopiaTraxEvidenceRecord(false)).toBe(false);
    expect(shouldPersistUtopiaTraxEvidenceRecord(true)).toBe(true);
  });

  it("classifies every card with a realistic controller-reporting mix", () => {
    const summary = getUtopiaTraxDatasetSummary();

    expect(
      UTOPIATRAX_SAVING_CARDS.every(
        (card) =>
          card.savingType &&
          card.impactType &&
          card.impactRecurrence &&
          card.budgetImpact
      )
    ).toBe(true);
    expect(summary.savingTypeCounts[SavingType.PRICE_REDUCTION]).toBeGreaterThanOrEqual(8);
    expect(summary.savingTypeCounts[SavingType.SUPPLIER_SWITCH]).toBeGreaterThanOrEqual(4);
    expect(summary.savingTypeCounts[SavingType.REBATE_CREDIT]).toBeGreaterThanOrEqual(3);
    expect(summary.savingTypeCounts[SavingType.SPECIFICATION_CHANGE]).toBeGreaterThanOrEqual(3);
    expect(summary.savingTypeCounts[SavingType.FREIGHT_LOGISTICS]).toBeGreaterThanOrEqual(2);
    expect(summary.savingTypeCounts[SavingType.PROCESS_TOLLING]).toBeGreaterThanOrEqual(2);
    expect(summary.savingTypeCounts[SavingType.PAYMENT_TERMS]).toBeGreaterThanOrEqual(1);
    expect(summary.savingTypeCounts[SavingType.COST_AVOIDANCE]).toBeGreaterThanOrEqual(1);
    expect(summary.impactTypeCounts[SavingsImpactType.HARD_SAVINGS]).toBeGreaterThan(0);
    expect(summary.impactTypeCounts[SavingsImpactType.COST_AVOIDANCE]).toBeGreaterThan(0);
    expect(summary.recurrenceCounts[SavingsImpactRecurrence.RECURRING]).toBeGreaterThan(0);
    expect(
      summary.recurrenceCounts[SavingsImpactRecurrence.ONE_TIME] +
        summary.recurrenceCounts[SavingsImpactRecurrence.TEMPORARY]
    ).toBeGreaterThan(0);
    expect(summary.budgetImpactCounts[SavingsBudgetImpact.BUDGET_IMPACT]).toBeGreaterThan(0);
    expect(summary.budgetImpactCounts[SavingsBudgetImpact.FORECAST_AVOIDANCE]).toBeGreaterThan(0);
  });

  it("includes volume rows, pending actions, and trial billing inputs for demo surfaces", () => {
    const summary = getUtopiaTraxDatasetSummary();

    expect(summary.volumeProfileCount).toBeGreaterThanOrEqual(12);
    // Monthly Close needs both reconciled and still-open cards for the last month.
    expect(summary.volumeActualsThroughLastMonthCount).toBeGreaterThan(0);
    expect(summary.volumeMissingLastMonthCount).toBeGreaterThan(0);
    expect(
      summary.volumeActualsThroughLastMonthCount +
        summary.volumeMissingLastMonthCount
    ).toBe(summary.volumeProfileCount);
    expect(summary.pendingPhaseRequestCount).toBe(5);
    expect(summary.expectedPendingOpenActions).toBe(7);
    expect(summary.expectedPendingOpenActions).toBe(
      getUtopiaTraxExpectedPendingOpenActionCount()
    );
    expect(UTOPIATRAX_PENDING_PHASE_REQUESTS.every((request) => request.comment)).toBe(
      true
    );
    expect(UTOPIATRAX_DEMO_TRIAL_END.toISOString()).toBe(
      "2028-12-31T23:59:59.000Z"
    );
  });

  it("uses stable natural keys so the seed can be rerun idempotently", () => {
    const keys = getUtopiaTraxNaturalKeys();

    expect(keys.organizationSlug).toBe("utopiatrax");
    expect(new Set(keys.userEmails).size).toBe(keys.userEmails.length);
    expect(new Set(keys.categoryNames).size).toBe(keys.categoryNames.length);
    expect(new Set(keys.supplierNames).size).toBe(keys.supplierNames.length);
    expect(new Set(keys.materialNames).size).toBe(keys.materialNames.length);
    expect(new Set(keys.savingCardTitles).size).toBe(keys.savingCardTitles.length);
  });

  it("keeps reset safety bounded to the four known demo users", () => {
    expect(
      getUnexpectedUtopiaTraxWorkspaceUsers([
        "taylaniscan+4@gmail.com",
        "TAYLANISCAN+5@GMAIL.COM",
        "taylaniscan+6@gmail.com",
        "taylaniscan+7@gmail.com",
      ])
    ).toEqual([]);
    expect(
      getUnexpectedUtopiaTraxWorkspaceUsers([
        "taylaniscan+4@gmail.com",
        "real.customer@example.com",
      ])
    ).toEqual(["real.customer@example.com"]);

    expect(
      getUtopiaTraxResetSafetyViolations("org-utopiatrax", [
        {
          email: "taylaniscan+4@gmail.com",
          membershipOrganizationIds: ["org-utopiatrax"],
        },
        {
          email: "taylaniscan+5@gmail.com",
          membershipOrganizationIds: ["org-utopiatrax", "org-customer"],
        },
      ])
    ).toEqual({
      unexpectedEmails: [],
      externalMembershipEmails: ["taylaniscan+5@gmail.com"],
    });
  });

  it("defines one complete showcase card for the buyer walkthrough", () => {
    const showcase = UTOPIATRAX_SAVING_CARDS.find(
      (card) => card.title === UTOPIATRAX_SHOWCASE_CARD_TITLE
    );

    expect(showcase).toMatchObject({
      title: "PP Carrier dual-source negotiation",
      phase: Phase.ACHIEVED,
      volumeProfile: "on-track",
    });
    expect(showcase?.financeLocked).toBeFalsy();
    expect(showcase?.evidence).toHaveLength(5);
    expect(new Set(showcase?.evidence.map((item) => item.evidenceType))).toEqual(
      new Set([
        EvidenceType.SUPPLIER_QUOTE,
        EvidenceType.NEGOTIATION_SUMMARY,
        EvidenceType.PRICE_CONFIRMATION,
        EvidenceType.CALCULATION_WORKBOOK,
        EvidenceType.INVOICE_OR_ACTUAL,
      ])
    );
    expect(showcase?.alternative).toBeTruthy();
  });

  it("produces non-empty reporting-style aggregates from the pure dataset", () => {
    const activeSavings = UTOPIATRAX_SAVING_CARDS.filter(
      (card) => card.phase !== Phase.CANCELLED
    ).reduce(
      (sum, card) =>
        sum +
        (card.baselinePrice - card.newPrice) *
          card.annualVolume *
          (card.currency === Currency.USD ? 0.92 : 1),
      0
    );
    const savingsByCategory = new Map<string, number>();

    for (const card of UTOPIATRAX_SAVING_CARDS) {
      savingsByCategory.set(
        card.categoryName,
        (savingsByCategory.get(card.categoryName) ?? 0) +
          Math.max(0, (card.baselinePrice - card.newPrice) * card.annualVolume)
      );
    }

    expect(activeSavings).toBeGreaterThan(0);
    expect(savingsByCategory.size).toBe(UTOPIATRAX_DIRECT_CATEGORIES.length);
    expect([...savingsByCategory.values()].every((value) => value > 0)).toBe(true);
  });

  it("produces a reconciled, non-empty controller workbook model for all six categories", () => {
    const cards = UTOPIATRAX_SAVING_CARDS.map((card, index) => {
      const totals = calculateSavings({
        baselinePrice: card.baselinePrice,
        newPrice: card.newPrice,
        annualVolume: card.annualVolume,
        currency: card.currency,
        fxRate: card.currency === Currency.USD ? 0.92 : 1.087,
      });

      return {
        id: `card-${index + 1}`,
        title: card.title,
        description: card.narrative,
        savingType: card.savingType,
        impactType: card.impactType,
        impactRecurrence: card.impactRecurrence,
        budgetImpact: card.budgetImpact,
        phase: card.phase,
        supplierId: `supplier-${index + 1}`,
        materialId: `material-${index + 1}`,
        categoryId: `category-${card.categoryName}`,
        plantId: `plant-${card.plantName}`,
        businessUnitId: `business-unit-${card.businessUnitName}`,
        buyerId: `buyer-${card.buyerName}`,
        alternativeSupplierManualName: card.alternativeSupplierName ?? null,
        alternativeMaterialManualName: card.alternative?.materialName ?? null,
        baselinePrice: card.baselinePrice,
        newPrice: card.newPrice,
        annualVolume: card.annualVolume,
        volumeUnit: "kg",
        currency: card.currency,
        calculatedSavings: totals.localSavings,
        calculatedSavingsUSD: totals.savingsUSD,
        frequency: Frequency.RECURRING,
        savingDriver: card.savingDriver,
        implementationComplexity: card.implementationComplexity,
        qualificationStatus: card.qualificationStatus,
        startDate: new Date(card.impactStart),
        endDate: new Date(card.impactEnd),
        impactStartDate: new Date(card.impactStart),
        impactEndDate: new Date(card.impactEnd),
        financeLocked: Boolean(card.financeLocked),
        cancellationReason: card.cancellationReason ?? null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-06-05T00:00:00.000Z"),
        evidence: card.evidence.map((item, evidenceIndex) => ({
          id: `evidence-${index + 1}-${evidenceIndex + 1}`,
          evidenceType: item.evidenceType,
          uploadedAt: new Date(
            Date.UTC(2026, 2, Math.min(evidenceIndex + 1, 28))
          ),
        })),
        supplier: {
          id: `supplier-${index + 1}`,
          name: card.supplierName,
        },
        material: {
          id: `material-${index + 1}`,
          name: card.materialName,
        },
        alternativeSupplier: null,
        alternativeMaterial: null,
        category: {
          id: `category-${card.categoryName}`,
          name: card.categoryName,
        },
        buyer: {
          id: `buyer-${card.buyerName}`,
          name: card.buyerName,
        },
        plant: {
          id: `plant-${card.plantName}`,
          name: card.plantName,
        },
        businessUnit: {
          id: `business-unit-${card.businessUnitName}`,
          name: card.businessUnitName,
        },
        phaseChangeRequests: [],
        phaseHistory: [
          {
            toPhase: card.phase,
            createdAt: new Date("2026-03-01T00:00:00.000Z"),
          },
        ],
      };
    }) as unknown as SavingCardPortfolio[];
    const model = buildControllerWorkbookModel({
      cards,
      generatedAt: new Date("2026-06-05T12:00:00.000Z"),
      workspaceReadiness:
        createUtopiaTraxReadiness() as unknown as WorkspaceReadiness,
    });

    expect(model.savingCardRows).toHaveLength(25);
    expect(model.portfolioSummaryRows.length).toBeGreaterThan(20);
    expect(model.dataDictionaryRows.length).toBeGreaterThan(30);
    expect(model.importTemplateRows).toHaveLength(1);
    expect(model.evidenceSummaryRows).toHaveLength(25);
    expect(
      new Set(model.savingCardRows.map((row) => row.Category)).size
    ).toBe(6);
    expect(
      model.savingCardRows.some((row) => Number(row["Evidence Count"]) > 0)
    ).toBe(true);
    expect(
      model.savingCardRows.some(
        (row) => row["Finance Lock Status"] === "Locked"
      )
    ).toBe(true);
    expect(model.reconciliation.difference).toBe(0);
  });
});
