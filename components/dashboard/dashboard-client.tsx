"use client";

import Link from "next/link";
import type { OrganizationRole } from "@prisma/client";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BadgeCheck,
  CalendarRange,
  CheckCircle2,
  CircleAlert,
  CircleDollarSign,
  Clock4,
  Lightbulb,
  ListChecks,
  ShieldCheck,
  Target,
  TrendingUp,
  Trophy,
  Wrench,
  X,
} from "lucide-react";

import {
  DashboardSection,
  ExceptionList,
  KpiCard,
  MetricDelta,
  type DashboardExceptionItem,
} from "@/components/dashboard/dashboard-primitives";
import { LoadSampleDataButton } from "@/components/onboarding/load-sample-data-button";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getPhaseVisuals } from "@/components/ui/phase-badge";
import { calculateFiscalYearValue } from "@/lib/calculations";
import { phaseLabels, phases } from "@/lib/constants";
import type {
  DashboardCardSummary,
  DashboardData,
  WorkspaceReadiness,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber } from "@/lib/utils/numberFormatter";

// Shared Recharts styling: soft gridlines, token axis text, white-card tooltip.
const CHART_GRID_STROKE = "var(--chart-grid)";
const CHART_AXIS_TICK = { fill: "var(--chart-axis)", fontSize: 12 };
const CHART_TOOLTIP_STYLE = {
  borderRadius: 12,
  borderColor: "var(--chart-grid)",
  backgroundColor: "var(--surface)",
  boxShadow: "var(--shadow-pop)",
  fontSize: 12,
} as const;

export type DashboardClientLoadState = {
  dataError?: string | null;
  readinessError?: string | null;
};

type DashboardChartDatum = {
  label: string;
  savings: number;
  phase?: DashboardCardSummary["phase"];
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
  inYearValue: number;
  annualizedRunRate: number;
  byPhase: DashboardChartDatum[];
  byCategory: DashboardChartDatum[];
  monthlyTrend: DashboardForecastDatum[];
  topProjects: DashboardProjectRow[];
};

type DashboardReportingContext = {
  fiscalYearStartMonth?: number;
  reportingDate?: Date | string;
};

type DashboardDataWarning = {
  hasInvalidSavings: boolean;
  hasInvalidDates: boolean;
};

type DashboardExecutiveMetrics = {
  identifiedValue: number;
  validatedValue: number;
  realisedValue: number;
  achievedValue: number;
  benchmarkValue: number;
  benchmarkLabel: string;
  gapValue: number;
  gapLabel: string;
  varianceValue: number;
  varianceLabel: string;
  achievedShare: number;
  validatedCoverage: number;
  blockedCount: number;
  delayedCount: number;
  awaitingActionCount: number;
  forecastDelta: number;
  exceptions: DashboardExceptionItem[];
};

type ChartState = "loading" | "empty" | "error" | "ready";

const DAY_MS = 24 * 60 * 60 * 1000;
const WELCOME_DISMISSED_STORAGE_KEY = "traxium_welcome_dismissed";

function isDevelopment() {
  return process.env.NODE_ENV !== "production";
}

function normalizeDashboardNumber(value: unknown) {
  // Money/quantity columns arrive as Prisma Decimal; coerce to a finite number.
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
}

function hasMeaningfulDashboardValue(value: unknown) {
  return normalizeDashboardNumber(value) !== 0;
}

function normalizeDashboardLabel(value: unknown, fallback: string) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || fallback;
}

function normalizeDashboardToken(value: unknown) {
  return normalizeDashboardLabel(value, "").toLowerCase();
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

function parseDashboardDate(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfTodayTimestamp(reference = new Date()) {
  return new Date(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate()
  ).getTime();
}

function formatDashboardPercent(value: number) {
  return `${Math.round(value)}%`;
}

function calculateMagnitudeShare(value: number, basis: number) {
  const normalizedBasis = Math.abs(basis);

  if (!normalizedBasis) {
    return 0;
  }

  return (Math.abs(value) / normalizedBasis) * 100;
}

function formatSignedCurrency(value: number) {
  if (value === 0) {
    return formatCurrency(0, "USD");
  }

  return value > 0
    ? `+${formatCurrency(value, "USD")}`
    : `-${formatCurrency(Math.abs(value), "USD")}`;
}

function formatDayDistance(days: number) {
  const absoluteDays = Math.abs(days);
  return `${absoluteDays} day${absoluteDays === 1 ? "" : "s"}`;
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
      acc[label].savings += normalizeDashboardNumber(card.calculatedSavingsUSD);
      return acc;
    }, {})
  );
}

export function deriveDashboardMetrics(
  cards: DashboardData["cards"],
  reporting: DashboardReportingContext = {}
): DashboardMetrics {
  const reportingDate = parseDashboardDate(reporting.reportingDate ?? new Date());
  const fiscalYearStartMonth = reporting.fiscalYearStartMonth ?? 1;
  const pipelineSavings = cards
    .filter((card) => card.phase !== "CANCELLED")
    .reduce(
      (sum, card) => sum + normalizeDashboardNumber(card.calculatedSavingsUSD),
      0
    );
  const realisedSavings = cards
    .filter((card) => card.phase === "REALISED")
    .reduce(
      (sum, card) => sum + normalizeDashboardNumber(card.calculatedSavingsUSD),
      0
    );
  const achievedSavings = cards
    .filter((card) => card.phase === "ACHIEVED")
    .reduce(
      (sum, card) => sum + normalizeDashboardNumber(card.calculatedSavingsUSD),
      0
    );
  const activeCards = cards.filter((card) => card.phase !== "CANCELLED");
  const inYearValue = activeCards.reduce(
    (sum, card) =>
      sum +
      calculateFiscalYearValue({
        annualizedValue: normalizeDashboardNumber(card.annualizedRunRateUSD),
        impactStartDate: parseDashboardDate(card.impactStartDate) ?? new Date(NaN),
        impactEndDate: parseDashboardDate(card.impactEndDate) ?? new Date(NaN),
        fiscalYear: { startMonth: fiscalYearStartMonth },
        reportingDate: reportingDate ?? new Date(NaN),
      }),
    0
  );
  const annualizedRunRate = activeCards.reduce(
    (sum, card) => sum + normalizeDashboardNumber(card.annualizedRunRateUSD),
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
      const savings = normalizeDashboardNumber(card.calculatedSavingsUSD);

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
    inYearValue,
    annualizedRunRate,
    forecastSavings: monthlyTrend.reduce(
      (sum, item) => sum + normalizeDashboardNumber(item.forecast),
      0
    ),
    byPhase: phases.map((phase) => ({
      phase,
      label:
        phaseLabels[phase] ?? normalizeDashboardLabel(phase, "Unknown phase"),
      savings: cards
        .filter((card) => card.phase === phase)
        .reduce(
          (sum, card) => sum + normalizeDashboardNumber(card.calculatedSavingsUSD),
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
          normalizeDashboardNumber(right.calculatedSavingsUSD) -
          normalizeDashboardNumber(left.calculatedSavingsUSD)
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
        value: normalizeDashboardNumber(card.calculatedSavingsUSD),
      })),
  };
}

function inspectDashboardData(cards: DashboardData["cards"]): DashboardDataWarning {
  return {
    hasInvalidSavings: cards.some((card) => {
      const value =
        typeof card.calculatedSavingsUSD === "number"
          ? card.calculatedSavingsUSD
          : Number(card.calculatedSavingsUSD);
      return !Number.isFinite(value);
    }),
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
    input.keys.some((key) => hasMeaningfulDashboardValue(point[key]))
  );

  return hasData ? ("ready" as const) : ("empty" as const);
}

function getPhaseSavings(
  metrics: DashboardMetrics,
  phase: DashboardCardSummary["phase"]
) {
  return (
    metrics.byPhase.find((item) => item.phase === phase)?.savings ?? 0
  );
}

function buildDashboardExceptions(
  cards: DashboardData["cards"]
): DashboardExceptionItem[] {
  const todayTimestamp = startOfTodayTimestamp();

  return cards
    .flatMap((card) => {
      if (card.phase === "ACHIEVED" || card.phase === "CANCELLED") {
        return [];
      }

      const qualificationStatus = normalizeDashboardLabel(
        card.qualificationStatus,
        "Unspecified"
      );
      const qualificationToken = normalizeDashboardToken(card.qualificationStatus);
      const phaseLabel =
        phaseLabels[card.phase] ?? normalizeDashboardLabel(card.phase, "Unknown phase");
      const impactStartDate = parseDashboardDate(card.impactStartDate);
      const impactStartTimestamp = impactStartDate
        ? new Date(
            impactStartDate.getFullYear(),
            impactStartDate.getMonth(),
            impactStartDate.getDate()
          ).getTime()
        : null;
      const daysToImpact =
        impactStartTimestamp === null
          ? null
          : Math.round((impactStartTimestamp - todayTimestamp) / DAY_MS);
      const value = normalizeDashboardNumber(card.calculatedSavingsUSD);
      const meta = `${normalizeDashboardLabel(
        card.buyer?.name,
        "Unassigned buyer"
      )} · ${normalizeDashboardLabel(
        card.businessUnit?.name,
        "Unspecified business unit"
      )}`;

      const isBlocked =
        qualificationToken === "rejected" ||
        qualificationToken === "not started";
      const isDelayed =
        !isBlocked &&
        daysToImpact !== null &&
        daysToImpact < 0 &&
        (card.phase === "IDEA" || card.phase === "VALIDATED");
      const isAwaitingAction =
        !isBlocked &&
        !isDelayed &&
        (qualificationToken === "plant trial" ||
          qualificationToken === "lab testing" ||
          (daysToImpact !== null &&
            daysToImpact >= 0 &&
            daysToImpact <= 30 &&
            (card.phase === "IDEA" || card.phase === "VALIDATED")));

      if (!isBlocked && !isDelayed && !isAwaitingAction) {
        return [];
      }

      const kind = isBlocked
        ? "Blocked"
        : isDelayed
          ? "Delayed"
          : "Awaiting action";
      const tone = isBlocked ? "error" : isDelayed ? "warn" : "teal";
      const detail = isBlocked
        ? qualificationToken === "rejected"
          ? `Qualification status is rejected while the initiative remains in ${phaseLabel}.`
          : `Qualification has not started while the initiative remains in ${phaseLabel}.`
        : isDelayed
          ? `Planned impact started ${formatDayDistance(
              daysToImpact ?? 0
            )} ago, but the initiative remains in ${phaseLabel}.`
          : qualificationToken === "plant trial" ||
              qualificationToken === "lab testing"
            ? `Qualification is in ${qualificationStatus}; additional action is required before value can progress.`
            : `Impact is due in ${formatDayDistance(
                daysToImpact ?? 0
              )}; progress is still required before realization.`;

      return [
        {
          kind,
          tone,
          title: normalizeDashboardLabel(card.title, "Untitled saving card"),
          detail,
          value: formatCurrency(value, "USD"),
          meta,
          phase: card.phase,
          phaseLabel,
          sortPriority: isBlocked ? 0 : isDelayed ? 1 : 2,
          rawValue: Math.abs(value),
        } as DashboardExceptionItem & {
          sortPriority: number;
          rawValue: number;
        },
      ];
    })
    .sort((left, right) => {
      const leftItem = left as DashboardExceptionItem & {
        sortPriority: number;
        rawValue: number;
      };
      const rightItem = right as DashboardExceptionItem & {
        sortPriority: number;
        rawValue: number;
      };

      if (leftItem.sortPriority !== rightItem.sortPriority) {
        return leftItem.sortPriority - rightItem.sortPriority;
      }

      return rightItem.rawValue - leftItem.rawValue;
    })
    .slice(0, 6)
    .map(({ sortPriority: _sortPriority, rawValue: _rawValue, ...item }) => item);
}

function deriveDashboardExecutiveMetrics(input: {
  cards: DashboardData["cards"];
  metrics: DashboardMetrics;
  annualTarget: number;
}): DashboardExecutiveMetrics {
  const identifiedValue = getPhaseSavings(input.metrics, "IDEA");
  const validatedValue = getPhaseSavings(input.metrics, "VALIDATED");
  const realisedValue = getPhaseSavings(input.metrics, "REALISED");
  const achievedValue = getPhaseSavings(input.metrics, "ACHIEVED");
  const benchmarkValue =
    input.annualTarget > 0 ? input.annualTarget : input.metrics.pipelineSavings;
  const benchmarkLabel =
    input.annualTarget > 0 ? "Annual target" : "Active pipeline";
  const gapLabel =
    input.annualTarget > 0 ? "Gap to annual target" : "Value not yet achieved";
  const gapValue = Math.max(benchmarkValue - achievedValue, 0);
  const varianceValue = achievedValue - benchmarkValue;
  const varianceLabel =
    varianceValue >= 0 ? "Above benchmark" : "Below benchmark";
  const achievedShare =
    input.metrics.pipelineSavings !== 0
      ? calculateMagnitudeShare(achievedValue, input.metrics.pipelineSavings)
      : 0;
  const validatedCoverageBasis =
    validatedValue + realisedValue + achievedValue;
  const validatedCoverage =
    input.metrics.pipelineSavings !== 0
      ? calculateMagnitudeShare(
          validatedCoverageBasis,
          input.metrics.pipelineSavings
        )
      : 0;
  const forecastDelta =
    (input.metrics.monthlyTrend.at(-1)?.forecast ?? 0) -
    (input.metrics.monthlyTrend.at(-2)?.forecast ?? 0);
  const exceptions = buildDashboardExceptions(input.cards);

  return {
    identifiedValue,
    validatedValue,
    realisedValue,
    achievedValue,
    benchmarkValue,
    benchmarkLabel,
    gapValue,
    gapLabel,
    varianceValue,
    varianceLabel,
    achievedShare,
    validatedCoverage,
    blockedCount: exceptions.filter((item) => item.kind === "Blocked").length,
    delayedCount: exceptions.filter((item) => item.kind === "Delayed").length,
    awaitingActionCount: exceptions.filter(
      (item) => item.kind === "Awaiting action"
    ).length,
    forecastDelta,
    exceptions,
  };
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
  const metrics = deriveDashboardMetrics(data.cards, {
    fiscalYearStartMonth: data.fiscalYearStartMonth,
    reportingDate: data.reportingDate,
  });
  const debugInfo = inspectDashboardData(data.cards);
  const annualTarget = normalizeDashboardNumber(
    (data as DashboardData & { annualTarget?: unknown }).annualTarget
  );
  const executiveMetrics = deriveDashboardExecutiveMetrics({
    cards: data.cards,
    metrics,
    annualTarget,
  });
  const capturedActuals = data.capturedActuals;
  const capturedActualizedNote =
    capturedActuals && capturedActuals.cardsWithActuals > 0
      ? ` Actual to date: ${formatCurrency(
          Math.round(capturedActuals.actualizedUSD),
          "USD"
        )} across ${capturedActuals.cardsWithActuals} captured card${
          capturedActuals.cardsWithActuals === 1 ? "" : "s"
        } with confirmed actuals.`
      : "";
  const recentAchievements = [...data.cards]
    .filter((card) => {
      if (card.phase !== "ACHIEVED") {
        return false;
      }

      const updatedAt = (card as DashboardCardSummary & {
        updatedAt?: Date | string | null;
      }).updatedAt;

      if (!updatedAt) {
        return false;
      }

      const updatedAtTime = new Date(updatedAt).getTime();
      return (
        Number.isFinite(updatedAtTime) &&
        Date.now() - updatedAtTime <= 24 * 60 * 60 * 1000
      );
    })
    .sort((left, right) => {
      const leftDate = new Date(
        ((left as DashboardCardSummary & {
          updatedAt?: Date | string | null;
        }).updatedAt ?? 0) as string | number | Date
      ).getTime();
      const rightDate = new Date(
        ((right as DashboardCardSummary & {
          updatedAt?: Date | string | null;
        }).updatedAt ?? 0) as string | number | Date
      ).getTime();

      return rightDate - leftDate;
    });
  const showDevWarning =
    isDevelopment() && (debugInfo.hasInvalidDates || debugInfo.hasInvalidSavings);
  const [welcomeDismissed, setWelcomeDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setWelcomeDismissed(
        window.localStorage.getItem(WELCOME_DISMISSED_STORAGE_KEY) === "true"
      );
    } catch {
      setWelcomeDismissed(false);
    }
  }, []);

  const showWelcomeBanner = !data.cards.length && welcomeDismissed === false;

  function dismissWelcomeBanner() {
    try {
      window.localStorage.setItem(WELCOME_DISMISSED_STORAGE_KEY, "true");
    } catch {
      // Ignore storage errors and still hide the banner for this session.
    }

    setWelcomeDismissed(true);
  }

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
        {showWelcomeBanner ? (
          <WelcomeBanner onDismiss={dismissWelcomeBanner} />
        ) : null}
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
    <div className="space-y-8">
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

      <DashboardSection
        title="Executive Overview"
        description="Current value position across the procurement savings lifecycle, from proposed initiatives through captured savings."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Identified Value"
            value={formatCurrency(executiveMetrics.identifiedValue, "USD")}
            description="Opportunities still proposed and not yet finance validated for execution."
            tone="info"
            icon={<Lightbulb />}
            delta={
              <MetricDelta
                label="of active pipeline"
                value={formatDashboardPercent(
                  calculateMagnitudeShare(
                    executiveMetrics.identifiedValue,
                    metrics.pipelineSavings
                  )
                )}
              />
            }
          />
          <KpiCard
            label="Finance Validated Value"
            value={formatCurrency(executiveMetrics.validatedValue, "USD")}
            description="Business cases reviewed for finance trust and positioned for delivery."
            tone="warning"
            icon={<BadgeCheck />}
            delta={
              <MetricDelta
                label="of active pipeline"
                value={formatDashboardPercent(
                  calculateMagnitudeShare(
                    executiveMetrics.validatedValue,
                    metrics.pipelineSavings
                  )
                )}
                tone="neutral"
              />
            }
          />
          <KpiCard
            label="Implemented Value"
            value={formatCurrency(executiveMetrics.realisedValue, "USD")}
            description="Savings currently implemented and expected to convert into captured value."
            tone="implemented"
            icon={<Wrench />}
            delta={
              <MetricDelta
                label="of active pipeline"
                value={formatDashboardPercent(
                  calculateMagnitudeShare(
                    executiveMetrics.realisedValue,
                    metrics.pipelineSavings
                  )
                )}
                tone="caution"
              />
            }
          />
          <KpiCard
            label="Captured Value"
            value={formatCurrency(executiveMetrics.achievedValue, "USD")}
            description={`Estimated savings impact confirmed and no longer dependent on future conversion.${capturedActualizedNote}`}
            tone="success"
            icon={<Trophy />}
            delta={
              <MetricDelta
                label="locked-in share"
                value={formatDashboardPercent(executiveMetrics.achievedShare)}
                tone="positive"
              />
            }
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <KpiCard
            label="In-Year Value"
            value={formatCurrency(Math.round(metrics.inYearValue), "USD")}
            description="Prorated savings landing inside the current workspace fiscal year, based on each card's impact window."
            tone="neutral"
            size="hero"
            icon={<CalendarRange />}
          />
          <KpiCard
            label="Annualized Run-Rate"
            value={formatCurrency(Math.round(metrics.annualizedRunRate), "USD")}
            description="Full-year steady-state value of active savings once impact is fully ramped."
            tone="neutral"
            size="hero"
            icon={<TrendingUp />}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <KpiCard
            label={executiveMetrics.gapLabel}
            value={formatCurrency(executiveMetrics.gapValue, "USD")}
            description={`${executiveMetrics.benchmarkLabel} benchmark: ${formatCurrency(
              executiveMetrics.benchmarkValue,
              "USD"
            )}.`}
            tone="warning"
            size="secondary"
            icon={<Target />}
            delta={
              <MetricDelta
                label={executiveMetrics.varianceLabel}
                value={formatSignedCurrency(executiveMetrics.varianceValue)}
                tone={
                  executiveMetrics.varianceValue >= 0
                    ? "positive"
                    : "caution"
                }
              />
            }
          />
          <KpiCard
            label="Captured Share"
            value={formatDashboardPercent(executiveMetrics.achievedShare)}
            description="Share of active pipeline that is already confirmed and captured."
            tone="success"
            size="secondary"
            icon={<CircleDollarSign />}
          />
          <KpiCard
            label="Finance-Ready Coverage"
            value={formatDashboardPercent(executiveMetrics.validatedCoverage)}
            description="Share of pipeline already finance validated, implemented, or captured."
            tone="info"
            size="secondary"
            icon={<ShieldCheck />}
          />
          <KpiCard
            label="Blocked Initiatives"
            value={formatNumber(executiveMetrics.blockedCount)}
            description="Items with rejected or not-started qualification status that need intervention."
            tone="risk"
            size="secondary"
            icon={<CircleAlert />}
          />
          <KpiCard
            label="Delayed to Impact"
            value={formatNumber(executiveMetrics.delayedCount)}
            description="Initiatives whose impact should already have started but remain upstream."
            tone="warning"
            size="secondary"
            icon={<Clock4 />}
          />
          <KpiCard
            label="Awaiting Action"
            value={formatNumber(executiveMetrics.awaitingActionCount)}
            description="Near-term items needing progression, trial completion, or decisioning."
            tone="neutral"
            size="secondary"
            icon={<ListChecks />}
          />
        </div>

        {recentAchievements.length ? (
          <Card className="border-transparent bg-[var(--success-surface)]">
            <CardContent className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-md bg-[var(--surface)] p-2 text-[var(--success)] shadow-[var(--shadow-card)]">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--success)]">
                    Recent achievement recorded
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[var(--foreground)]">
                    {recentAchievements[0].title} reached Captured in the last
                    24 hours for {recentAchievements[0].buyer.name} at{" "}
                    {formatCurrency(
                      recentAchievements[0].calculatedSavingsUSD,
                      "USD"
                    )}
                    .
                    {recentAchievements.length > 1
                      ? ` ${recentAchievements.length - 1} more initiative${recentAchievements.length - 1 === 1 ? "" : "s"} also moved into Captured.`
                      : ""}
                  </p>
                </div>
              </div>
              <MetricDelta
                label="vs prior forecast bucket"
                value={formatSignedCurrency(executiveMetrics.forecastDelta)}
                tone={
                  executiveMetrics.forecastDelta > 0
                    ? "positive"
                    : executiveMetrics.forecastDelta < 0
                      ? "negative"
                      : "neutral"
                }
              />
            </CardContent>
          </Card>
        ) : null}
      </DashboardSection>

      <DashboardSection
        title="Analytical View"
        description="Phase progression, benchmark attainment, and forecast movement across the live savings portfolio."
      >
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <ChartCard
            title="Savings by Phase"
            description="Savings pipeline from proposed initiative to captured value."
            status={resolveChartState({
              error: null,
              points: metrics.byPhase,
              keys: ["savings"],
            })}
            frameClassName="h-80"
            emptyMessage="No phase savings are available yet."
          >
            <PhaseBarChart data={metrics.byPhase} />
          </ChartCard>

          <TargetProgressCard
            benchmarkLabel={executiveMetrics.benchmarkLabel}
            benchmarkValue={executiveMetrics.benchmarkValue}
            gapLabel={executiveMetrics.gapLabel}
            gapValue={executiveMetrics.gapValue}
            realisedValue={executiveMetrics.realisedValue}
            achievedValue={executiveMetrics.achievedValue}
            forecastValue={metrics.forecastSavings}
            forecastDelta={executiveMetrics.forecastDelta}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <ChartCard
            title="Savings Forecast"
            description="Movement between current implemented value and forecasted savings by month."
            status={resolveChartState({
              error: null,
              points: metrics.monthlyTrend,
              keys: ["savings", "forecast"],
            })}
            frameClassName="h-80"
            emptyMessage="No savings forecast data is available yet."
          >
            <ForecastAreaChart data={metrics.monthlyTrend} />
          </ChartCard>

          <ChartCard
            title="Savings by Category"
            description="Current value concentration across the highest-impact procurement categories."
            status={resolveChartState({
              error: null,
              points: metrics.byCategory,
              keys: ["savings"],
            })}
            frameClassName="h-80"
            emptyMessage="No category savings are available yet."
          >
            <CategoryBarChart data={metrics.byCategory} />
          </ChartCard>
        </div>
      </DashboardSection>

      <DashboardSection
        title="Exceptions Requiring Attention"
        description="Blocked, delayed, or near-term initiatives that deserve executive procurement-finance focus."
      >
        <ExceptionList
          title="Executive Exceptions"
          description="Prioritized issues across qualification, timing, and execution readiness."
          items={executiveMetrics.exceptions}
          emptyTitle="No material exceptions require attention right now"
          emptyDescription="The active portfolio does not currently show blocked, delayed, or near-term issues that need escalation."
        />
      </DashboardSection>
    </div>
  );
}

function WelcomeBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <Card className="relative">
      <button
        type="button"
        onClick={onDismiss}
        className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted-foreground)] transition hover:bg-[var(--muted)]"
        aria-label="Dismiss welcome banner"
      >
        <X className="h-4 w-4" />
      </button>
      <CardHeader>
        <CardTitle>Welcome to Traxium 👋</CardTitle>
        <CardDescription>
          Add your first savings initiative, load sample data, or invite your team.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3">
          <Link href="/saving-cards/new" className={buttonVariants({ size: "sm" })}>
            Add first initiative
          </Link>
          <LoadSampleDataButton size="sm">Load sample data</LoadSampleDataButton>
          <Link
            href="/admin/members"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Invite team
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function TargetProgressCard({
  benchmarkLabel,
  benchmarkValue,
  gapLabel,
  gapValue,
  realisedValue,
  achievedValue,
  forecastValue,
  forecastDelta,
}: {
  benchmarkLabel: string;
  benchmarkValue: number;
  gapLabel: string;
  gapValue: number;
  realisedValue: number;
  achievedValue: number;
  forecastValue: number;
  forecastDelta: number;
}) {
  const scaleValue = Math.max(
    Math.abs(benchmarkValue),
    Math.abs(realisedValue),
    Math.abs(achievedValue),
    Math.abs(forecastValue),
    1
  );
  const realisedWidth = Math.min((Math.abs(realisedValue) / scaleValue) * 100, 100);
  const achievedWidth = Math.min((Math.abs(achievedValue) / scaleValue) * 100, 100);
  const forecastWidth = Math.min((Math.abs(forecastValue) / scaleValue) * 100, 100);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Target vs Captured</CardTitle>
        <CardDescription>
          Benchmark attainment relative to current implemented, captured, and
          forecasted value.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2">
          <ValueSnapshot
            label={benchmarkLabel}
            value={formatCurrency(benchmarkValue, "USD")}
          />
          <ValueSnapshot
            label={gapLabel}
            value={formatCurrency(gapValue, "USD")}
          />
        </div>

        <ProgressRow
          label="Implemented"
          value={formatCurrency(realisedValue, "USD")}
          width={realisedWidth}
          toneClassName="bg-[var(--warning)]"
        />
        <ProgressRow
          label="Captured"
          value={formatCurrency(achievedValue, "USD")}
          width={achievedWidth}
          toneClassName="bg-[var(--success)]"
        />
        <ProgressRow
          label="Forecast"
          value={formatCurrency(forecastValue, "USD")}
          width={forecastWidth}
          toneClassName="bg-[var(--info-forecast)]"
        />

        <div className="flex flex-wrap gap-2">
          <MetricDelta
            label={gapLabel}
            value={formatCurrency(gapValue, "USD")}
            tone={gapValue > 0 ? "caution" : "positive"}
          />
          <MetricDelta
            label="vs prior forecast bucket"
            value={formatSignedCurrency(forecastDelta)}
            tone={
              forecastDelta > 0
                ? "positive"
                : forecastDelta < 0
                  ? "negative"
                  : "neutral"
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}

function ValueSnapshot({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold tracking-[-0.02em] text-[var(--foreground)]">
        {value}
      </p>
    </div>
  );
}

function ProgressRow({
  label,
  value,
  width,
  toneClassName,
}: {
  label: string;
  value: string;
  width: number;
  toneClassName: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[var(--foreground)]">{label}</p>
        <p className="text-sm font-semibold text-[var(--foreground)]">{value}</p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--muted)]">
        <div
          className={cn("h-full rounded-full", toneClassName)}
          style={{ width: `${Math.max(width, 0)}%` }}
        />
      </div>
    </div>
  );
}

function ChartCard({
  title,
  description,
  status,
  frameClassName,
  emptyMessage,
  children,
}: {
  title: string;
  description: string;
  status: ChartState;
  frameClassName: string;
  emptyMessage: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          data-dashboard-chart-frame={title}
          className={cn("h-80 w-full min-h-[20rem] min-w-0", frameClassName)}
        >
          {status === "loading" ? (
            <ChartStateMessage message="Loading chart..." />
          ) : status === "error" ? (
            <ChartStateMessage message="This chart is unavailable right now." />
          ) : status === "empty" ? (
            <ChartStateMessage message={emptyMessage} />
          ) : (
            children
          )}
        </div>
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
    <div className="h-full w-full min-h-0 min-w-0">
      <ResponsiveContainer
        width="100%"
        height="100%"
        initialDimension={{ width: 640, height: 320 }}
      >
        <BarChart data={data}>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke={CHART_GRID_STROKE}
          />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={CHART_AXIS_TICK}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={CHART_AXIS_TICK}
            tickFormatter={(value) => formatCurrency(value, "USD")}
          />
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
            formatter={(value) => [
              formatCurrency(Number(value ?? 0), "USD"),
              "Savings",
            ]}
          />
          <Bar dataKey="savings" radius={[8, 8, 0, 0]}>
            {data.map((item) => (
              <Cell
                key={item.phase ?? item.label}
                fill={
                  item.phase
                    ? getPhaseVisuals(item.phase).chartColor
                    : "var(--primary-action)"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CategoryBarChart({ data }: { data: DashboardChartDatum[] }) {
  return (
    <div className="h-full w-full min-h-0 min-w-0">
      <ResponsiveContainer
        width="100%"
        height="100%"
        initialDimension={{ width: 640, height: 320 }}
      >
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 8, bottom: 0, left: 12 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            horizontal={false}
            stroke={CHART_GRID_STROKE}
          />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            tick={CHART_AXIS_TICK}
            tickFormatter={(value) => formatCurrency(value, "USD")}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={92}
            tickLine={false}
            axisLine={false}
            tick={CHART_AXIS_TICK}
          />
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
            formatter={(value) => [
              formatCurrency(Number(value ?? 0), "USD"),
              "Savings",
            ]}
          />
          <Bar dataKey="savings" fill="var(--primary-action)" radius={[0, 8, 8, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ForecastAreaChart({ data }: { data: DashboardForecastDatum[] }) {
  return (
    <div className="h-full w-full min-h-0 min-w-0">
      <ResponsiveContainer
        width="100%"
        height="100%"
        initialDimension={{ width: 640, height: 320 }}
      >
        <AreaChart data={data}>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke={CHART_GRID_STROKE}
          />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tick={CHART_AXIS_TICK}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={CHART_AXIS_TICK}
            tickFormatter={(value) => formatCurrency(value, "USD")}
          />
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
            formatter={(value, name) => [
              formatCurrency(Number(value ?? 0), "USD"),
              String(name) === "forecast" ? "Forecast" : "Savings",
            ]}
          />
          <Area
            type="monotone"
            dataKey="savings"
            name="Savings"
            stroke="var(--phase-captured)"
            fill="var(--phase-captured-soft)"
            fillOpacity={0.5}
          />
          <Area
            type="monotone"
            dataKey="forecast"
            name="Forecast"
            stroke="var(--primary-action)"
            fill="var(--chart-forecast)"
            fillOpacity={0.45}
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
