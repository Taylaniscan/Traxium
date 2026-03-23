"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Filter,
  Target,
  TrendingUp
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import type {
  CommandCenterApiError,
  CommandCenterData,
  CommandCenterFilterOptions,
  CommandCenterFilters,
  CommandCenterResolvedFilters,
  WorkspaceReadiness,
} from "@/lib/types";
import {
  commandCenterFilterKeys,
  emptyCommandCenterFilters,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber } from "@/lib/utils/numberFormatter";

export function CommandCenterClient({
  initialData,
  filterOptions,
  readiness,
}: {
  initialData: CommandCenterData;
  filterOptions: CommandCenterFilterOptions;
  readiness?: WorkspaceReadiness | null;
}) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<CommandCenterResolvedFilters>(() => ({
    ...emptyCommandCenterFilters,
    ...initialData.filters,
  }));
  const resetFilters = () => setFilters(emptyCommandCenterFilters);

  useEffect(() => {
    let ignore = false;
    setLoading(true);

    fetchCommandCenterData(filters)
      .then((result) => {
        if (!ignore) {
          setData(result);
        }
      })
      .catch((error) => {
        if (!ignore) {
          console.error("Command Center data could not be refreshed:", error);
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [filters]);

  const kpis = [
    { label: "Pipeline Savings", value: formatCurrency(data.kpis.totalPipelineSavings, "EUR"), icon: CircleDollarSign, tone: "text-blue-600" },
    { label: "Realised Savings", value: formatCurrency(data.kpis.realisedSavings, "EUR"), icon: TrendingUp, tone: "text-emerald-600" },
    { label: "Achieved Savings", value: formatCurrency(data.kpis.achievedSavings, "EUR"), icon: Target, tone: "text-indigo-600" },
    { label: "Savings Forecast", value: formatCurrency(data.kpis.savingsForecast, "EUR"), icon: ClipboardList, tone: "text-amber-600" },
    { label: "Active Saving Projects", value: formatNumber(data.kpis.activeProjects), icon: CheckCircle2, tone: "text-slate-600" },
    { label: "Pending Approvals", value: formatNumber(data.kpis.pendingApprovals), icon: AlertTriangle, tone: "text-rose-600" }
  ];
  const hasActiveFilters = Boolean(
    filters.categoryId || filters.businessUnitId || filters.buyerId || filters.plantId || filters.supplierId
  );
  const configuredCollections = readiness?.masterData.filter((item) => item.ready).length ?? 0;
  const workflowCoverageReady = readiness?.workflowCoverage.filter((item) => item.ready).length ?? 0;
  const hasMeaningfulData =
    data.kpis.totalPipelineSavings > 0 ||
    data.kpis.realisedSavings > 0 ||
    data.kpis.achievedSavings > 0 ||
    data.kpis.savingsForecast > 0 ||
    data.kpis.activeProjects > 0 ||
    data.kpis.pendingApprovals > 0 ||
    data.pipelineByPhase.some((item) => item.savings > 0) ||
    data.forecastCurve.length > 0 ||
    data.topSuppliers.length > 0 ||
    data.savingsByRiskLevel.length > 0 ||
    data.savingsByQualificationStatus.some((item) => item.savings > 0);
  const workspaceCardCount =
    readiness?.counts.savingCards ??
    (hasMeaningfulData ? Math.max(data.kpis.activeProjects, 1) : 0);
  const hasWorkspaceCards = workspaceCardCount > 0;
  const showRampUpState =
    hasWorkspaceCards &&
    hasMeaningfulData &&
    (workspaceCardCount < 3 || (readiness ? !readiness.isWorkspaceReady : false));
  const nextActions = buildCommandCenterNextActions(readiness, workspaceCardCount);

  if (!hasWorkspaceCards) {
    return (
      <div className="space-y-6">
        <Card className="border-0 bg-[linear-gradient(135deg,#113b61_0%,#194f7a_58%,#1b7f87_100%)] text-white">
          <CardContent className="grid gap-6 p-8 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4">
              <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.12em] text-cyan-100">
                Command Center Launch
              </div>
              <div>
                <h2 className="text-3xl font-semibold tracking-tight">
                  No live command-center data yet.
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-cyan-50/85">
                  This view becomes the shared analytics surface once the first saving cards are active. It summarizes pipeline, forecast, supplier exposure, and risk concentration from live portfolio data.
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
              <CommandCenterMetric
                label="Setup Completeness"
                value={`${readiness?.coverage.overallPercent ?? 0}%`}
                detail="Combined master-data and workflow readiness."
              />
              <CommandCenterMetric
                label="Master Data"
                value={`${configuredCollections}/${readiness?.masterData.length ?? 6}`}
                detail="Configured collections"
              />
              <CommandCenterMetric
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
              <CardTitle>What This View Tracks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <CommandCenterPromise
                title="Pipeline and forecast coverage"
                description="The command center highlights current savings pipeline, realised impact, and forecast timing once cards are live."
              />
              <CommandCenterPromise
                title="Supplier and risk concentration"
                description="It surfaces supplier exposure and risk concentration from the active sourcing portfolio."
              />
              <CommandCenterPromise
                title="Workspace-wide operating picture"
                description="Procurement and finance can use it as the fast summary view before drilling into individual cards."
              />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showRampUpState ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>
              {readiness?.isWorkspaceReady
                ? "Command Center is live and still ramping up"
                : "Command Center is live, but setup is still in progress"}
            </CardTitle>
            <CardDescription>
              {readiness?.isWorkspaceReady
                ? `You currently have ${workspaceCardCount} saving card${workspaceCardCount === 1 ? "" : "s"} feeding this view. Trend, supplier, and risk analytics become more representative as more initiatives are added.`
                : `You already have ${workspaceCardCount} saving card${workspaceCardCount === 1 ? "" : "s"} in the workspace, but shared setup still needs attention to keep reporting and approvals consistent.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="grid gap-3 md:grid-cols-3">
              <CommandCenterMetric label="Live Cards" value={String(workspaceCardCount)} detail="Cards currently feeding analytics" />
              <CommandCenterMetric
                label="Master Data"
                value={`${configuredCollections}/${readiness?.masterData.length ?? 6}`}
                detail="Configured collections"
              />
              <CommandCenterMetric
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

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle>Global Filters</CardTitle>
            <CardDescription>Filter the command center by ownership, scope, or supplier exposure.</CardDescription>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/60 p-2">
            <Filter className="h-4 w-4 text-[var(--muted-foreground)]" />
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
          <Select value={filters.categoryId} onChange={(event) => setFilters((current) => ({ ...current, categoryId: event.target.value }))}>
            <option value="">All categories</option>
            {filterOptions.categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
          <Select value={filters.businessUnitId} onChange={(event) => setFilters((current) => ({ ...current, businessUnitId: event.target.value }))}>
            <option value="">All business units</option>
            {filterOptions.businessUnits.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
          <Select value={filters.buyerId} onChange={(event) => setFilters((current) => ({ ...current, buyerId: event.target.value }))}>
            <option value="">All buyers</option>
            {filterOptions.buyers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
          <Select value={filters.plantId} onChange={(event) => setFilters((current) => ({ ...current, plantId: event.target.value }))}>
            <option value="">All plants</option>
            {filterOptions.plants.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
          <Select value={filters.supplierId} onChange={(event) => setFilters((current) => ({ ...current, supplierId: event.target.value }))}>
            <option value="">All suppliers</option>
            {filterOptions.suppliers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
          <Button
            type="button"
            variant="outline"
            onClick={resetFilters}
            disabled={!hasActiveFilters}
          >
            Clear filters
          </Button>
        </CardContent>
      </Card>

      {!hasMeaningfulData ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {hasActiveFilters
                ? "No command-center data matches the current view"
                : "Command Center is still ramping up"}
            </CardTitle>
            <CardDescription>
              {hasActiveFilters
                ? `The command center still has ${workspaceCardCount} saving card${workspaceCardCount === 1 ? "" : "s"}, but none match the active filters.`
                : `The command center has ${workspaceCardCount} saving card${workspaceCardCount === 1 ? "" : "s"}, but there is not enough live savings, timing, or supplier signal yet to populate this view cleanly.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-[var(--muted-foreground)]">
              {hasActiveFilters
                ? "Clear the filters to return to the full command-center view, or create a new card if you are looking for a fresh initiative."
                : "Complete the missing setup items, then add or enrich saving cards so pipeline, forecast, and supplier analytics have enough real portfolio data to work with."}
            </div>
            <div className="flex flex-wrap gap-3">
              {hasActiveFilters ? (
                <Button type="button" variant="outline" onClick={resetFilters}>
                  Clear filters
                </Button>
              ) : null}
              <Link href="/saving-cards/new" className={buttonVariants({ size: "sm" })}>
                Create Saving Card
              </Link>
              <Link href="/admin" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Review setup
              </Link>
            </div>
            {!hasActiveFilters ? (
              <div className="grid gap-3 md:grid-cols-3">
                {nextActions.slice(0, 3).map((item) => (
                  <div key={item} className="rounded-xl bg-[var(--muted)] px-4 py-3 text-sm">
                    {item}
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {kpis.map((kpi) => {
              const Icon = kpi.icon;
              return (
                <Card key={kpi.label}>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="rounded-xl bg-[var(--muted)]/70 p-2">
                        <Icon className={`h-5 w-5 ${kpi.tone}`} />
                      </div>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
                        {loading ? "Updating" : "Live"}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[32px] font-semibold leading-none tracking-tight">{kpi.value}</p>
                      <p className="text-[13px] font-medium text-[var(--muted-foreground)]">{kpi.label}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <Card>
              <CardHeader>
                <CardTitle>Savings Pipeline by Phase</CardTitle>
                <CardDescription>Phase-level visibility across the active and cancelled savings portfolio.</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.pipelineByPhase}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#6B7280", fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatNumber(value)} tick={{ fill: "#6B7280", fontSize: 12 }} />
                    <Tooltip contentStyle={{ borderRadius: 12, borderColor: "#E5E7EB", fontSize: 12 }} formatter={(value: number) => formatCurrency(value, "EUR")} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="savings" name="Savings" stackId="total" fill="#2563EB" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Savings Forecast Over Time</CardTitle>
                <CardDescription>Monthly forecast curve derived from impact timing and value realisation patterns.</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.forecastCurve}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "#6B7280", fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatNumber(value)} tick={{ fill: "#6B7280", fontSize: 12 }} />
                    <Tooltip contentStyle={{ borderRadius: 12, borderColor: "#E5E7EB", fontSize: 12 }} formatter={(value: number) => formatCurrency(value, "EUR")} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="savings" name="Current Savings" stroke="#2563EB" strokeWidth={3} dot={false} />
                    <Line type="monotone" dataKey="forecast" name="Forecast" stroke="#16A34A" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Top Suppliers by Savings Impact</CardTitle>
                <CardDescription>Supplier exposure ranked by associated savings value.</CardDescription>
              </CardHeader>
              <CardContent className="h-[420px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.topSuppliers} layout="vertical" margin={{ left: 18 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                    <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(value) => formatNumber(value)} tick={{ fill: "#6B7280", fontSize: 12 }} />
                    <YAxis dataKey="supplier" type="category" width={120} tickLine={false} axisLine={false} tick={{ fill: "#111827", fontSize: 12 }} />
                    <Tooltip contentStyle={{ borderRadius: 12, borderColor: "#E5E7EB", fontSize: 12 }} formatter={(value: number) => formatCurrency(value, "EUR")} />
                    <Bar dataKey="savings" fill="#1D4ED8" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Savings by Risk Level</CardTitle>
                  <CardDescription>Exposure based on the currently selected sourcing alternative risk signal.</CardDescription>
                </CardHeader>
                <CardContent className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.savingsByRiskLevel}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="level" tickLine={false} axisLine={false} tick={{ fill: "#6B7280", fontSize: 12 }} />
                      <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatNumber(value)} tick={{ fill: "#6B7280", fontSize: 12 }} />
                      <Tooltip contentStyle={{ borderRadius: 12, borderColor: "#E5E7EB", fontSize: 12 }} formatter={(value: number) => formatCurrency(value, "EUR")} />
                      <Bar dataKey="savings" fill="#F59E0B" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Savings by Qualification Status</CardTitle>
                  <CardDescription>Validation maturity of the current savings portfolio.</CardDescription>
                </CardHeader>
                <CardContent className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.savingsByQualificationStatus}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="status" tickLine={false} axisLine={false} tick={{ fill: "#6B7280", fontSize: 12 }} />
                      <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatNumber(value)} tick={{ fill: "#6B7280", fontSize: 12 }} />
                      <Tooltip contentStyle={{ borderRadius: 12, borderColor: "#E5E7EB", fontSize: 12 }} formatter={(value: number) => formatCurrency(value, "EUR")} />
                      <Bar dataKey="savings" fill="#16A34A" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function buildCommandCenterSearchParams(filters: CommandCenterFilters) {
  const params = new URLSearchParams();

  for (const key of commandCenterFilterKeys) {
    const value = filters[key]?.trim();
    if (value) {
      params.set(key, value);
    }
  }

  return params;
}

async function fetchCommandCenterData(
  filters: CommandCenterFilters
): Promise<CommandCenterData> {
  const params = buildCommandCenterSearchParams(filters);
  const query = params.toString();
  const response = await fetch(
    query ? `/api/command-center?${query}` : "/api/command-center",
    { cache: "no-store" }
  );

  const result = (await response.json()) as CommandCenterData | CommandCenterApiError;

  if (!response.ok || "error" in result) {
    throw new Error(
      "error" in result ? result.error : "Unable to refresh command center."
    );
  }

  return result;
}

function CommandCenterMetric({
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
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">{detail}</p>
    </div>
  );
}

function CommandCenterPromise({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">{description}</p>
    </div>
  );
}

function buildCommandCenterNextActions(
  readiness: WorkspaceReadiness | null | undefined,
  cardCount: number
) {
  const actions: string[] = [];

  if (!cardCount) {
    actions.push("Create the first saving card to activate live pipeline, forecast, and supplier analysis.");
  } else if (cardCount < 3) {
    actions.push("Add more saving cards so pipeline, supplier, and risk analytics become more representative.");
  }

  readiness?.missingCoreSetup.forEach((item) => {
    actions.push(`Add ${item} in Settings so command-center filters and analytics use shared master data.`);
  });

  readiness?.missingWorkflowCoverage.forEach((item) => {
    actions.push(`Assign at least one ${item} user so workflow demand and pending approvals reflect the real operating model.`);
  });

  if (!actions.length) {
    actions.push("Progress more saving cards through the workflow to deepen pipeline, forecast, and supplier insight.");
  }

  return actions.slice(0, 4);
}
