"use client";

import Link from "next/link";
import type { OrganizationRole } from "@prisma/client";
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
  ArrowUpRight,
  CircleDollarSign,
  Target,
  TrendingUp,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { phaseLabels, phases } from "@/lib/constants";
import type {
  DashboardCardSummary,
  DashboardData,
  WorkspaceReadiness,
} from "@/lib/types";
import { formatCurrency } from "@/lib/utils/numberFormatter";

export type DashboardClientLoadState = {
  dataError?: string | null;
  readinessError?: string | null;
};

type DashboardChartDatum = {
  label: string;
  savings: number;
};

type DashboardForecastDatum = {
  month: string;
  savings: number;
  forecast: number;
};

type DashboardProjectRow = {
  title: string;
  category: string;
  phase: string;
  value: number;
};

type DashboardMetrics = {
  pipelineSavings: number;
  realisedSavings: number;
  achievedSavings: number;
  forecastSavings: number;
  byPhase: DashboardChartDatum[];
  byCategory: DashboardChartDatum[];
  monthlyTrend: DashboardForecastDatum[];
  topProjects: DashboardProjectRow[];
};

type DashboardDataWarning = {
  hasInvalidSavings: boolean;
  hasInvalidDates: boolean;
};

type ChartState = "loading" | "empty" | "error" | "ready";

function isDevelopment() {
  return process.env.NODE_ENV !== "production";
}

function normalizeDashboardNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeDashboardLabel(value: unknown, fallback: string) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || fallback;
}

function resolveDashboardMonthBucket(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value ?? ""));

  if (Number.isNaN(date.getTime())) {
    return {
      month: "Unknown timing",
      sortValue: Number.MAX_SAFE_INTEGER,
    };
  }

  return {
    month: new Intl.DateTimeFormat("en-US", {
      month: "short",
      year: "numeric",
    }).format(date),
    sortValue: new Date(date.getFullYear(), date.getMonth(), 1).getTime(),
  };
}

function getForecastFactor(frequency: DashboardCardSummary["frequency"]) {
  switch (frequency) {
    case "ONE_TIME":
      return 1;
    case "MULTI_YEAR":
      return 1.6;
    default:
      return 1.2;
  }
}

function buildSavingsBreakdown(
  cards: DashboardData["cards"],
  getLabel: (card: DashboardCardSummary) => string
) {
  return Object.values(
    cards.reduce<Record<string, DashboardChartDatum>>((acc, card) => {
      const label = normalizeDashboardLabel(getLabel(card), "Unspecified");
      acc[label] ??= {
        label,
        savings: 0,
      };
      acc[label].savings += normalizeDashboardNumber(card.calculatedSavings);
      return acc;
    }, {})
  );
}

export function deriveDashboardMetrics(cards: DashboardData["cards"]): DashboardMetrics {
  const pipelineSavings = cards
    .filter((card) => card.phase !== "CANCELLED")
    .reduce(
      (sum, card) => sum + normalizeDashboardNumber(card.calculatedSavings),
      0
    );
  const realisedSavings = cards
    .filter((card) => card.phase === "REALISED")
    .reduce(
      (sum, card) => sum + normalizeDashboardNumber(card.calculatedSavings),
      0
    );
  const achievedSavings = cards
    .filter((card) => card.phase === "ACHIEVED")
    .reduce(
      (sum, card) => sum + normalizeDashboardNumber(card.calculatedSavings),
      0
    );

  const monthlyTrend = Object.values(
    cards.reduce<
      Record<
        string,
        DashboardForecastDatum & {
          sortValue: number;
        }
      >
    >((acc, card) => {
      const bucket = resolveDashboardMonthBucket(card.impactStartDate);
      const key = `${bucket.sortValue}:${bucket.month}`;
      const savings = normalizeDashboardNumber(card.calculatedSavings);

      acc[key] ??= {
        month: bucket.month,
        savings: 0,
        forecast: 0,
        sortValue: bucket.sortValue,
      };
      acc[key].savings += savings;
      acc[key].forecast += savings * getForecastFactor(card.frequency);
      return acc;
    }, {})
  )
    .sort((left, right) => left.sortValue - right.sortValue)
    .map(({ sortValue, ...item }) => item);

  return {
    pipelineSavings,
    realisedSavings,
    achievedSavings,
    forecastSavings: monthlyTrend.reduce(
      (sum, item) => sum + normalizeDashboardNumber(item.forecast),
      0
    ),
    byPhase: phases.map((phase) => ({
      label:
        phaseLabels[phase] ?? normalizeDashboardLabel(phase, "Unknown phase"),
      savings: cards
        .filter((card) => card.phase === phase)
        .reduce(
          (sum, card) => sum + normalizeDashboardNumber(card.calculatedSavings),
          0
        ),
    })),
    byCategory: buildSavingsBreakdown(
      cards,
      (card) => card.category?.name ?? "Uncategorized"
    )
      .sort((left, right) => right.savings - left.savings)
      .slice(0, 6),
    monthlyTrend: monthlyTrend.slice(-6),
    topProjects: [...cards]
      .sort(
        (left, right) =>
          normalizeDashboardNumber(right.calculatedSavings) -
          normalizeDashboardNumber(left.calculatedSavings)
      )
      .slice(0, 5)
      .map((card) => ({
        title: normalizeDashboardLabel(card.title, "Untitled saving card"),
        category: normalizeDashboardLabel(
          card.category?.name,
          "Uncategorized"
        ),
        phase:
          phaseLabels[card.phase] ??
          normalizeDashboardLabel(card.phase, "Unknown phase"),
        value: normalizeDashboardNumber(card.calculatedSavings),
      })),
  };
}

function inspectDashboardData(cards: DashboardData["cards"]): DashboardDataWarning {
  return {
    hasInvalidSavings: cards.some(
      (card) =>
        typeof card.calculatedSavings !== "number" ||
        !Number.isFinite(card.calculatedSavings)
    ),
    hasInvalidDates: cards.some((card) => {
      if (card.impactStartDate instanceof Date) {
        return Number.isNaN(card.impactStartDate.getTime());
      }

      return Number.isNaN(
        new Date(String(card.impactStartDate ?? "")).getTime()
      );
    }),
  };
}

function resolveChartState(input: {
  error: string | null;
  points: ReadonlyArray<Record<string, unknown>>;
  keys: readonly string[];
}) {
  if (input.error) {
    return "error" as const;
  }

  const hasData = input.points.some((point) =>
    input.keys.some((key) => normalizeDashboardNumber(point[key]) > 0)
  );

  return hasData ? ("ready" as const) : ("empty" as const);
}

export function DashboardClient({
  data,
  readiness,
  viewer: _viewer,
  loadState,
}: {
  data: DashboardData;
  readiness?: WorkspaceReadiness | null;
  viewer: {
    organizationMembershipRole: OrganizationRole;
  };
  loadState?: DashboardClientLoadState;
}) {
  const dataError = loadState?.dataError?.trim() || null;
  const readinessError = loadState?.readinessError?.trim() || null;
  const metrics = deriveDashboardMetrics(data.cards);
  const debugInfo = inspectDashboardData(data.cards);
  const showDevWarning =
    isDevelopment() && (debugInfo.hasInvalidDates || debugInfo.hasInvalidSavings);

  if (dataError) {
    return (
      <div className="space-y-4">
        {readinessError ? (
          <InlineNotice
            title="Workspace setup status is temporarily unavailable"
            description={readinessError}
          />
        ) : null}
        <StateCard
          title="Dashboard charts are unavailable"
          description={dataError}
          action={
            <Link
              href="/dashboard"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Refresh dashboard
            </Link>
          }
        />
      </div>
    );
  }

  if (!data.cards.length) {
    return (
      <div className="space-y-4">
        {readinessError ? (
          <InlineNotice
            title="Workspace setup status is temporarily unavailable"
            description={readinessError}
          />
        ) : null}
        <StateCard
          title="No live saving cards yet."
          description="Create the first saving card to populate the dashboard with real portfolio data."
          action={
            <Link
              href="/saving-cards/new"
              className={buttonVariants({ size: "sm" })}
            >
              Create saving card
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {readinessError ? (
        <InlineNotice
          title="Workspace setup status is temporarily unavailable"
          description={readinessError}
        />
      ) : null}
      {showDevWarning ? (
        <InlineNotice
          title="Development data warning"
          description="Some dashboard inputs were invalid and were normalized locally so the charts can still render."
        />
      ) : null}
      {readiness && !readiness.isWorkspaceReady ? (
        <InlineNotice
          title="Workspace setup is still in progress"
          description="The dashboard is live, but reporting will become more reliable as setup and card coverage improve."
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Pipeline Savings"
          value={formatCurrency(metrics.pipelineSavings, "EUR")}
          icon={CircleDollarSign}
        />
        <MetricCard
          label="Realised Savings"
          value={formatCurrency(metrics.realisedSavings, "EUR")}
          icon={TrendingUp}
        />
        <MetricCard
          label="Achieved Savings"
          value={formatCurrency(metrics.achievedSavings, "EUR")}
          icon={Target}
        />
        <MetricCard
          label="Savings Forecast"
          value={formatCurrency(metrics.forecastSavings, "EUR")}
          icon={ArrowUpRight}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <ChartCard
          title="Savings by Phase"
          description="Current portfolio value by workflow phase."
          status={resolveChartState({
            error: null,
            points: metrics.byPhase,
            keys: ["savings"],
          })}
          heightClassName="h-80"
          emptyMessage="No phase savings are available yet."
        >
          <PhaseBarChart data={metrics.byPhase} />
        </ChartCard>

        <ChartCard
          title="Savings by Category"
          description="Top procurement categories by savings contribution."
          status={resolveChartState({
            error: null,
            points: metrics.byCategory,
            keys: ["savings"],
          })}
          heightClassName="h-80"
          emptyMessage="No category savings are available yet."
        >
          <CategoryBarChart data={metrics.byCategory} />
        </ChartCard>

        <ChartCard
          title="Savings Forecast"
          description="Current savings and forecast by month."
          status={resolveChartState({
            error: null,
            points: metrics.monthlyTrend,
            keys: ["savings", "forecast"],
          })}
          heightClassName="h-80"
          emptyMessage="No savings forecast data is available yet."
        >
          <ForecastAreaChart data={metrics.monthlyTrend} />
        </ChartCard>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top Saving Projects</CardTitle>
          <CardDescription>
            Highest-value saving cards in the current portfolio.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {metrics.topProjects.map((project) => (
            <div
              key={`${project.title}-${project.phase}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {project.title}
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {project.category} · {project.phase}
                </p>
              </div>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {formatCurrency(project.value, "EUR")}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="rounded-xl bg-blue-50 p-2 text-[var(--primary)]">
            <Icon className="h-5 w-5" />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted-foreground)]">
            KPI
          </span>
        </div>
        <div className="space-y-1">
          <p className="text-[32px] font-semibold leading-none tracking-tight text-[var(--foreground)]">
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

function PhaseBarChart({ data }: { data: DashboardChartDatum[] }) {
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

function CategoryBarChart({ data }: { data: DashboardChartDatum[] }) {
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
            dataKey="label"
            width={92}
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
          <Bar dataKey="savings" fill="#0F766E" radius={[0, 8, 8, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ForecastAreaChart({ data }: { data: DashboardForecastDatum[] }) {
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
}: {
  title: string;
  description: string;
}) {
  return (
    <Card className="border-amber-200 bg-amber-50/80">
      <CardContent className="space-y-1 py-4">
        <p className="text-sm font-semibold text-amber-950">{title}</p>
        <p className="text-sm text-amber-900">{description}</p>
      </CardContent>
    </Card>
  );
}
