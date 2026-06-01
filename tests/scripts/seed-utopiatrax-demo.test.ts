import { Currency, Phase } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  getUtopiaTraxDatasetSummary,
  getUtopiaTraxNaturalKeys,
  UTOPIATRAX_DIRECT_CATEGORIES,
  UTOPIATRAX_SAVING_CARDS,
  validateUtopiaTraxDemoDataset,
} from "@/scripts/seed-utopiatrax-demo";

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

  it("includes evidence, alternatives, and mixed currency data for demo surfaces", () => {
    const summary = getUtopiaTraxDatasetSummary();
    const currencies = new Set(UTOPIATRAX_SAVING_CARDS.map((card) => card.currency));

    expect(summary.evidenceCount).toBeGreaterThanOrEqual(12);
    expect(summary.alternativeCount).toBeGreaterThanOrEqual(8);
    expect(currencies.has(Currency.EUR)).toBe(true);
    expect(currencies.has(Currency.USD)).toBe(true);
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
});
