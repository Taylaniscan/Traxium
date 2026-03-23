"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { VolumeSCurve } from "@/components/timeline/volume-scurve";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { phases, phaseLabels } from "@/lib/constants";
import type { SavingCardPortfolio, WorkspaceReadiness } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/numberFormatter";

const ROW_HEIGHT = 84;
const PROJECT_COLUMN_WIDTH = 280;
const DAY_MS = 24 * 60 * 60 * 1000;
const ZOOM_LEVELS = ["YEAR", "QUARTER", "MONTH", "WEEK"] as const;
const TIMELINE_BAR_HEIGHT = 30;

const SEGMENT_WIDTH: Record<ZoomLevel, number> = {
  YEAR: 240,
  QUARTER: 188,
  MONTH: 148,
  WEEK: 104
};

const phaseStyles: Record<
  string,
  {
    bar: string;
    chip: string;
    progress: string;
    track: string;
  }
> = {
  IDEA: {
    bar: "bg-slate-300 text-slate-800",
    chip: "bg-slate-100 text-slate-700 ring-slate-200",
    progress: "bg-slate-500/60",
    track: "bg-slate-200"
  },
  VALIDATED: {
    bar: "bg-blue-500 text-white",
    chip: "bg-blue-50 text-blue-700 ring-blue-200",
    progress: "bg-blue-800/35",
    track: "bg-blue-100"
  },
  REALISED: {
    bar: "bg-orange-500 text-white",
    chip: "bg-orange-50 text-orange-700 ring-orange-200",
    progress: "bg-amber-800/35",
    track: "bg-orange-100"
  },
  ACHIEVED: {
    bar: "bg-emerald-500 text-white",
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    progress: "bg-emerald-700/35",
    track: "bg-emerald-100"
  },
  CANCELLED: {
    bar: "bg-rose-500 text-white",
    chip: "bg-rose-50 text-rose-700 ring-rose-200",
    progress: "bg-rose-800/35",
    track: "bg-rose-100"
  }
};

type ZoomLevel = (typeof ZOOM_LEVELS)[number];

type FilterState = {
  categoryId: string;
  buyerId: string;
  supplierId: string;
  businessUnitId: string;
  phase: string;
  query: string;
};

type TimelineSegment = {
  start: Date;
  end: Date;
  primaryLabel: string;
  secondaryLabel: string;
};

export function TimelineBoard({
  cards,
  nowIso,
  filters,
  readiness
}: {
  cards: SavingCardPortfolio[];
  nowIso: string;
  filters: {
    categories: Array<{ id: string; name: string }>;
    buyers: Array<{ id: string; name: string }>;
    suppliers: Array<{ id: string; name: string }>;
    businessUnits: Array<{ id: string; name: string }>;
  };
  readiness?: WorkspaceReadiness | null;
}) {
  const [state, setState] = useState<FilterState>({
    categoryId: "",
    buyerId: "",
    supplierId: "",
    businessUnitId: "",
    phase: "",
    query: ""
  });
  const [scale, setScale] = useState<ZoomLevel>("YEAR");
  const [timelineView, setTimelineView] = useState<"gantt" | "scurve">("gantt");
  const referenceNow = useMemo(() => new Date(nowIso), [nowIso]);
  const applyScale = (value: unknown) => {
    if (typeof value !== "string") return;
    if (!ZOOM_LEVELS.includes(value as ZoomLevel)) return;
    setScale(value as ZoomLevel);
  };

  const shiftScale = (direction: -1 | 1) => {
    const nextIndex = Math.min(Math.max(ZOOM_LEVELS.indexOf(scale) + direction, 0), ZOOM_LEVELS.length - 1);
    applyScale(ZOOM_LEVELS[nextIndex]);
  };

  const filtered = useMemo(() => {
    return cards
      .filter((card) => {
        if (state.categoryId && card.categoryId !== state.categoryId) return false;
        if (state.buyerId && card.buyerId !== state.buyerId) return false;
        if (state.supplierId && card.supplierId !== state.supplierId) return false;
        if (state.businessUnitId && card.businessUnitId !== state.businessUnitId) return false;
        if (state.phase && card.phase !== state.phase) return false;
        if (state.query && !`${card.title} ${card.supplier.name} ${card.category.name}`.toLowerCase().includes(state.query.toLowerCase())) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const startDiff = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
        if (startDiff !== 0) return startDiff;
        return b.calculatedSavings - a.calculatedSavings;
      });
  }, [cards, state]);

  const visibleCards = filtered;
  const activeFilters = Boolean(
    state.categoryId || state.buyerId || state.supplierId || state.businessUnitId || state.phase || state.query.trim()
  );
  const configuredCollections = readiness?.masterData.filter((item) => item.ready).length ?? 0;
  const workflowCoverageReady = readiness?.workflowCoverage.filter((item) => item.ready).length ?? 0;
  const nextActions = buildTimelineNextActions(readiness, cards.length);
  const showRampUpState =
    cards.length > 0 && (cards.length < 3 || (readiness ? !readiness.isWorkspaceReady : false));

  const segments = useMemo(() => buildTimelineSegments(visibleCards, scale), [visibleCards, scale]);
  const segmentWidth = SEGMENT_WIDTH[scale];
  const timelineStart = segments[0]?.start.getTime() ?? referenceNow.getTime();
  const timelineEnd = segments.at(-1)?.end.getTime() ?? timelineStart + DAY_MS;
  const totalRange = Math.max(timelineEnd - timelineStart, DAY_MS);
  const gridWidth = Math.max(segments.length * segmentWidth, 960);
  const gridHeight = Math.max(visibleCards.length * ROW_HEIGHT, ROW_HEIGHT);
  const currentMonthHighlight = getRangeHighlight(timelineStart, totalRange, getCurrentMonthRange(referenceNow));
  const todayPosition = getOffsetPercent(referenceNow.getTime(), timelineStart, totalRange);

  const summary = useMemo(() => {
    const activeCards = visibleCards.filter((card) => card.phase !== "CANCELLED");

    const pipeline = activeCards.reduce((sum, card) => sum + card.calculatedSavings, 0);
    const realised = activeCards
      .filter((card) => card.phase === "REALISED")
      .reduce((sum, card) => sum + card.calculatedSavings, 0);
    const achieved = activeCards
      .filter((card) => card.phase === "ACHIEVED")
      .reduce((sum, card) => sum + card.calculatedSavings, 0);

    return {
      pipeline,
      realised,
      achieved,
      achievedShare: pipeline > 0 ? achieved / pipeline : 0,
      realisedShare: pipeline > 0 ? (realised + achieved) / pipeline : 0
    };
  }, [visibleCards]);

  if (!cards.length) {
    return (
      <div className="space-y-6">
        <Card className="border-0 bg-[linear-gradient(135deg,#113b61_0%,#194f7a_58%,#1b7f87_100%)] text-white">
          <CardContent className="grid gap-6 p-8 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4">
              <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.12em] text-cyan-100">
                Timeline Launch
              </div>
              <div>
                <h2 className="text-3xl font-semibold tracking-tight">
                  No live timeline activity yet.
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-cyan-50/85">
                  This timeline becomes the shared rollout view once the first initiatives are active. Use it to align project timing, impact windows, and savings delivery across the live portfolio.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/saving-cards/new" className={buttonVariants({ size: "sm" })}>
                  Create first saving card
                </Link>
                <Link
                  href="/admin"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "border-white/20 bg-white/10 text-white hover:bg-white/20"
                  )}
                >
                  Review setup
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <TimelineMetric
                label="Setup Completeness"
                value={`${readiness?.coverage.overallPercent ?? 0}%`}
                detail="Combined master-data and workflow readiness."
              />
              <TimelineMetric
                label="Master Data"
                value={`${configuredCollections}/${readiness?.masterData.length ?? 6}`}
                detail="Configured collections ready for planning."
              />
              <TimelineMetric
                label="Workflow Coverage"
                value={`${workflowCoverageReady}/${readiness?.workflowCoverage.length ?? 3}`}
                detail="Approval roles currently assigned."
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle>Next Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {nextActions.map((item) => (
                <div key={item} className="rounded-xl bg-[var(--muted)] px-4 py-3 text-sm">
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What This Timeline Shows</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <TimelinePromise
                title="Project timing"
                description="Cards appear against project and impact dates so teams can plan delivery windows realistically."
              />
              <TimelinePromise
                title="Pipeline progression"
                description="The timeline highlights which savings are still in pipeline, realised, or already achieved."
              />
              <TimelinePromise
                title="Portfolio filtering"
                description="Teams can narrow the view by buyer, category, supplier, business unit, phase, or search once the portfolio grows."
              />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant={timelineView === "gantt" ? "default" : "outline"}
          size="sm"
          onClick={() => setTimelineView("gantt")}
        >
          Gantt View
        </Button>
        <Button
          type="button"
          variant={timelineView === "scurve" ? "default" : "outline"}
          size="sm"
          onClick={() => setTimelineView("scurve")}
        >
          Volume S-Curve
        </Button>
      </div>

      {timelineView === "scurve" ? (
        <VolumeSCurve cards={cards} nowIso={nowIso} />
      ) : (
        <>
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-[1.25fr_repeat(5,minmax(0,1fr))_auto]">
        <Input
          placeholder="Search project, supplier, category"
          value={state.query}
          onChange={(e) => setState({ ...state, query: e.target.value })}
        />
        <LookupSelect
          value={state.categoryId}
          onChange={(categoryId) => setState({ ...state, categoryId })}
          items={filters.categories}
          label="All categories"
        />
        <LookupSelect value={state.buyerId} onChange={(buyerId) => setState({ ...state, buyerId })} items={filters.buyers} label="All buyers" />
        <LookupSelect
          value={state.supplierId}
          onChange={(supplierId) => setState({ ...state, supplierId })}
          items={filters.suppliers}
          label="All suppliers"
        />
        <LookupSelect
          value={state.businessUnitId}
          onChange={(businessUnitId) => setState({ ...state, businessUnitId })}
          items={filters.businessUnits}
          label="All business units"
        />
        <Select value={state.phase} onChange={(e) => setState({ ...state, phase: e.target.value })}>
          <option value="">All phases</option>
          {phases.map((phase) => (
            <option key={phase} value={phase}>
              {phaseLabels[phase]}
            </option>
          ))}
        </Select>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            setState({
              categoryId: "",
              buyerId: "",
              supplierId: "",
              businessUnitId: "",
              phase: "",
              query: ""
            })
          }
          disabled={!activeFilters}
        >
          Clear filters
        </Button>
      </div>

      {showRampUpState ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>
              {readiness?.isWorkspaceReady
                ? "Timeline is live and still ramping up"
                : "Timeline is live, but setup is still in progress"}
            </CardTitle>
            <CardDescription>
              {readiness?.isWorkspaceReady
                ? `You currently have ${cards.length} saving card${cards.length === 1 ? "" : "s"} on the timeline. It becomes more useful as more initiatives add timing and impact data.`
                : `You already have ${cards.length} saving card${cards.length === 1 ? "" : "s"} on the timeline, but shared setup still needs attention to keep planning and approvals consistent.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="grid gap-3 md:grid-cols-3">
              <TimelineMetric label="Live Cards" value={String(cards.length)} detail="Cards currently scheduled" />
              <TimelineMetric
                label="Master Data"
                value={`${configuredCollections}/${readiness?.masterData.length ?? 6}`}
                detail="Configured collections"
              />
              <TimelineMetric
                label="Workflow Coverage"
                value={readiness?.isWorkflowReady ? "Ready" : "Needs setup"}
                detail="Approval-role coverage"
              />
            </div>
            <div className="space-y-2">
              {nextActions.slice(0, 3).map((item) => (
                <div key={item} className="rounded-xl bg-[var(--muted)] px-4 py-3 text-sm">
                  {item}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!visibleCards.length ? (
        <Card>
          <CardHeader>
            <CardTitle>No saving cards match the current timeline view</CardTitle>
            <CardDescription>
              The timeline still has {cards.length} saving card{cards.length === 1 ? "" : "s"}, but none match the active filters.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm text-[var(--muted-foreground)]">
              Clear the filters to return to the full timeline, or create a new card if you are planning the next initiative.
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setState({
                    categoryId: "",
                    buyerId: "",
                    supplierId: "",
                    businessUnitId: "",
                    phase: "",
                    query: ""
                  })
                }
              >
                Clear filters
              </Button>
              <Link href="/saving-cards/new" className={buttonVariants({ size: "sm" })}>
                Create Saving Card
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!visibleCards.length ? null : (
      <Card className="overflow-hidden border-none bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_48%,#dbeafe_130%)] text-white shadow-[0_28px_80px_rgba(15,23,42,0.18)]">
        <CardHeader className="border-b border-white/15">
          <CardTitle>Portfolio savings pipeline</CardTitle>
          <CardDescription className="text-blue-100">
            Track the full pipeline, how much is realised, and how much has already landed as achieved savings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <SummaryMetric label="Total Pipeline Savings" value={summary.pipeline} tone="text-white" />
            <SummaryMetric label="Realised Savings" value={summary.realised} tone="text-blue-50" />
            <SummaryMetric label="Achieved Savings" value={summary.achieved} tone="text-emerald-100" />
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[12px] text-blue-50">
                <span>Pipeline progressed to realised or achieved</span>
                <span>{formatPercent(summary.realisedShare)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/15">
                <div className="h-full rounded-full bg-white/80" style={{ width: `${summary.realisedShare * 100}%` }} />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[12px] text-blue-50">
                <span>Pipeline fully achieved</span>
                <span>{formatPercent(summary.achievedShare)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/15">
                <div className="h-full rounded-full bg-emerald-300" style={{ width: `${summary.achievedShare * 100}%` }} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      {!visibleCards.length ? null : (
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle>Procurement savings timeline</CardTitle>
              <CardDescription>
                Scroll the portfolio horizontally, switch timeline scale instantly, and keep the headers visible while navigating dense project plans.
              </CardDescription>
            </div>
            <div className="flex flex-col items-stretch gap-3 sm:items-end">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => shiftScale(-1)}
                  disabled={scale === ZOOM_LEVELS[0]}
                >
                  Zoom Out
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => shiftScale(1)}
                  disabled={scale === ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
                >
                  Zoom In
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-medium text-[var(--muted-foreground)]">Timeline Scale</span>
                <Select value={scale} onChange={(event) => applyScale(event.target.value)} className="w-[160px]">
                  {ZOOM_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {toTitleCase(level)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-[12px]">
            {phases.map((phase) => (
              <span key={phase} className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ring-1 ${phaseStyles[phase].chip}`}>
                <span className={`h-2.5 w-2.5 rounded-full ${phaseStyles[phase].bar.split(" ")[0]}`} />
                {phaseLabels[phase]}
              </span>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="rounded-[24px] border border-[var(--border)] bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]">
              <div className="max-h-[70vh] overflow-auto scroll-smooth">
                <div className="min-w-fit">
                  <div className="sticky top-0 z-30 grid bg-[var(--card)]/95 backdrop-blur-sm" style={{ gridTemplateColumns: `${PROJECT_COLUMN_WIDTH}px ${gridWidth}px` }}>
                    <div className="sticky left-0 z-40 border-b border-r border-[var(--border)] bg-[var(--card)]/95 px-4 py-3 backdrop-blur-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Saving projects</p>
                      <p className="mt-1 text-[12px] text-[var(--foreground)]">{toTitleCase(scale)} scale</p>
                    </div>
                    <div className="relative grid border-b border-[var(--border)]" style={{ gridTemplateColumns: `repeat(${segments.length}, minmax(${segmentWidth}px, 1fr))` }}>
                      {currentMonthHighlight ? (
                        <div
                          className="pointer-events-none absolute inset-y-0 bg-blue-100/60"
                          style={{ left: toPercentStyle(currentMonthHighlight.left), width: toPercentStyle(currentMonthHighlight.width) }}
                        />
                      ) : null}
                      {segments.map((segment, index) => (
                        <div key={`${segment.primaryLabel}-${segment.start.toISOString()}-${index}`} className="border-r border-[var(--border)] px-4 py-3 last:border-r-0">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">{segment.secondaryLabel}</p>
                          <p className="font-semibold text-[var(--foreground)]">{segment.primaryLabel}</p>
                        </div>
                      ))}
                      {todayPosition >= 0 && todayPosition <= 100 ? (
                        <div
                          className="pointer-events-none absolute inset-y-0 w-px bg-red-500/80 shadow-[0_0_0_1px_rgba(239,68,68,0.18)]"
                          style={{ left: toPercentStyle(todayPosition) }}
                        >
                          <span className="absolute left-1 top-2 rounded-full bg-red-500 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                            Today
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid" style={{ gridTemplateColumns: `${PROJECT_COLUMN_WIDTH}px ${gridWidth}px` }}>
                    <div className="sticky left-0 z-20 bg-[var(--card)]">
                      {visibleCards.map((card) => (
                        <div key={card.id} className="flex h-[84px] items-center border-b border-r border-[var(--border)] bg-[var(--card)] px-4">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-[var(--foreground)]">{card.title}</p>
                            <p className="truncate text-[12px] text-[var(--muted-foreground)]">
                              {card.buyer.name} · {card.supplier.name}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div
                      className="relative bg-white"
                      style={{
                        height: `${gridHeight}px`,
                        backgroundImage: buildGridBackground(segmentWidth),
                        backgroundSize: `${segmentWidth}px 100%, 100% ${ROW_HEIGHT}px`
                      }}
                    >
                      {currentMonthHighlight ? (
                        <div
                          className="pointer-events-none absolute inset-y-0 bg-blue-100/45"
                          style={{ left: toPercentStyle(currentMonthHighlight.left), width: toPercentStyle(currentMonthHighlight.width) }}
                        />
                      ) : null}

                      {todayPosition >= 0 && todayPosition <= 100 ? (
                        <div className="pointer-events-none absolute inset-y-0 z-10 w-px bg-red-500/80" style={{ left: toPercentStyle(todayPosition) }} />
                      ) : null}

                      {visibleCards.map((card, index) => {
                        const phaseStyle = phaseStyles[card.phase];
                        const barLeft = getOffsetPercent(new Date(card.startDate).getTime(), timelineStart, totalRange);
                        const barRight = getOffsetPercent(new Date(card.endDate).getTime(), timelineStart, totalRange);
                        const impactLeft = getOffsetPercent(new Date(card.impactStartDate).getTime(), timelineStart, totalRange);
                        const impactRight = getOffsetPercent(new Date(card.impactEndDate).getTime(), timelineStart, totalRange);
                        const progress = getProjectProgress(card, referenceNow.getTime());
                        const barPixelWidth = ((barRight - barLeft) / 100) * gridWidth;
                        const barHeight = TIMELINE_BAR_HEIGHT;
                        const barTop = index * ROW_HEIGHT + Math.max((ROW_HEIGHT - TIMELINE_BAR_HEIGHT) / 2, 12);
                        const impactHeight = 18;

                        return (
                          <div key={card.id} className="group absolute left-0 right-0" style={{ top: `${barTop}px`, height: `${barHeight}px` }}>
                            <div
                              className={`absolute rounded-[14px] border border-white/45 shadow-[0_10px_22px_rgba(15,23,42,0.12)] ${phaseStyle.bar}`}
                              style={{
                                left: toPercentStyle(barLeft),
                                width: toPercentStyle(Math.max(barRight - barLeft, 1.6)),
                                height: `${barHeight}px`
                              }}
                            >
                              <div className="absolute inset-0 overflow-hidden rounded-[14px]">
                                <div className={`h-full ${phaseStyle.progress}`} style={{ width: toPercentStyle(progress * 100) }} />
                              </div>
                              <div className="relative flex h-full items-center justify-between gap-3 px-3">
                                <div className="min-w-0">
                                  {barPixelWidth >= 92 ? <p className="truncate text-[12px] font-semibold">{card.title}</p> : null}
                                  {barPixelWidth >= 164 ? (
                                    <p className="truncate text-[11px] opacity-90">{formatCurrency(Math.round(card.calculatedSavings), card.currency)}</p>
                                  ) : null}
                                  {barPixelWidth < 92 ? (
                                    <p className="truncate text-[11px] font-semibold">{formatCurrency(Math.round(card.calculatedSavings), card.currency)}</p>
                                  ) : null}
                                </div>
                                {barPixelWidth >= 230 ? (
                                  <span className="rounded-full bg-white/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]">
                                    {phaseLabels[card.phase]}
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            <div
                              className={`pointer-events-none absolute top-3 h-[16px] rounded-full border border-dashed border-white/70 ${phaseStyle.track}`}
                              style={{
                                left: toPercentStyle(impactLeft),
                                width: toPercentStyle(Math.max(impactRight - impactLeft, 1.2)),
                                top: `${Math.max((barHeight - impactHeight) / 2, 2)}px`,
                                height: `${impactHeight}px`
                              }}
                            />

                            <div className="pointer-events-none absolute left-0 top-[-120px] z-30 hidden w-72 rounded-2xl border border-slate-200 bg-white p-4 text-[12px] text-slate-700 shadow-[0_18px_50px_rgba(15,23,42,0.18)] group-hover:block">
                              <div className="space-y-1">
                                <p className="font-semibold text-slate-900">{card.title}</p>
                                <p>{card.supplier.name}</p>
                              </div>
                              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
                                <TooltipRow label="Saving" value={formatCurrency(Math.round(card.calculatedSavings), card.currency)} />
                                <TooltipRow label="Phase" value={phaseLabels[card.phase]} />
                                <TooltipRow label="Owner" value={card.buyer.name} />
                                <TooltipRow
                                  label="Impact Period"
                                  value={`${formatShortDate(card.impactStartDate)} - ${formatShortDate(card.impactEndDate)}`}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
        </CardContent>
      </Card>
      )}
        </>
      )}
    </div>
  );
}

function TimelineMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white/80 p-4 text-[var(--foreground)]">
      <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">{detail}</p>
    </div>
  );
}

function TimelinePromise({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/40 p-4">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">{description}</p>
    </div>
  );
}

function SummaryMetric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-[22px] border border-white/12 bg-white/10 px-4 py-4 backdrop-blur-sm">
      <p className="text-[11px] uppercase tracking-[0.18em] text-blue-100">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${tone}`}>{formatCurrency(Math.round(value), "EUR")}</p>
    </div>
  );
}

function LookupSelect({
  value,
  onChange,
  items,
  label
}: {
  value: string;
  onChange: (value: string) => void;
  items: Array<{ id: string; name: string }>;
  label: string;
}) {
  return (
    <Select value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{label}</option>
      {items.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name}
        </option>
      ))}
    </Select>
  );
}

function TooltipRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 text-slate-800">{value}</p>
    </div>
  );
}

function formatDateLabel(value: Date | null, fallback: string) {
  if (!value) {
    return fallback;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function buildTimelineSegments(cards: SavingCardPortfolio[], scale: ZoomLevel) {
  if (cards.length === 0) {
    const now = new Date();
    return [buildSegmentForDate(now, scale)];
  }

  const minTime = Math.min(...cards.map((card) => new Date(card.startDate).getTime()));
  const maxTime = Math.max(...cards.map((card) => new Date(card.endDate).getTime()));
  const segments: TimelineSegment[] = [];
  let cursor = getSegmentStart(new Date(minTime), scale);
  const endBoundary = getSegmentEnd(new Date(maxTime), scale);

  while (cursor <= endBoundary) {
    segments.push(buildSegmentForDate(cursor, scale));
    cursor = getNextSegmentStart(cursor, scale);
  }

  return segments;
}

function buildSegmentForDate(date: Date, scale: ZoomLevel): TimelineSegment {
  const start = getSegmentStart(date, scale);
  const end = getSegmentEnd(date, scale);

  if (scale === "YEAR") {
    return {
      start,
      end,
      primaryLabel: `${start.getFullYear()}`,
      secondaryLabel: "Year"
    };
  }

  if (scale === "QUARTER") {
    const quarter = Math.floor(start.getMonth() / 3) + 1;
    return {
      start,
      end,
      primaryLabel: `Q${quarter}`,
      secondaryLabel: `${start.getFullYear()}`
    };
  }

  if (scale === "MONTH") {
    return {
      start,
      end,
      primaryLabel: new Intl.DateTimeFormat("en-US", { month: "short" }).format(start),
      secondaryLabel: `${start.getFullYear()}`
    };
  }

  return {
    start,
    end,
    primaryLabel: `W${getWeekNumber(start)}`,
    secondaryLabel: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(start)
  };
}

function getSegmentStart(date: Date, scale: ZoomLevel) {
  if (scale === "YEAR") return new Date(date.getFullYear(), 0, 1);
  if (scale === "QUARTER") return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);
  if (scale === "MONTH") return new Date(date.getFullYear(), date.getMonth(), 1);
  return startOfWeek(date);
}

function getSegmentEnd(date: Date, scale: ZoomLevel) {
  const start = getSegmentStart(date, scale);

  if (scale === "YEAR") return new Date(start.getFullYear(), 11, 31, 23, 59, 59, 999);
  if (scale === "QUARTER") return new Date(start.getFullYear(), start.getMonth() + 3, 0, 23, 59, 59, 999);
  if (scale === "MONTH") return new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);
}

function getNextSegmentStart(date: Date, scale: ZoomLevel) {
  if (scale === "YEAR") return new Date(date.getFullYear() + 1, 0, 1);
  if (scale === "QUARTER") return new Date(date.getFullYear(), date.getMonth() + 3, 1);
  if (scale === "MONTH") return new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7);
}

function getCurrentMonthRange(now: Date) {
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  };
}

function getRangeHighlight(timelineStart: number, totalRange: number, range: { start: Date; end: Date }) {
  const start = range.start.getTime();
  const end = range.end.getTime();
  const timelineEnd = timelineStart + totalRange;

  if (end < timelineStart || start > timelineEnd) return null;

  return {
    left: getOffsetPercent(Math.max(start, timelineStart), timelineStart, totalRange),
    width:
      getOffsetPercent(Math.min(end, timelineEnd), timelineStart, totalRange) -
      getOffsetPercent(Math.max(start, timelineStart), timelineStart, totalRange)
  };
}

function getProjectProgress(card: SavingCardPortfolio, now: number) {
  if (card.phase === "ACHIEVED") return 1;
  if (card.phase === "CANCELLED") return 0;

  const impactStart = new Date(card.impactStartDate).getTime();
  const impactEnd = new Date(card.impactEndDate).getTime();
  const impactDuration = Math.max(impactEnd - impactStart, DAY_MS);
  const impactElapsed = clamp((now - impactStart) / impactDuration, 0, 1);

  if (card.phase === "REALISED") return clamp(0.45 + impactElapsed * 0.45, 0.45, 0.95);
  if (card.phase === "VALIDATED") return clamp(0.18 + impactElapsed * 0.18, 0.18, 0.36);
  return clamp(0.05 + impactElapsed * 0.07, 0.05, 0.12);
}

function getOffsetPercent(timestamp: number, timelineStart: number, totalRange: number) {
  return ((timestamp - timelineStart) / totalRange) * 100;
}

function buildGridBackground(segmentWidth: number) {
  return [
    `repeating-linear-gradient(to right, rgba(148,163,184,0.18), rgba(148,163,184,0.18) 1px, transparent 1px, transparent ${segmentWidth}px)`,
    `repeating-linear-gradient(to bottom, rgba(226,232,240,0.85), rgba(226,232,240,0.85) 1px, transparent 1px, transparent ${ROW_HEIGHT}px)`
  ].join(", ");
}

function startOfWeek(date: Date) {
  const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = normalized.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  normalized.setDate(normalized.getDate() + diff);
  return normalized;
}

function getWeekNumber(date: Date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil(((target.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
}

function formatShortDate(date: Date | string) {
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric" }).format(new Date(date));
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function toPercentStyle(value: number) {
  return `${value.toFixed(4)}%`;
}

function toTitleCase(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function buildTimelineNextActions(readiness: WorkspaceReadiness | null | undefined, cardCount: number) {
  const actions: string[] = [];

  if (!cardCount) {
    actions.push("Create the first saving card so the timeline can become the live planning view.");
  } else if (cardCount < 3) {
    actions.push("Add more saving cards so the timeline reflects the broader delivery pipeline instead of only a few initiatives.");
  }

  readiness?.missingCoreSetup.forEach((item) => {
    actions.push(`Add ${item} in Settings so future cards use shared master data across planning views.`);
  });

  readiness?.missingWorkflowCoverage.forEach((item) => {
    actions.push(`Assign at least one ${item} user so timeline-driven planning aligns with approval routing.`);
  });

  if (!actions.length) {
    actions.push("Progress saving cards with realistic dates so the timeline becomes a reliable portfolio-planning surface.");
  }

  return actions.slice(0, 4);
}
