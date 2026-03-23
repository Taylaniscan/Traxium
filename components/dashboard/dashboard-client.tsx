"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowUpRight, CircleDollarSign, Filter, Settings, Target, TrendingUp } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { implementationComplexities, phaseLabels, qualificationStatuses, savingDrivers } from "@/lib/constants";
import type { DashboardData, WorkspaceReadiness } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber } from "@/lib/utils/numberFormatter";

export function DashboardClient({
  data,
  readiness,
}: {
  data: DashboardData;
  readiness?: WorkspaceReadiness | null;
}) {
  const [filters, setFilters] = useState({
    savingDriver: "",
    implementationComplexity: "",
    qualificationStatus: ""
  });

  const filteredCards = useMemo(
    () =>
      data.cards.filter((card) => {
        if (filters.savingDriver && card.savingDriver !== filters.savingDriver) return false;
        if (filters.implementationComplexity && card.implementationComplexity !== filters.implementationComplexity) return false;
        if (filters.qualificationStatus && card.qualificationStatus !== filters.qualificationStatus) return false;
        return true;
      }),
    [data.cards, filters]
  );

  const metrics = useMemo(() => deriveDashboardMetrics(filteredCards), [filteredCards]);
  const hasCards = data.cards.length > 0;
  const hasActiveFilters = Boolean(
    filters.savingDriver || filters.implementationComplexity || filters.qualificationStatus
  );
  const showRampUpState =
    hasCards && (data.cards.length < 3 || (readiness ? !readiness.isWorkspaceReady : false));
  const configuredCollections = readiness?.masterData.filter((item) => item.ready).length ?? 0;
  const nextActions = buildDashboardNextActions(readiness, data.cards.length);

  const kpis = [
    { label: "Pipeline Savings", value: metrics.pipelineSavings, icon: CircleDollarSign },
    { label: "Realised Savings", value: metrics.realisedSavings, icon: TrendingUp },
    { label: "Achieved Savings", value: metrics.achievedSavings, icon: Target },
    { label: "Savings Forecast", value: metrics.forecastSavings, icon: ArrowUpRight }
  ];

  if (!hasCards) {
    return (
      <DashboardZeroState
        readiness={readiness}
        configuredCollections={configuredCollections}
        nextActions={nextActions}
      />
    );
  }

  return (
    <div className="space-y-6">
      {showRampUpState ? (
        <DashboardRampUpCard
          readiness={readiness}
          cardCount={data.cards.length}
          configuredCollections={configuredCollections}
          nextActions={nextActions}
        />
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle>Portfolio Filters</CardTitle>
            <CardDescription>Refine the dashboard by driver, implementation effort, or qualification stage.</CardDescription>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/60 p-2">
            <Filter className="h-4 w-4 text-[var(--muted-foreground)]" />
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Select value={filters.savingDriver} onChange={(event) => setFilters((current) => ({ ...current, savingDriver: event.target.value }))}>
            <option value="">All saving drivers</option>
            {savingDrivers.map((driver) => (
              <option key={driver} value={driver}>
                {driver}
              </option>
            ))}
          </Select>
          <Select
            value={filters.implementationComplexity}
            onChange={(event) => setFilters((current) => ({ ...current, implementationComplexity: event.target.value }))}
          >
            <option value="">All implementation complexity</option>
            {implementationComplexities.map((complexity) => (
              <option key={complexity} value={complexity}>
                {complexity}
              </option>
            ))}
          </Select>
          <Select
            value={filters.qualificationStatus}
            onChange={(event) => setFilters((current) => ({ ...current, qualificationStatus: event.target.value }))}
          >
            <option value="">All qualification statuses</option>
            {qualificationStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
        </CardContent>
      </Card>

      {!filteredCards.length ? (
        <Card>
          <CardHeader>
            <CardTitle>No cards match the active filters</CardTitle>
            <CardDescription>
              Clear the filters to return to the live portfolio view and restore KPI, forecast, and portfolio analysis.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm text-[var(--muted-foreground)]">
              The dashboard still has {data.cards.length} saving card{data.cards.length === 1 ? "" : "s"} in this workspace, but none match the current filter combination.
            </div>
            {hasActiveFilters ? (
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setFilters({
                    savingDriver: "",
                    implementationComplexity: "",
                    qualificationStatus: ""
                  })
                }
              >
                Clear filters
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label}>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="rounded-xl bg-blue-50 p-2 text-[var(--primary)]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted-foreground)]">KPI</span>
                </div>
                <div className="space-y-1">
                  <p className="text-[32px] font-semibold leading-none tracking-tight text-[var(--foreground)]">{formatCurrency(kpi.value, "EUR")}</p>
                  <p className="text-[13px] font-medium text-[var(--muted-foreground)]">{kpi.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <ChartCard title="Savings by Category" description="Contribution by procurement category." data={metrics.byCategory} color="#2563EB" />
        <ChartCard title="Savings by Driver" description="Savings grouped by initiative driver." data={metrics.byDriver} color="#1D4ED8" />
        <ForecastCard data={metrics.monthlyTrend} />
      </div>

      <TableCard
        title="Top Saving Projects"
        description="Highest-value saving cards in the current filtered portfolio."
        rows={metrics.topProjects}
      />
        </>
      )}
    </div>
  );
}

function DashboardZeroState({
  readiness,
  configuredCollections,
  nextActions,
}: {
  readiness?: WorkspaceReadiness | null;
  configuredCollections: number;
  nextActions: string[];
}) {
  const totalCollections = readiness?.masterData.length ?? 0;
  const workflowCoverageReady = readiness?.workflowCoverage.filter((item) => item.ready).length ?? 0;

  return (
    <div className="space-y-6">
      <Card className="border-0 bg-[linear-gradient(135deg,#113b61_0%,#194f7a_58%,#1b7f87_100%)] text-white">
        <CardContent className="grid gap-6 p-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.12em] text-cyan-100">
              Workspace Launch
            </div>
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">
                No live saving cards yet.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-cyan-50/85">
                This dashboard becomes the operating view once the first initiatives are created. Start by confirming shared setup, then create the first saving card so pipeline, forecast, and portfolio analytics have real data to build on.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/saving-cards/new" className={buttonVariants({ size: "sm" })}>
                Create first saving card
              </Link>
              <Link href="/admin" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "border-white/20 bg-white/10 text-white hover:bg-white/20")}>
                Review setup
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <LaunchMetric
              label="Setup Completeness"
              value={`${readiness?.coverage.overallPercent ?? 0}%`}
              detail="Combined master-data and workflow readiness."
            />
            <LaunchMetric
              label="Master Data"
              value={`${configuredCollections}/${totalCollections || 6}`}
              detail="Configured master-data collections ready for card creation."
            />
            <LaunchMetric
              label="Workflow Coverage"
              value={`${workflowCoverageReady}/${readiness?.workflowCoverage.length ?? 3}`}
              detail="Approval roles currently assigned in this workspace."
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Next Actions</CardTitle>
            <CardDescription>Focus on the few steps that move the workspace from setup into live portfolio management.</CardDescription>
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
            <CardTitle>What Appears Here Next</CardTitle>
            <CardDescription>The dashboard becomes operational as soon as the first cards are live.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <PromiseCard
              title="Portfolio KPIs"
              description="Pipeline, realised, achieved, and forecast savings will use live card values instead of placeholders."
            />
            <PromiseCard
              title="Trend Views"
              description="Category, driver, and forecast charts will populate as impact dates and savings data accumulate."
            />
            <PromiseCard
              title="Operational Priorities"
              description="Top-project views will highlight where commercial value is concentrated."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DashboardRampUpCard({
  readiness,
  cardCount,
  configuredCollections,
  nextActions,
}: {
  readiness?: WorkspaceReadiness | null;
  cardCount: number;
  configuredCollections: number;
  nextActions: string[];
}) {
  const totalCollections = readiness?.masterData.length ?? 6;
  const workflowReady = readiness?.isWorkflowReady ?? false;

  return (
    <Card className="border-dashed">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle>
            {readiness?.isWorkspaceReady
              ? "Dashboard is live and still ramping up"
              : "Dashboard is live, but setup is still in progress"}
          </CardTitle>
          <CardDescription>
            {readiness?.isWorkspaceReady
              ? `You currently have ${cardCount} saving card${cardCount === 1 ? "" : "s"} live. Trends and portfolio views will become more reliable as more initiatives move through the workflow.`
              : `You already have ${cardCount} saving card${cardCount === 1 ? "" : "s"} live, but some shared setup still needs attention to keep the workspace standardized.`}
          </CardDescription>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/60 p-2">
          <Settings className="h-4 w-4 text-[var(--muted-foreground)]" />
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="grid gap-3 md:grid-cols-3">
          <LaunchMetric
            label="Live Saving Cards"
            value={String(cardCount)}
            detail="Current portfolio size"
          />
          <LaunchMetric
            label="Master Data"
            value={`${configuredCollections}/${totalCollections}`}
            detail="Configured collections"
          />
          <LaunchMetric
            label="Workflow Coverage"
            value={workflowReady ? "Ready" : "Needs setup"}
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
  );
}

function LaunchMetric({
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

function PromiseCard({
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

function ChartCard({
  title,
  description,
  data,
  color
}: {
  title: string;
  description: string;
  data: Array<{ label: string; savings: number }>;
  color: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#6B7280", fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatNumber(value)} tick={{ fill: "#6B7280", fontSize: 12 }} />
            <Tooltip
              cursor={{ fill: "rgba(37, 99, 235, 0.06)" }}
              contentStyle={{ borderRadius: 12, borderColor: "#E5E7EB", fontSize: 12 }}
              formatter={(value: number) => formatCurrency(value, "EUR")}
            />
            <Bar dataKey="savings" fill={color} radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function ForecastCard({ data }: { data: Array<{ month: string; savings: number; forecast: number }> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Savings Forecast</CardTitle>
        <CardDescription>Current savings run-rate versus forecast pipeline contribution.</CardDescription>
      </CardHeader>
      <CardContent className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "#6B7280", fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatNumber(value)} tick={{ fill: "#6B7280", fontSize: 12 }} />
            <Tooltip
              cursor={{ stroke: "#2563EB", strokeOpacity: 0.18 }}
              contentStyle={{ borderRadius: 12, borderColor: "#E5E7EB", fontSize: 12 }}
              formatter={(value: number) => formatCurrency(value, "EUR")}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: "#6B7280" }} />
            <Line type="monotone" dataKey="savings" name="Savings" stroke="#2563EB" strokeWidth={3} dot={false} />
            <Line type="monotone" dataKey="forecast" name="Forecast" stroke="#16A34A" strokeWidth={3} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function TableCard({
  title,
  description,
  rows
}: {
  title: string;
  description: string;
  rows: Array<{ title: string; category: string; phase: string; value: number }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHead>
            <tr>
              <TableHeaderCell>Project</TableHeaderCell>
              <TableHeaderCell>Category</TableHeaderCell>
              <TableHeaderCell>Phase</TableHeaderCell>
              <TableHeaderCell className="text-right">Value</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {rows.length ? (
              rows.map((row) => (
                <TableRow key={`${row.title}-${row.phase}`}>
                  <TableCell className="font-medium">{row.title}</TableCell>
                  <TableCell>{row.category}</TableCell>
                  <TableCell>{row.phase}</TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(row.value, "EUR")}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell className="py-8 text-[var(--muted-foreground)]" colSpan={4}>
                  No saving cards match the active filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function deriveDashboardMetrics(cards: DashboardData["cards"]) {
  const pipelineSavings = cards.filter((card) => card.phase !== "CANCELLED").reduce((sum, card) => sum + card.calculatedSavings, 0);
  const realisedSavings = cards.filter((card) => card.phase === "REALISED").reduce((sum, card) => sum + card.calculatedSavings, 0);
  const achievedSavings = cards.filter((card) => card.phase === "ACHIEVED").reduce((sum, card) => sum + card.calculatedSavings, 0);

  const monthlyTrend = Object.values(
    cards.reduce<Record<string, { month: string; savings: number; forecast: number }>>((acc, card) => {
      const key = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(card.impactStartDate));
      acc[key] ??= { month: key, savings: 0, forecast: 0 };
      acc[key].savings += card.calculatedSavings;
      acc[key].forecast += card.calculatedSavings * getForecastFactor(card.frequency);
      return acc;
    }, {})
  );

  return {
    pipelineSavings,
    realisedSavings,
    achievedSavings,
    forecastSavings: monthlyTrend.reduce((sum, item) => sum + item.forecast, 0),
    monthlyTrend,
    byCategory: groupSavings(cards, (card) => card.category.name),
    byDriver: groupSavings(cards, (card) => card.savingDriver ?? "Unspecified"),
    topProjects: [...cards]
      .sort((a, b) => b.calculatedSavings - a.calculatedSavings)
      .slice(0, 5)
      .map((card) => ({
        title: card.title,
        category: card.category.name,
        phase: phaseLabels[card.phase],
        value: card.calculatedSavings
      }))
  };
}

function groupSavings(cards: DashboardData["cards"], getLabel: (card: DashboardData["cards"][number]) => string) {
  return Object.values(
    cards.reduce<Record<string, { label: string; savings: number }>>((acc, card) => {
      const key = getLabel(card);
      acc[key] ??= { label: key, savings: 0 };
      acc[key].savings += card.calculatedSavings;
      return acc;
    }, {})
  );
}

function getForecastFactor(frequency: DashboardData["cards"][number]["frequency"]) {
  switch (frequency) {
    case "ONE_TIME":
      return 1;
    case "MULTI_YEAR":
      return 1.6;
    default:
      return 1.2;
  }
}

function buildDashboardNextActions(readiness: WorkspaceReadiness | null | undefined, cardCount: number) {
  const actions: string[] = [];

  if (!cardCount) {
    actions.push("Create the first saving card to activate live KPI, forecast, and portfolio reporting.");
  } else if (cardCount < 3) {
    actions.push("Add more saving cards so trends and portfolio views become more representative.");
  }

  readiness?.missingCoreSetup.forEach((item) => {
    actions.push(`Add ${item} in Settings to standardize card creation and portfolio reporting.`);
  });

  readiness?.missingWorkflowCoverage.forEach((item) => {
    actions.push(`Assign at least one ${item} user so phase approvals route cleanly.`);
  });

  if (!actions.length) {
    actions.push("Create and progress saving cards through the workflow to deepen trend accuracy and portfolio coverage.");
  }

  return actions.slice(0, 4);
}
