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
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CheckCircle2, X } from "lucide-react";

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
import { phaseLabels, phases } from "@/lib/constants";
import type {
  DashboardCardSummary,
  DashboardData,
  WorkspaceReadiness,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber } from "@/lib/utils/numberFormatter";

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
  byPhase: DashboardChartDatum[];
  byCategory: DashboardChartDatum[];
  monthlyTrend: DashboardForecastDatum[];
  topProjects: DashboardProjectRow[];
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
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
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
    return formatCurrency(0, "EUR");
  }

  return value > 0
    ? `+${formatCurrency(value, "EUR")}`
    : `-${formatCurrency(Math.abs(value), "EUR")}`;
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
      phase,
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
      const value = normalizeDashboardNumber(card.calculatedSavings);
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
          value: formatCurrency(value, "EUR"),
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
  const metrics = deriveDashboardMetrics(data.cards);
  const debugInfo = inspectDashboardData(data.cards);
  const annualTarget = normalizeDashboardNumber(
    (data as DashboardData & { annualTarget?: unknown }).annualTarget
  );
  const executiveMetrics = deriveDashboardExecutiveMetrics({
    cards: data.cards,
    metrics,
    annualTarget,
  });
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
        description="Current value position across the procurement savings lifecycle, from early identification through locked-in achievement."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Identified Value"
            value={formatCurrency(executiveMetrics.identifiedValue, "EUR")}
            description="Opportunities still in idea formation and not yet validated for execution."
            tone="neutral"
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
            label="Validated Value"
            value={formatCurrency(executiveMetrics.validatedValue, "EUR")}
            description="Business cases that have moved beyond identification and are positioned for delivery."
            tone="info"
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
            label="Realised Value"
            value={formatCurrency(executiveMetrics.realisedValue, "EUR")}
            description="Savings currently in delivery and expected to convert into achieved value."
            tone="warning"
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
            label="Achieved Value"
            value={formatCurrency(executiveMetrics.achievedValue, "EUR")}
            description="Locked-in savings already captured and no longer dependent on future conversion."
            tone="success"
            delta={
              <MetricDelta
                label="locked-in share"
                value={formatDashboardPercent(executiveMetrics.achievedShare)}
                tone="positive"
              />
            }
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <KpiCard
            label={executiveMetrics.gapLabel}
            value={formatCurrency(executiveMetrics.gapValue, "EUR")}
            description={`${executiveMetrics.benchmarkLabel} benchmark: ${formatCurrency(
              executiveMetrics.benchmarkValue,
              "EUR"
            )}.`}
            tone="warning"
            size="secondary"
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
            label="Achieved Share"
            value={formatDashboardPercent(executiveMetrics.achievedShare)}
            description="Share of active pipeline that is already locked in and fully achieved."
            tone="success"
            size="secondary"
          />
          <KpiCard
            label="Validated+ Coverage"
            value={formatDashboardPercent(executiveMetrics.validatedCoverage)}
            description="Share of pipeline already in validated, realised, or achieved status."
            tone="info"
            size="secondary"
          />
          <KpiCard
            label="Blocked Initiatives"
            value={formatNumber(executiveMetrics.blockedCount)}
            description="Items with rejected or not-started qualification status that need intervention."
            tone="risk"
            size="secondary"
          />
          <KpiCard
            label="Delayed to Impact"
            value={formatNumber(executiveMetrics.delayedCount)}
            description="Initiatives whose impact should already have started but remain upstream."
            tone="warning"
            size="secondary"
          />
          <KpiCard
            label="Awaiting Action"
            value={formatNumber(executiveMetrics.awaitingActionCount)}
            description="Near-term items needing progression, trial completion, or decisioning."
            tone="neutral"
            size="secondary"
          />
        </div>

        {recentAchievements.length ? (
          <Card className="border-[rgba(31,107,77,0.18)] bg-[var(--success-surface)]/78">
            <CardContent className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-md bg-[rgba(31,107,77,0.12)] p-2 text-[var(--success)]">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--success)]">
                    Recent achievement recorded
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[var(--foreground)]">
                    {recentAchievements[0].title} reached Achieved in the last
                    24 hours for {recentAchievements[0].buyer.name} at{" "}
                    {formatCurrency(
                      recentAchievements[0].calculatedSavings,
                      "EUR"
                    )}
                    .
                    {recentAchievements.length > 1
                      ? ` ${recentAchievements.length - 1} more initiative${recentAchievements.length - 1 === 1 ? "" : "s"} also moved into Achieved.`
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
            description="Realization pipeline from identified opportunity to achieved value."
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
            description="Movement between current realised value and forecasted savings by month."
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
        <CardTitle>Target vs Achieved</CardTitle>
        <CardDescription>
          Benchmark attainment relative to current realised, achieved, and
          forecasted value.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2">
          <ValueSnapshot
            label={benchmarkLabel}
            value={formatCurrency(benchmarkValue, "EUR")}
          />
          <ValueSnapshot
            label={gapLabel}
            value={formatCurrency(gapValue, "EUR")}
          />
        </div>

        <ProgressRow
          label="Realised"
          value={formatCurrency(realisedValue, "EUR")}
          width={realisedWidth}
          toneClassName="bg-[var(--warning)]"
        />
        <ProgressRow
          label="Achieved"
          value={formatCurrency(achievedValue, "EUR")}
          width={achievedWidth}
          toneClassName="bg-[var(--success)]"
        />
        <ProgressRow
          label="Forecast"
          value={formatCurrency(forecastValue, "EUR")}
          width={forecastWidth}
          toneClassName="bg-[var(--info-forecast)]"
        />

        <div className="flex flex-wrap gap-2">
          <MetricDelta
            label={gapLabel}
            value={formatCurrency(gapValue, "EUR")}
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
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="#E5E7EB"
          />
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
            contentStyle={{
              borderRadius: 12,
              borderColor: "#E5E7EB",
              fontSize: 12,
            }}
            formatter={(value: number) => [
              formatCurrency(value, "EUR"),
              "Savings",
            ]}
          />
          <Bar dataKey="savings" fill="#355d7a" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CategoryBarChart({ data }: { data: DashboardChartDatum[] }) {
  return (
    <div className="h-full w-full min-h-0 min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 8, bottom: 0, left: 12 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            horizontal={false}
            stroke="#E5E7EB"
          />
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
            contentStyle={{
              borderRadius: 12,
              borderColor: "#E5E7EB",
              fontSize: 12,
            }}
            formatter={(value: number) => [
              formatCurrency(value, "EUR"),
              "Savings",
            ]}
          />
          <Bar dataKey="savings" fill="#475467" radius={[0, 8, 8, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ForecastAreaChart({ data }: { data: DashboardForecastDatum[] }) {
  return (
    <div className="h-full w-full min-h-0 min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="#E5E7EB"
          />
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
            contentStyle={{
              borderRadius: 12,
              borderColor: "#E5E7EB",
              fontSize: 12,
            }}
            formatter={(value: number, name: string) => [
              formatCurrency(value, "EUR"),
              name === "forecast" ? "Forecast" : "Savings",
            ]}
          />
          <Area
            type="monotone"
            dataKey="savings"
            name="Savings"
            stroke="#8b5e15"
            fill="#ead5a5"
            fillOpacity={0.5}
          />
          <Area
            type="monotone"
            dataKey="forecast"
            name="Forecast"
            stroke="#355d7a"
            fill="#bfd4e1"
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
