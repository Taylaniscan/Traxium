"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Filter,
  TrendingUp,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

export type CommandCenterClientLoadState = {
  dataError?: string | null;
  filterOptionsError?: string | null;
  readinessError?: string | null;
};

type CommandCenterDataWarning = {
  hasInvalidPipelineValues: boolean;
  hasInvalidForecastValues: boolean;
  hasInvalidSupplierValues: boolean;
};

type ChartState = "loading" | "empty" | "error" | "ready";

function isDevelopment() {
  return process.env.NODE_ENV !== "production";
}

function normalizeCommandCenterNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeCommandCenterLabel(value: unknown, fallback: string) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || fallback;
}

export function normalizeCommandCenterData(
  data: CommandCenterData
): CommandCenterData {
  return {
    filters: {
      ...emptyCommandCenterFilters,
      ...data.filters,
    },
    kpis: {
      totalPipelineSavings: normalizeCommandCenterNumber(
        data.kpis.totalPipelineSavings
      ),
      realisedSavings: normalizeCommandCenterNumber(data.kpis.realisedSavings),
      achievedSavings: normalizeCommandCenterNumber(data.kpis.achievedSavings),
      savingsForecast: normalizeCommandCenterNumber(data.kpis.savingsForecast),
      activeProjects: normalizeCommandCenterNumber(data.kpis.activeProjects),
      pendingApprovals: normalizeCommandCenterNumber(data.kpis.pendingApprovals),
    },
    pipelineByPhase: data.pipelineByPhase.map((item) => ({
      phase: normalizeCommandCenterLabel(item.phase, "UNKNOWN"),
      label: normalizeCommandCenterLabel(item.label, "Unknown phase"),
      savings: normalizeCommandCenterNumber(item.savings),
    })),
    forecastCurve: data.forecastCurve.map((item) => ({
      month: normalizeCommandCenterLabel(item.month, "Unknown timing"),
      savings: normalizeCommandCenterNumber(item.savings),
      forecast: normalizeCommandCenterNumber(item.forecast),
    })),
    topSuppliers: data.topSuppliers.map((item) => ({
      supplier: normalizeCommandCenterLabel(item.supplier, "Unknown supplier"),
      savings: normalizeCommandCenterNumber(item.savings),
    })),
    savingsByRiskLevel: data.savingsByRiskLevel.map((item) => ({
      level: normalizeCommandCenterLabel(item.level, "Unrated"),
      savings: normalizeCommandCenterNumber(item.savings),
    })),
    savingsByQualificationStatus: data.savingsByQualificationStatus.map(
      (item) => ({
        status: normalizeCommandCenterLabel(item.status, "Unspecified"),
        savings: normalizeCommandCenterNumber(item.savings),
      })
    ),
  };
}

export function hasMeaningfulCommandCenterData(data: CommandCenterData) {
  return (
    data.kpis.totalPipelineSavings > 0 ||
    data.kpis.realisedSavings > 0 ||
    data.kpis.achievedSavings > 0 ||
    data.kpis.savingsForecast > 0 ||
    data.kpis.activeProjects > 0 ||
    data.kpis.pendingApprovals > 0 ||
    data.pipelineByPhase.some((item) => item.savings > 0) ||
    data.forecastCurve.some((item) => item.savings > 0 || item.forecast > 0) ||
    data.topSuppliers.some((item) => item.savings > 0)
  );
}

function inspectCommandCenterData(
  data: CommandCenterData
): CommandCenterDataWarning {
  return {
    hasInvalidPipelineValues: data.pipelineByPhase.some(
      (item) =>
        typeof item.savings !== "number" || !Number.isFinite(item.savings)
    ),
    hasInvalidForecastValues: data.forecastCurve.some(
      (item) =>
        typeof item.savings !== "number" ||
        !Number.isFinite(item.savings) ||
        typeof item.forecast !== "number" ||
        !Number.isFinite(item.forecast)
    ),
    hasInvalidSupplierValues: data.topSuppliers.some(
      (item) =>
        typeof item.savings !== "number" || !Number.isFinite(item.savings)
    ),
  };
}

function resolveChartState(
  points: ReadonlyArray<Record<string, unknown>>,
  keys: readonly string[]
) {
  const hasData = points.some((point) =>
    keys.some((key) => normalizeCommandCenterNumber(point[key]) > 0)
  );

  return hasData ? ("ready" as const) : ("empty" as const);
}

export function CommandCenterClient({
  initialData,
  filterOptions,
  readiness,
  loadState,
}: {
  initialData: CommandCenterData;
  filterOptions: CommandCenterFilterOptions;
  readiness?: WorkspaceReadiness | null;
  loadState?: CommandCenterClientLoadState;
}) {
  const [data, setData] = useState(() => normalizeCommandCenterData(initialData));
  const [filters, setFilters] = useState<CommandCenterResolvedFilters>(() => ({
    ...emptyCommandCenterFilters,
    ...initialData.filters,
  }));
  const [isLoading, setIsLoading] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const initialRenderRef = useRef(true);

  const dataError = loadState?.dataError?.trim() || null;
  const filterOptionsError = loadState?.filterOptionsError?.trim() || null;
  const readinessError = loadState?.readinessError?.trim() || null;
  const safeData = useMemo(() => normalizeCommandCenterData(data), [data]);
  const hasMeaningfulData = hasMeaningfulCommandCenterData(safeData);
  const hasActiveFilters = Object.values(filters).some(Boolean);
  const debugInfo = inspectCommandCenterData(initialData);
  const showDevWarning =
    isDevelopment() &&
    (debugInfo.hasInvalidPipelineValues ||
      debugInfo.hasInvalidForecastValues ||
      debugInfo.hasInvalidSupplierValues);

  useEffect(() => {
    if (initialRenderRef.current) {
      initialRenderRef.current = false;
      return;
    }

    let ignore = false;

    setIsLoading(true);
    setRefreshError(null);

    fetchCommandCenterData(filters)
      .then((result) => {
        if (!ignore) {
          setData(normalizeCommandCenterData(result));
        }
      })
      .catch((error) => {
        if (!ignore) {
          setRefreshError(
            error instanceof Error
              ? error.message
              : "Command center refresh failed."
          );
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [filters]);

  return (
    <div className="space-y-6">
      {readinessError ? (
        <InlineNotice
          title="Workspace setup status is temporarily unavailable"
          description={readinessError}
        />
      ) : null}
      {filterOptionsError ? (
        <InlineNotice
          title="Command center filters are temporarily unavailable"
          description={filterOptionsError}
        />
      ) : null}
      {refreshError ? (
        <InlineNotice
          title="Command center refresh failed"
          description={refreshError}
          tone="error"
        />
      ) : null}
      {showDevWarning ? (
        <InlineNotice
          title="Development data warning"
          description="Some command center inputs were invalid and were normalized locally so the charts can still render."
        />
      ) : null}
      {isLoading ? (
        <InlineNotice
          title="Updating command center"
          description="Refreshing analytics for the active filters."
        />
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Global Filters</CardTitle>
            <CardDescription>
              Narrow the command center by category, ownership, or supplier.
            </CardDescription>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/50 p-2">
            <Filter className="h-4 w-4 text-[var(--muted-foreground)]" />
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
          <Select
            value={filters.categoryId}
            disabled={Boolean(filterOptionsError)}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                categoryId: event.target.value,
              }))
            }
          >
            <option value="">All categories</option>
            {filterOptions.categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
          <Select
            value={filters.businessUnitId}
            disabled={Boolean(filterOptionsError)}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                businessUnitId: event.target.value,
              }))
            }
          >
            <option value="">All business units</option>
            {filterOptions.businessUnits.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
          <Select
            value={filters.buyerId}
            disabled={Boolean(filterOptionsError)}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                buyerId: event.target.value,
              }))
            }
          >
            <option value="">All buyers</option>
            {filterOptions.buyers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
          <Select
            value={filters.plantId}
            disabled={Boolean(filterOptionsError)}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                plantId: event.target.value,
              }))
            }
          >
            <option value="">All plants</option>
            {filterOptions.plants.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
          <Select
            value={filters.supplierId}
            disabled={Boolean(filterOptionsError)}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                supplierId: event.target.value,
              }))
            }
          >
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
            disabled={!hasActiveFilters}
            onClick={() => setFilters(emptyCommandCenterFilters)}
          >
            Clear filters
          </Button>
        </CardContent>
      </Card>

      {dataError ? (
        <StateCard
          title="Command center charts are unavailable"
          description={dataError}
          action={
            <Link
              href="/command-center"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Refresh command center
            </Link>
          }
        />
      ) : !hasMeaningfulData ? (
        <StateCard
          title={
            hasActiveFilters
              ? "No command-center data matches the current view"
              : "No live command-center data yet"
          }
          description={
            hasActiveFilters
              ? "Clear the active filters to return to the full command-center view."
              : "Create and progress saving cards so the command center has real portfolio data to display."
          }
          action={
            hasActiveFilters ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setFilters(emptyCommandCenterFilters)}
              >
                Clear filters
              </Button>
            ) : (
              <Link
                href="/saving-cards/new"
                className={buttonVariants({ size: "sm" })}
              >
                Create saving card
              </Link>
            )
          }
        />
      ) : (
        <>
          {readiness && !readiness.isWorkspaceReady ? (
            <InlineNotice
              title="Workspace setup is still in progress"
              description="The command center is live, but analytics will become more reliable as setup and card coverage improve."
            />
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              label="Pipeline Savings"
              value={formatCurrency(safeData.kpis.totalPipelineSavings, "EUR")}
              icon={CircleDollarSign}
              status={isLoading ? "Updating" : "Live"}
            />
            <MetricCard
              label="Realised Savings"
              value={formatCurrency(safeData.kpis.realisedSavings, "EUR")}
              icon={TrendingUp}
              status={isLoading ? "Updating" : "Live"}
            />
            <MetricCard
              label="Savings Forecast"
              value={formatCurrency(safeData.kpis.savingsForecast, "EUR")}
              icon={ClipboardList}
              status={isLoading ? "Updating" : "Live"}
            />
            <MetricCard
              label="Achieved Savings"
              value={formatCurrency(safeData.kpis.achievedSavings, "EUR")}
              icon={CheckCircle2}
              status={isLoading ? "Updating" : "Live"}
            />
            <MetricCard
              label="Active Projects"
              value={formatNumber(safeData.kpis.activeProjects)}
              icon={CheckCircle2}
              status={isLoading ? "Updating" : "Live"}
            />
            <MetricCard
              label="Pending Approvals"
              value={formatNumber(safeData.kpis.pendingApprovals)}
              icon={AlertTriangle}
              status={isLoading ? "Updating" : "Live"}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <ChartCard
              title="Savings Pipeline by Phase"
              description="Current savings value by workflow phase."
              status={resolveChartState(safeData.pipelineByPhase, ["savings"])}
              heightClassName="h-80"
              emptyMessage="No pipeline savings are available for the current view."
            >
              <PipelineBarChart data={safeData.pipelineByPhase} />
            </ChartCard>

            <ChartCard
              title="Savings Forecast Over Time"
              description="Current savings and forecast by month."
              status={resolveChartState(safeData.forecastCurve, [
                "savings",
                "forecast",
              ])}
              heightClassName="h-80"
              emptyMessage="No savings forecast data is available for the current view."
            >
              <ForecastAreaPanel data={safeData.forecastCurve.slice(-6)} />
            </ChartCard>
          </div>

          <ChartCard
            title="Top Suppliers by Savings Impact"
            description="Supplier exposure ranked by associated savings value."
            status={resolveChartState(safeData.topSuppliers, ["savings"])}
            heightClassName="h-[420px]"
            emptyMessage="No supplier savings exposure is available for the current view."
          >
            <SupplierBarChart data={safeData.topSuppliers} />
          </ChartCard>
        </>
      )}
    </div>
  );
}

export function buildCommandCenterSearchParams(filters: CommandCenterFilters) {
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
    {
      cache: "no-store",
      credentials: "include",
    }
  );

  const result = (await response.json()) as
    | CommandCenterData
    | CommandCenterApiError;

  if (!response.ok || "error" in result) {
    throw new Error(
      "error" in result ? result.error : "Command center refresh failed."
    );
  }

  return result;
}

function MetricCard({
  label,
  value,
  icon: Icon,
  status,
}: {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
  status: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="rounded-xl bg-[var(--muted)]/70 p-2">
            <Icon className="h-5 w-5 text-[var(--primary)]" />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
            {status}
          </span>
        </div>
        <div className="space-y-1">
          <p className="text-[32px] font-semibold leading-none tracking-tight">
            {value}
          </p>
          <p className="text-[13px] font-medium text-[var(--muted-foreground)]">
            {label}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title,
  description,
  status,
  heightClassName,
  emptyMessage,
  children,
}: {
  title: string;
  description: string;
  status: ChartState;
  heightClassName: string;
  emptyMessage: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className={heightClassName}>
        {status === "loading" ? (
          <ChartStateMessage message="Loading chart..." />
        ) : status === "error" ? (
          <ChartStateMessage message="This chart is unavailable right now." />
        ) : status === "empty" ? (
          <ChartStateMessage message={emptyMessage} />
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

function ChartStateMessage({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--muted)]/30 px-6 text-center text-sm text-[var(--muted-foreground)]">
      {message}
    </div>
  );
}

function PipelineBarChart({
  data,
}: {
  data: CommandCenterData["pipelineByPhase"];
}) {
  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#6B7280", fontSize: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#6B7280", fontSize: 12 }}
            tickFormatter={(value) => formatCurrency(value, "EUR")}
          />
          <Tooltip
            contentStyle={{ borderRadius: 12, borderColor: "#E5E7EB", fontSize: 12 }}
            formatter={(value: number) => [
              formatCurrency(value, "EUR"),
              "Savings",
            ]}
          />
          <Bar dataKey="savings" fill="#2563EB" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ForecastAreaPanel({
  data,
}: {
  data: CommandCenterData["forecastCurve"];
}) {
  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#6B7280", fontSize: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#6B7280", fontSize: 12 }}
            tickFormatter={(value) => formatCurrency(value, "EUR")}
          />
          <Tooltip
            contentStyle={{ borderRadius: 12, borderColor: "#E5E7EB", fontSize: 12 }}
            formatter={(value: number, name: string) => [
              formatCurrency(value, "EUR"),
              name === "forecast" ? "Forecast" : "Savings",
            ]}
          />
          <Area
            type="monotone"
            dataKey="savings"
            name="Savings"
            stroke="#2563EB"
            fill="#93C5FD"
            fillOpacity={0.55}
          />
          <Area
            type="monotone"
            dataKey="forecast"
            name="Forecast"
            stroke="#16A34A"
            fill="#86EFAC"
            fillOpacity={0.35}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function SupplierBarChart({
  data,
}: {
  data: CommandCenterData["topSuppliers"];
}) {
  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 8, bottom: 0, left: 12 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#6B7280", fontSize: 12 }}
            tickFormatter={(value) => formatCurrency(value, "EUR")}
          />
          <YAxis
            type="category"
            dataKey="supplier"
            width={120}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#6B7280", fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{ borderRadius: 12, borderColor: "#E5E7EB", fontSize: 12 }}
            formatter={(value: number) => [
              formatCurrency(value, "EUR"),
              "Savings",
            ]}
          />
          <Bar dataKey="savings" fill="#4F46E5" radius={[0, 8, 8, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function StateCard({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Card className="border-amber-200 bg-amber-50/80">
      <CardHeader>
        <CardTitle className="text-amber-950">{title}</CardTitle>
        <CardDescription className="text-amber-900">
          {description}
        </CardDescription>
      </CardHeader>
      {action ? <CardContent className="pt-0">{action}</CardContent> : null}
    </Card>
  );
}

function InlineNotice({
  title,
  description,
  tone = "warning",
}: {
  title: string;
  description: string;
  tone?: "warning" | "error";
}) {
  const className =
    tone === "error"
      ? "border-rose-200 bg-rose-50/80"
      : "border-amber-200 bg-amber-50/80";
  const titleClass = tone === "error" ? "text-rose-950" : "text-amber-950";
  const descriptionClass =
    tone === "error" ? "text-rose-900" : "text-amber-900";

  return (
    <Card className={className}>
      <CardContent className="space-y-1 py-4">
        <p className={cn("text-sm font-semibold", titleClass)}>{title}</p>
        <p className={cn("text-sm", descriptionClass)}>{description}</p>
      </CardContent>
    </Card>
  );
}
