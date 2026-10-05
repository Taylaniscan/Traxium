"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Filter, Search, X, LockKeyhole, Paperclip, Clock3, AlertTriangle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { phaseLabels, phases } from "@/lib/constants";
import { emptyFilters, filterKeys, pendingRequest, readFilters, timingRisk, writeFilters, type FilterKey, type PlanningFilters } from "@/lib/planning";
import type { SavingCardPortfolio } from "@/lib/types";

export function usePlanningView(preferenceKey: string) {
  const [params, setParams] = useState(() => new URLSearchParams());
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  useEffect(() => {
    const sync = () => setParams(new URLSearchParams(window.location.search));
    sync();
    window.addEventListener("popstate", sync);
    try { setDensity(localStorage.getItem(preferenceKey) === "compact" ? "compact" : "comfortable"); } catch { /* Storage can be disabled. */ }
    return () => window.removeEventListener("popstate", sync);
  }, [preferenceKey]);
  const update = useCallback((values: Record<string, string>, replace = false) => {
    const next = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(values)) { if (value) next.set(key, value); else next.delete(key); }
    const url = `${window.location.pathname}${next.size ? `?${next}` : ""}${window.location.hash}`;
    window.history[replace ? "replaceState" : "pushState"](null, "", url);
    setParams(next);
  }, []);
  const filters = useMemo(() => readFilters(params), [params]);
  const setFilter = useCallback((key: FilterKey, value: string) => update({ [key]: value }, key === "q"), [update]);
  const clear = useCallback(() => {
    const next = writeFilters(new URLSearchParams(window.location.search), emptyFilters);
    window.history.pushState(null, "", `${window.location.pathname}${next.size ? `?${next}` : ""}${window.location.hash}`);
    setParams(next);
  }, []);
  const changeDensity = (value: "comfortable" | "compact") => {
    setDensity(value);
    try { localStorage.setItem(preferenceKey, value); } catch { /* Keep the session preference. */ }
  };
  return { params, update, filters, setFilter, clear, density, changeDensity };
}

const lookupLabels = { categoryId: "Category", buyerId: "Buyer", supplierId: "Supplier", plantId: "Plant", businessUnitId: "Business unit" } as const;
const relations = { categoryId: "category", buyerId: "buyer", supplierId: "supplier", plantId: "plant", businessUnitId: "businessUnit" } as const;
export function PlanningToolbar({ cards, filters, setFilter, clear, count, children }: {
  cards: SavingCardPortfolio[]; filters: PlanningFilters; setFilter: (key: FilterKey, value: string) => void; clear: () => void; count: number; children?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const options = useMemo(() => Object.fromEntries(Object.entries(relations).map(([key, relation]) => {
    const unique = new Map<string, string>();
    for (const card of cards) { const item = card[relation as keyof typeof relations extends never ? never : typeof relations[keyof typeof relations]]; if (item) unique.set(item.id, item.name); }
    return [key, [...unique].sort((a, b) => a[1].localeCompare(b[1]))];
  })) as Record<keyof typeof lookupLabels, [string, string][]>, [cards]);
  const active = filterKeys.filter(key => filters[key]);
  const chipLabel = (key: FilterKey) => {
    if (key in lookupLabels) return `${lookupLabels[key as keyof typeof lookupLabels]}: ${options[key as keyof typeof lookupLabels].find(([id]) => id === filters[key])?.[1] ?? "Unavailable selection"}`;
    if (key === "phase") return phaseLabels[filters.phase as keyof typeof phaseLabels];
    if (key === "q") return `Search: ${filters.q}`;
    if (key === "attention") return "Needs attention";
    return `${key === "locked" ? "Finance locked" : "Pending approval"}: ${filters[key]}`;
  };
  return <div className="planning-toolbar space-y-3 rounded-lg border bg-[var(--surface)] p-3">
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-48 flex-1"><Search aria-hidden className="absolute left-3 top-3 h-4 w-4 text-[var(--text-secondary)]" /><Input aria-label="Search saving cards" placeholder="Search initiatives, buyers, suppliers…" className="pl-9" value={filters.q} onChange={e => setFilter("q", e.target.value)} /></div>
      <Button variant="outline" aria-expanded={expanded} aria-controls="planning-filters" onClick={() => setExpanded(!expanded)}><Filter size={15} />Filters{active.length ? ` (${active.length})` : ""}</Button>
      {children}
      <span className="ml-auto text-xs tabular-nums text-[var(--text-secondary)]" role="status">{count} of {cards.length} cards</span>
    </div>
    {expanded && <div id="planning-filters" className="grid gap-3 border-t pt-3 sm:grid-cols-2 lg:grid-cols-4">
      {(Object.keys(lookupLabels) as (keyof typeof lookupLabels)[]).map(key => <label key={key} className="space-y-1 text-xs text-[var(--text-secondary)]">{lookupLabels[key]}<Select value={filters[key]} onChange={e => setFilter(key, e.target.value)}><option value="">All</option>{filters[key] && !options[key].some(([id]) => id === filters[key]) && <option value={filters[key]}>Unavailable selection</option>}{options[key].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</Select></label>)}
      <label className="space-y-1 text-xs">Phase<Select value={filters.phase} onChange={e => setFilter("phase", e.target.value)}><option value="">All phases</option>{phases.map(p => <option key={p} value={p}>{phaseLabels[p]}</option>)}</Select></label>
      {(["locked", "pending"] as const).map(key => <label key={key} className="space-y-1 text-xs">{key === "locked" ? "Finance locked" : "Pending approval"}<Select value={filters[key]} onChange={e => setFilter(key, e.target.value)}><option value="">All</option><option value="yes">Yes</option><option value="no">No</option></Select></label>)}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={filters.attention === "yes"} onChange={e => setFilter("attention", e.target.checked ? "yes" : "")} />Needs attention</label>
    </div>}
    {!!active.length && <div className="flex flex-wrap items-center gap-2">{active.map(key => <button key={key} onClick={() => setFilter(key, "")} aria-label={`Remove ${chipLabel(key)}`} className="planning-chip">{chipLabel(key)}<X size={12} aria-hidden /></button>)}<Button size="sm" variant="ghost" onClick={clear}>Clear all</Button></div>}
  </div>;
}
export function DensityControl({ value, onChange }: { value: string; onChange: (value: "comfortable" | "compact") => void }) {
  return <Select aria-label="Card density" className="w-36" value={value} onChange={e => onChange(e.target.value as "comfortable" | "compact")}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></Select>;
}
export function CardSignals({ card, now }: { card: SavingCardPortfolio; now: Date }) {
  const risk = timingRisk(card, now), pending = pendingRequest(card);
  return <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
    {risk && <span className="planning-chip text-[var(--warning)]"><AlertTriangle size={12} aria-hidden />{risk}</span>}
    {card.qualificationStatus === "Rejected" && card.phase !== "CANCELLED" && card.phase !== "ACHIEVED" && <span className="planning-chip text-[var(--risk)]">Qualification blocked</span>}
    {pending && <span className="planning-chip text-[var(--warning)]" title={`Pending approval for ${phaseLabels[pending.requestedPhase]}. Remains in ${phaseLabels[card.phase]}.`}><Clock3 size={12} aria-hidden />Pending · {phaseLabels[pending.requestedPhase]}</span>}
    {card.financeLocked && <span className="planning-chip text-[var(--finance-lock)]"><LockKeyhole size={12} aria-hidden />Locked</span>}
    {!!card.evidence?.length && <span className="planning-chip" aria-label={`${card.evidence.length} evidence attachments`} title={`${card.evidence.length} evidence attachments`}><Paperclip size={12} aria-hidden />{card.evidence.length}</span>}
  </div>;
}
export function Initials({ name }: { name: string }) { return <span aria-hidden className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[10px] font-semibold text-[var(--text-secondary)]">{name.split(/\s+/).slice(0, 2).map(s => s[0]).join("")}</span>; }
export function PlanningState({ title, description, error = false, onClear, canCreate = true }: { title: string; description: string; error?: boolean; onClear?: () => void; canCreate?: boolean }) {
  return <div role={error ? "alert" : "status"} className="rounded-lg border border-dashed bg-[var(--surface)] px-6 py-16 text-center"><h2 className="text-lg">{title}</h2><p className="mx-auto mt-2 max-w-lg text-sm text-[var(--text-secondary)]">{description}</p><div className="mt-5 flex justify-center gap-3">{error ? <Button onClick={() => window.location.reload()} variant="outline">Retry</Button> : onClear ? <Button onClick={onClear}>Clear filters</Button> : canCreate ? <Link className={buttonVariants()} href="/saving-cards/new">Create saving card</Link> : null}</div></div>;
}
export function PlanningSkeleton({ timeline = false }: { timeline?: boolean }) { return <div role="status" aria-label={timeline ? "Loading timeline" : "Loading board"} className="space-y-4"><div className="skeleton-shimmer h-12 rounded-lg" /><div className={timeline ? "space-y-2" : "grid grid-cols-2 gap-4 lg:grid-cols-4"}>{Array.from({ length: timeline ? 8 : 4 }, (_, i) => <div key={i} className="rounded-lg border bg-[var(--surface)] p-4"><div className="skeleton-shimmer mb-4 h-5 w-2/3 rounded" />{Array.from({ length: timeline ? 1 : 3 }, (_, n) => <div key={n} className={`skeleton-shimmer mb-3 rounded ${timeline ? "h-5 w-1/2" : "h-32"}`} />)}</div>)}</div></div>; }
