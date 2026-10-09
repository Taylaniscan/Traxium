import { describe, expect, it } from "vitest";

import {
  formatRegionalCurrency,
  formatRegionalDateOnly,
  formatRegionalNumber,
  formatRegionalTimestamp,
  normalizeLocale,
  normalizeTimeZone,
  parseRegionalDecimal,
} from "@/lib/regional";
import { localToUsd, usdToReporting } from "@/lib/reporting-currency";
import { convertQuantityAndUnitPrice, unitConversionFactor, validateUnit } from "@/lib/units";

describe("global SME regional and financial rules", () => {
  it("uses explicit US and European number conventions without guessing grouped values", () => {
    expect(formatRegionalNumber(1234.5, "en-US")).toBe("1,234.5");
    expect(formatRegionalNumber(1234.5, "de-DE")).toBe("1.234,5");
    expect(formatRegionalCurrency(1234.56789, "EUR", "de-DE")).toContain("EUR");
    expect(parseRegionalDecimal("1234,50", "comma")).toBe(1234.5);
    expect(parseRegionalDecimal("1234.50", "dot")).toBe(1234.5);
    expect(() => parseRegionalDecimal("1,234.50", "dot")).toThrow("without grouping marks");
    expect(() => parseRegionalDecimal("1.234,50", "comma")).toThrow("without grouping marks");
    expect(() => parseRegionalDecimal("1,234", "dot")).toThrow();
    expect(normalizeLocale("ja-JP")).toBe("ja-JP");
    expect(normalizeLocale("not_a_locale")).toBeNull();
  });

  it("keeps date-only impact dates stable and changes actual timestamps at DST", () => {
    expect(formatRegionalDateOnly("2026-03-29", "en-US")).toContain("Mar 29");
    expect(formatRegionalDateOnly("2026-03-29", "de-DE")).toContain("29.03.2026");
    expect(formatRegionalDateOnly(new Date(NaN))).toBe("—");
    expect(normalizeTimeZone("Europe/Amsterdam")).toBe("Europe/Amsterdam");
    const before = formatRegionalTimestamp("2026-03-29T00:30:00Z", "en-GB", "Europe/Amsterdam");
    const after = formatRegionalTimestamp("2026-03-29T01:30:00Z", "en-GB", "Europe/Amsterdam");
    expect(before).toContain("01:30");
    expect(after).toContain("03:30");
  });

  it("converts only compatible units and preserves quantity times price", () => {
    const converted = convertQuantityAndUnitPrice(1000, 5, "kg", "lb");
    expect(converted.quantity * converted.pricePerUnit).toBeCloseTo(5000, 8);
    expect(unitConversionFactor("gal_us", "gal_imp")).toBeCloseTo(3785.411784 / 4546.09, 10);
    expect(unitConversionFactor("kg", "L")).toBeNull();
    expect(unitConversionFactor("pack", "pallet")).toBeNull();
    expect(unitConversionFactor("custom crate", "custom crate")).toBe(1);
    expect(validateUnit("ton").valid).toBe(false);
    expect(validateUnit("gallon").valid).toBe(false);
    expect(() => convertQuantityAndUnitPrice(10, 2, "kg", "L")).toThrow();
  });

  it("translates mixed USD and EUR cards exactly once using an explicit reporting basis", () => {
    const usd = localToUsd(100, "USD", 1);
    const eur = localToUsd(100, "EUR", 1.2);
    expect(usd + eur).toBe(220);
    expect(usdToReporting(usd + eur, { currency: "EUR", eurToUsd: 1.1, effectiveDate: "2026-01-01" })).toBeCloseTo(200);
    expect(usdToReporting(usd + eur, { currency: "USD", eurToUsd: 1, effectiveDate: null })).toBe(220);
    expect(() => usdToReporting(220, { currency: "EUR", eurToUsd: 0, effectiveDate: null })).toThrow();
    expect(() => localToUsd(100, "EUR", Number.NaN)).toThrow();
  });
});
