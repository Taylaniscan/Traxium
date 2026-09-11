import { Phase } from "@prisma/client";
import type { SavingsImpactType } from "@prisma/client";

type SavingsArgs = {
  baselinePrice: number;
  newPrice: number;
  annualVolume: number;
  fxRate: number;
  currency: "EUR" | "USD";
  impactType?: SavingsImpactType;
  referencePrice?: number | null;
};

export type FiscalYearDefinition = {
  /** Calendar month (1-12) on which the fiscal year starts. */
  startMonth: number;
};

export type PeriodizedSavingsArgs = SavingsArgs & {
  impactStartDate: Date;
  impactEndDate: Date;
  fiscalYear: FiscalYearDefinition;
  impactType?: SavingsImpactType;
  referencePrice?: number | null;
};

export type PeriodizedSavings = {
  /** Full-year value of the saving at steady state, in the card's own currency. */
  annualizedRunRate: number;
  annualizedRunRateUSD: number;
  /** Portion of the run-rate landing inside the fiscal year that contains the impact start. */
  inYearValue: number;
  inYearValueUSD: number;
  /** Run-rate multiplied by the impact duration in years (multi-year aware). */
  totalValue: number;
  totalValueUSD: number;
};

export function calculateSavings({
  baselinePrice,
  newPrice,
  annualVolume,
  fxRate,
  currency,
  impactType,
  referencePrice
}: SavingsArgs) {
  const unitSaving = resolveUnitSaving({
    baselinePrice,
    newPrice,
    impactType,
    referencePrice
  });
  const volume = Number(annualVolume || 0);
  const fx = Number(fxRate || 0);

  if ([unitSaving, volume, fx].some((value) => Number.isNaN(value) || !Number.isFinite(value))) {
    return {
      localSavings: 0,
      savingsUSD: 0
    };
  }

  const localSavings = unitSaving * volume;

  // USD is the canonical reporting currency. A USD card reports its local value
  // directly; any other currency converts through its rate to USD.
  return {
    localSavings,
    savingsUSD: currency === "USD" ? localSavings : localSavings * fx
  };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isFiniteNumber(value: number) {
  return !Number.isNaN(value) && Number.isFinite(value);
}

/** Effective per-unit saving: cost-avoidance cards measure against the avoided reference price. */
export function resolveUnitSaving({
  baselinePrice,
  newPrice,
  impactType,
  referencePrice,
}: {
  baselinePrice: number;
  newPrice: number;
  impactType?: SavingsImpactType;
  referencePrice?: number | null;
}) {
  const effectiveBaseline =
    impactType === "COST_AVOIDANCE" &&
    referencePrice !== null &&
    referencePrice !== undefined
      ? Number(referencePrice)
      : Number(baselinePrice);

  return effectiveBaseline - Number(newPrice);
}

function daysInUtcMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * Sum of month-fractions covered by [windowStart, windowEnd] (both inclusive),
 * intersected with the optional [boundStart, boundEnd] window. Partial months are
 * prorated by day. A fully covered month contributes 1.0; twelve of them = one year.
 */
function coveredMonthFraction(
  windowStart: Date,
  windowEnd: Date,
  boundStart?: Date,
  boundEnd?: Date
) {
  const startMs = Math.max(
    windowStart.getTime(),
    boundStart ? boundStart.getTime() : windowStart.getTime()
  );
  const endMs = Math.min(
    windowEnd.getTime(),
    boundEnd ? boundEnd.getTime() : windowEnd.getTime()
  );

  if (endMs < startMs) {
    return 0;
  }

  const start = new Date(startMs);
  const end = new Date(endMs);

  let total = 0;
  let year = start.getUTCFullYear();
  let month = start.getUTCMonth();

  while (year < end.getUTCFullYear() || (year === end.getUTCFullYear() && month <= end.getUTCMonth())) {
    const monthDays = daysInUtcMonth(year, month);
    const monthFirst = Date.UTC(year, month, 1);
    const monthLast = Date.UTC(year, month, monthDays);

    const overlapStart = Math.max(monthFirst, startMs);
    const overlapEnd = Math.min(monthLast, endMs);

    if (overlapEnd >= overlapStart) {
      const coveredDays = Math.round((overlapEnd - overlapStart) / MS_PER_DAY) + 1;
      total += coveredDays / monthDays;
    }

    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  return total;
}

/** Fiscal year (inclusive start/end) that contains the given date for a startMonth (1-12). */
function fiscalYearWindow(date: Date, startMonth: number) {
  const normalizedStartMonth = Math.min(Math.max(Math.trunc(startMonth) || 1, 1), 12);
  const startMonthIndex = normalizedStartMonth - 1;
  const year = date.getUTCFullYear();
  const monthIndex = date.getUTCMonth();
  const fyStartYear = monthIndex >= startMonthIndex ? year : year - 1;

  const start = new Date(Date.UTC(fyStartYear, startMonthIndex, 1));
  // Inclusive last day = day before the next fiscal year starts.
  const end = new Date(Date.UTC(fyStartYear + 1, startMonthIndex, 1) - MS_PER_DAY);

  return { start, end };
}

/**
 * Impact duration in years, derived from the impact window. A 12-month window is 1.0,
 * a 36-month window is 3.0. Replaces the hardcoded multi-year multiplier so projected
 * value scales with the real impact duration.
 */
export function impactDurationYears(impactStartDate: Date, impactEndDate: Date) {
  if (
    !(impactStartDate instanceof Date) ||
    !(impactEndDate instanceof Date) ||
    Number.isNaN(impactStartDate.getTime()) ||
    Number.isNaN(impactEndDate.getTime()) ||
    impactEndDate.getTime() < impactStartDate.getTime()
  ) {
    return 0;
  }

  return coveredMonthFraction(impactStartDate, impactEndDate) / 12;
}

export function calculatePeriodizedSavings(
  args: PeriodizedSavingsArgs
): PeriodizedSavings {
  const zero: PeriodizedSavings = {
    annualizedRunRate: 0,
    annualizedRunRateUSD: 0,
    inYearValue: 0,
    inYearValueUSD: 0,
    totalValue: 0,
    totalValueUSD: 0,
  };

  const unitSaving = resolveUnitSaving(args);
  const volume = Number(args.annualVolume || 0);
  const fx = Number(args.fxRate || 0);

  if (![unitSaving, volume, fx].every(isFiniteNumber)) {
    return zero;
  }

  const annualizedRunRate = unitSaving * volume;

  const start = args.impactStartDate;
  const end = args.impactEndDate;
  const validWindow =
    start instanceof Date &&
    end instanceof Date &&
    !Number.isNaN(start.getTime()) &&
    !Number.isNaN(end.getTime()) &&
    end.getTime() >= start.getTime();

  const fy = validWindow
    ? fiscalYearWindow(start, args.fiscalYear.startMonth)
    : null;

  const inYearMonths =
    validWindow && fy ? coveredMonthFraction(start, end, fy.start, fy.end) : 0;
  const totalMonths = validWindow ? coveredMonthFraction(start, end) : 0;

  const inYearValue = annualizedRunRate * (inYearMonths / 12);
  const totalValue = annualizedRunRate * (totalMonths / 12);

  const toUsd = (localValue: number) =>
    args.currency === "USD" ? localValue : localValue * fx;

  return {
    annualizedRunRate,
    annualizedRunRateUSD: toUsd(annualizedRunRate),
    inYearValue,
    inYearValueUSD: toUsd(inYearValue),
    totalValue,
    totalValueUSD: toUsd(totalValue),
  };
}

// Maps each phase onto the status color language defined in app/globals.css
// (Proposed=blue, Validated=amber, Implemented=teal, Captured=green, Canceled=rose);
// Badge tones consume the same --phase-* tokens.
export function getValueBadgeTone(phase: Phase) {
  if (phase === "ACHIEVED") return "emerald";
  if (phase === "REALISED") return "teal";
  if (phase === "VALIDATED") return "amber";
  if (phase === "CANCELLED") return "rose";
  return "blue";
}

