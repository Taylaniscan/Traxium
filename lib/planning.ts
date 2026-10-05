import type { Phase } from "@prisma/client";
import { calculateFiscalYearValue, impactDurationYears, resolveFiscalYearWindow } from "@/lib/calculations";
import { phases } from "@/lib/constants";
import type { SavingCardPortfolio } from "@/lib/types";

export const filterKeys = ["q", "categoryId", "buyerId", "supplierId", "plantId", "businessUnitId", "phase", "locked", "pending", "attention"] as const;
export type FilterKey = (typeof filterKeys)[number];
export type PlanningFilters = Record<FilterKey, string>;
export type Grouping = "phase" | "category" | "buyer" | "plant";
export type Zoom = "year" | "quarter" | "month";
export const emptyFilters: PlanningFilters = Object.fromEntries(filterKeys.map(key => [key, ""])) as PlanningFilters;
export const DAY = 86400000;
export function number(value: unknown) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
export function date(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value instanceof Date ? value.toISOString() : value));
  return Number.isFinite(d.getTime()) ? new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())) : null;
}
export function pendingRequest(card: SavingCardPortfolio) { return card.phaseChangeRequests?.find(r => r.approvalStatus === "PENDING") ?? null; }
export function timingRisk(card: SavingCardPortfolio, now: Date) {
  if (card.phase === "CANCELLED" || card.phase === "ACHIEVED") return null;
  const start = date(card.impactStartDate), end = date(card.impactEndDate), today = date(now)!;
  if (!start || !end || end < start) return "Needs dates";
  if (card.phase === "REALISED") return end < today ? "Capture overdue" : null;
  const days = Math.round((start.getTime() - today.getTime()) / DAY);
  return days < 0 ? "Late to impact" : days <= 30 ? "At risk" : null;
}
export function readFilters(params: URLSearchParams): PlanningFilters {
  const result = { ...emptyFilters };
  for (const key of filterKeys) result[key] = params.get(key)?.trim() ?? "";
  if (!phases.includes(result.phase as Phase)) result.phase = "";
  for (const key of ["locked", "pending"] as const) if (!["yes", "no"].includes(result[key])) result[key] = "";
  if (result.attention !== "yes") result.attention = "";
  return result;
}
export function writeFilters(params: URLSearchParams, filters: PlanningFilters) {
  const next = new URLSearchParams(params);
  for (const key of filterKeys) { if (filters[key]) next.set(key, filters[key]); else next.delete(key); }
  return next;
}
export function filterCards(cards: SavingCardPortfolio[], filters: PlanningFilters, now: Date) {
  return cards.filter(card => {
    for (const key of ["categoryId", "buyerId", "supplierId", "plantId", "businessUnitId", "phase"] as const) if (filters[key] && card[key] !== filters[key]) return false;
    if (filters.locked && card.financeLocked !== (filters.locked === "yes")) return false;
    if (filters.pending && Boolean(pendingRequest(card)) !== (filters.pending === "yes")) return false;
    if (filters.attention && !timingRisk(card, now) && card.qualificationStatus !== "Rejected") return false;
    const haystack = [card.title, card.buyer?.name, card.supplier?.name, card.category?.name, card.material?.name, card.plant?.name].join(" ").toLowerCase();
    return !filters.q || haystack.includes(filters.q.toLowerCase());
  });
}
export function yearValue(card: SavingCardPortfolio, fiscalMonth: number | undefined, reportingDate: Date): number | null {
  if (!fiscalMonth) return null;
  return calculateFiscalYearValue({ annualizedValue: number(card.annualizedRunRateUSD), impactStartDate: date(card.impactStartDate) ?? new Date(NaN), impactEndDate: date(card.impactEndDate) ?? new Date(NaN), fiscalYear: { startMonth: fiscalMonth }, reportingDate });
}
export function periodValue(card: SavingCardPortfolio, start: Date, end: Date) {
  if (card.phase === "CANCELLED") return 0;
  const from = date(card.impactStartDate), to = date(card.impactEndDate);
  if (!from || !to || to < from) return 0;
  const overlapStart = new Date(Math.max(from.getTime(), start.getTime()));
  const overlapEnd = new Date(Math.min(to.getTime(), end.getTime()));
  return number(card.annualizedRunRateUSD) * impactDurationYears(overlapStart, overlapEnd);
}
export function groupCards(cards: SavingCardPortfolio[], grouping: Grouping) {
  const groups = new Map<string, { id: string; label: string; cards: SavingCardPortfolio[] }>();
  for (const card of cards) {
    const relation = grouping === "phase" ? null : card[grouping];
    const id = grouping === "phase" ? card.phase : relation?.id ?? "unassigned";
    const label = grouping === "phase" ? card.phase : relation?.name ?? `Unassigned ${grouping}`;
    if (!groups.has(id)) groups.set(id, { id, label, cards: [] });
    groups.get(id)!.cards.push(card);
  }
  return [...groups.values()].sort((a, b) => grouping === "phase" ? phases.indexOf(a.id as Phase) - phases.indexOf(b.id as Phase) : a.label.localeCompare(b.label));
}
export function timelineWindow(anchor: Date, zoom: Zoom, fiscalMonth: number) {
  const fy = resolveFiscalYearWindow(anchor, fiscalMonth)!;
  if (zoom === "year") return fy;
  const months = (anchor.getUTCFullYear() - fy.start.getUTCFullYear()) * 12 + anchor.getUTCMonth() - fy.start.getUTCMonth();
  const offset = zoom === "quarter" ? Math.floor(months / 3) * 3 : months;
  const start = new Date(Date.UTC(fy.start.getUTCFullYear(), fy.start.getUTCMonth() + offset, 1));
  return { start, end: new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + (zoom === "quarter" ? 3 : 1), 1) - DAY) };
}
export function monthsInWindow(start: Date, end: Date) {
  const result: { start: Date; end: Date }[] = [];
  for (let d = new Date(start); d <= end; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) result.push({ start: d, end: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - DAY) });
  return result;
}
export function barGeometry(start: Date | null, end: Date | null, windowStart: Date, windowEnd: Date) {
  if (!start || !end || end < start || end < windowStart || start > windowEnd) return null;
  const duration = windowEnd.getTime() + DAY - windowStart.getTime();
  const left = (Math.max(start.getTime(), windowStart.getTime()) - windowStart.getTime()) / duration * 100;
  const right = (Math.min(end.getTime() + DAY, windowEnd.getTime() + DAY) - windowStart.getTime()) / duration * 100;
  return { left, width: right - left, continuesBefore: start < windowStart, continuesAfter: end > windowEnd };
}
