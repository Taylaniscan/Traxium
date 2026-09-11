import type { Currency, Phase, SavingsImpactType } from "@prisma/client";

import { resolveUnitSaving } from "@/lib/calculations";
import { toNumber } from "@/lib/utils/decimal";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type DecimalLike = Parameters<typeof toNumber>[0];

// ---------------------------------------------------------------------------
// Month helpers (all UTC, first-of-month based)
// ---------------------------------------------------------------------------

export function monthStartUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/** First day (UTC) of the month before `now` — the last fully completed month. */
export function lastCompletedMonthStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
}

export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Parse a `YYYY-MM` key into a first-of-month UTC date, or null when invalid. */
export function parseMonthKey(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || month < 1 || month > 12) return null;
  return new Date(Date.UTC(year, month - 1, 1));
}

function daysInUtcMonth(monthStart: Date): number {
  return new Date(
    Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0)
  ).getUTCDate();
}

/**
 * Fraction (0..1) of the given month's days covered by the inclusive impact
 * window [impactStart, impactEnd]. Partial months are prorated by day.
 */
export function monthCoverageFraction(
  impactStart: Date,
  impactEnd: Date,
  monthStart: Date
): number {
  const days = daysInUtcMonth(monthStart);
  const monthFirstMs = monthStart.getTime();
  const monthLastMs = Date.UTC(
    monthStart.getUTCFullYear(),
    monthStart.getUTCMonth(),
    days
  );

  const overlapStart = Math.max(impactStart.getTime(), monthFirstMs);
  const overlapEnd = Math.min(impactEnd.getTime(), monthLastMs);
  if (overlapEnd < overlapStart) {
    return 0;
  }

  const coveredDays = Math.round((overlapEnd - overlapStart) / MS_PER_DAY) + 1;
  return coveredDays / days;
}

// ---------------------------------------------------------------------------
// Actualized savings
// ---------------------------------------------------------------------------

export type ActualizedSavings = {
  unitDelta: number;
  actualizedLocal: number;
  actualizedUSD: number;
  actualPeriodCount: number;
};

function toUsd(localValue: number, currency: string, fxRate: number): number {
  return currency === "USD" ? localValue : localValue * fxRate;
}

/**
 * Actual achieved savings = Σ (actualQty × per-unit price delta), where the delta
 * follows the card's savings basis (baseline−new for hard savings; reference−new
 * for cost avoidance when a reference price is set).
 */
export function computeActualizedSavings(input: {
  baselinePrice: DecimalLike;
  newPrice: DecimalLike;
  referencePrice?: DecimalLike | null;
  impactType?: SavingsImpactType;
  currency: Currency | "USD" | "EUR";
  fxRate: DecimalLike;
  actuals: Array<{ actualQty: DecimalLike }>;
}): ActualizedSavings {
  const unitDelta = resolveUnitSaving({
    baselinePrice: toNumber(input.baselinePrice),
    newPrice: toNumber(input.newPrice),
    impactType: input.impactType,
    referencePrice:
      input.referencePrice === null || input.referencePrice === undefined
        ? null
        : toNumber(input.referencePrice),
  });
  const totalActualQty = input.actuals.reduce(
    (sum, row) => sum + toNumber(row.actualQty),
    0
  );
  const fx = toNumber(input.fxRate) || 1;
  const actualizedLocal = unitDelta * totalActualQty;

  return {
    unitDelta,
    actualizedLocal,
    actualizedUSD: toUsd(actualizedLocal, input.currency, fx),
    actualPeriodCount: input.actuals.length,
  };
}

// ---------------------------------------------------------------------------
// Monthly-close assembly (pure; DB loading lives in lib/monthly-close-data.ts)
// ---------------------------------------------------------------------------

export type MonthlyCloseStatus =
  | "missing-actuals"
  | "needs-finance-review"
  | "closed";

export type MonthlyCloseCardRow = {
  savingCardId: string;
  title: string;
  phase: Phase;
  currency: Currency;
  status: MonthlyCloseStatus;
  hasActual: boolean;
  hasPendingRequest: boolean;
  forecastQty: number | null;
  actualQty: number | null;
  varianceQty: number | null;
  forecastSavings: number;
  forecastSavingsUSD: number;
  actualSavings: number;
  actualSavingsUSD: number;
  proratedMonthValue: number;
  proratedMonthValueUSD: number;
};

export type MonthlyCloseSummary = {
  month: string;
  monthLabel: string;
  totalCards: number;
  closedCount: number;
  missingActualsCount: number;
  needsFinanceReviewCount: number;
  totalForecastSavingsUSD: number;
  totalActualSavingsUSD: number;
  cards: MonthlyCloseCardRow[];
};

export type MonthlyCloseInputCard = {
  id: string;
  title: string;
  phase: Phase;
  currency: Currency;
  impactType: SavingsImpactType;
  baselinePrice: DecimalLike;
  newPrice: DecimalLike;
  referencePrice?: DecimalLike | null;
  fxRate: DecimalLike;
  annualizedRunRate: DecimalLike;
  annualizedRunRateUSD: DecimalLike;
  impactStartDate: Date;
  impactEndDate: Date;
};

/**
 * Assemble the monthly-close view for a month from already-loaded data.
 * Cards whose impact window does not overlap the month are excluded.
 *
 * Status priority (mutually exclusive): a card with a pending phase-change
 * request is "needs-finance-review"; otherwise a card with no actual row for the
 * month is "missing-actuals"; otherwise it is "closed".
 */
export function assembleMonthlyClose(input: {
  monthStart: Date;
  cards: MonthlyCloseInputCard[];
  forecastsByCard: Map<string, number>;
  actualsByCard: Map<string, number>;
  pendingRequestCardIds: Set<string>;
}): MonthlyCloseSummary {
  const monthStart = monthStartUtc(input.monthStart);
  const rows: MonthlyCloseCardRow[] = [];

  for (const card of input.cards) {
    const coverage = monthCoverageFraction(
      card.impactStartDate,
      card.impactEndDate,
      monthStart
    );
    if (coverage <= 0) {
      continue;
    }

    const unitDelta = resolveUnitSaving({
      baselinePrice: toNumber(card.baselinePrice),
      newPrice: toNumber(card.newPrice),
      impactType: card.impactType,
      referencePrice:
        card.referencePrice === null || card.referencePrice === undefined
          ? null
          : toNumber(card.referencePrice),
    });
    const fx = toNumber(card.fxRate) || 1;

    const hasForecast = input.forecastsByCard.has(card.id);
    const hasActual = input.actualsByCard.has(card.id);
    const hasPendingRequest = input.pendingRequestCardIds.has(card.id);
    const forecastQty = hasForecast ? input.forecastsByCard.get(card.id)! : null;
    const actualQty = hasActual ? input.actualsByCard.get(card.id)! : null;

    const forecastSavings = (forecastQty ?? 0) * unitDelta;
    const actualSavings = (actualQty ?? 0) * unitDelta;
    const proratedMonthValue =
      (toNumber(card.annualizedRunRate) / 12) * coverage;
    const proratedMonthValueUSD =
      (toNumber(card.annualizedRunRateUSD) / 12) * coverage;

    const status: MonthlyCloseStatus = hasPendingRequest
      ? "needs-finance-review"
      : hasActual
        ? "closed"
        : "missing-actuals";

    rows.push({
      savingCardId: card.id,
      title: card.title,
      phase: card.phase,
      currency: card.currency,
      status,
      hasActual,
      hasPendingRequest,
      forecastQty,
      actualQty,
      varianceQty:
        actualQty !== null && forecastQty !== null
          ? actualQty - forecastQty
          : null,
      forecastSavings,
      forecastSavingsUSD: toUsd(forecastSavings, card.currency, fx),
      actualSavings,
      actualSavingsUSD: toUsd(actualSavings, card.currency, fx),
      proratedMonthValue,
      proratedMonthValueUSD,
    });
  }

  const closedCount = rows.filter((r) => r.status === "closed").length;
  const missingActualsCount = rows.filter(
    (r) => r.status === "missing-actuals"
  ).length;
  const needsFinanceReviewCount = rows.filter(
    (r) => r.status === "needs-finance-review"
  ).length;

  return {
    month: monthKey(monthStart),
    monthLabel: monthLabel(monthStart),
    totalCards: rows.length,
    closedCount,
    missingActualsCount,
    needsFinanceReviewCount,
    totalForecastSavingsUSD: rows.reduce((s, r) => s + r.forecastSavingsUSD, 0),
    totalActualSavingsUSD: rows.reduce((s, r) => s + r.actualSavingsUSD, 0),
    cards: rows,
  };
}
