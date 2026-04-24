import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CommandCenterData, DashboardData } from "@/lib/types";
import { formatCurrency, formatPlainNumber } from "@/lib/utils/numberFormatter";
import type { ReactNode } from "react";

type ExecutiveSavingsSummaryProps = {
  commandCenterData: CommandCenterData;
  dashboardData: DashboardData;
  loadState?: {
    commandCenterError?: string | null;
    dashboardError?: string | null;
  };
};

type DashboardDataWithAnnualTarget = DashboardData & {
  annualTarget?: number;
};

const INLINE_LINK_CLASS =
  "text-sm font-medium text-[var(--foreground)] underline decoration-[rgba(23,33,43,0.18)] underline-offset-4 transition hover:text-[var(--primary)]";

export function ExecutiveSavingsSummary({
  commandCenterData,
  dashboardData,
  loadState,
}: ExecutiveSavingsSummaryProps) {
  const commandCenterError = loadState?.commandCenterError?.trim() || null;
  const dashboardError = loadState?.dashboardError?.trim() || null;
  const pendingApprovalQueue = commandCenterData.pendingApprovalQueue ?? [];
  const overdueItems = commandCenterData.overdueItems ?? [];
  const financeLockedItems = commandCenterData.financeLockedItems ?? [];
  const recentDecisions = commandCenterData.recentDecisions ?? [];
  const annualTarget = normalizeMetricValue(
    (dashboardData as DashboardDataWithAnnualTarget).annualTarget
  );
  const portfolioScope = Array.isArray(dashboardData.cards)
    ? dashboardData.cards.length
    : 0;
  const pipelineSavings = normalizeMetricValue(
    commandCenterData.kpis.totalPipelineSavings
  );
  const realisedSavings = normalizeMetricValue(
    commandCenterData.kpis.realisedSavings
  );
  const achievedSavings = normalizeMetricValue(
    commandCenterData.kpis.achievedSavings
  );
  const forecastSavings = normalizeMetricValue(
    commandCenterData.kpis.savingsForecast
  );
  const pendingApprovals = normalizeMetricValue(
    commandCenterData.kpis.pendingApprovals
  );
  const delayedInitiatives = overdueItems.length;
  const financeLockedCount = financeLockedItems.length;
  const deliveryCoverage =
    pipelineSavings > 0
      ? ((realisedSavings + achievedSavings) / pipelineSavings) * 100
      : 0;
  const achievedCoverage =
    pipelineSavings > 0 ? (achievedSavings / pipelineSavings) * 100 : 0;
  const forecastDelta =
    annualTarget > 0
      ? forecastSavings - annualTarget
      : forecastSavings - achievedSavings;
  const forecastComparisonLabel =
    annualTarget > 0 ? "annual target" : "achieved value";
  const noticeMessages = [commandCenterError, dashboardError].filter(
    (message): message is string => Boolean(message)
  );
  const hasMeaningfulData =
    pipelineSavings > 0 ||
    realisedSavings > 0 ||
    achievedSavings > 0 ||
    forecastSavings > 0 ||
    pendingApprovals > 0 ||
    delayedInitiatives > 0 ||
    financeLockedCount > 0 ||
    recentDecisions.length > 0 ||
    portfolioScope > 0;

  if (!hasMeaningfulData) {
    return (
      <div className="space-y-4">
        {commandCenterError || dashboardError ? (
          <ExecutiveSummaryNotice
            title="Executive summary is partially unavailable"
            messages={noticeMessages}
          />
        ) : null}
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>No executive savings data is available yet</CardTitle>
            <CardDescription>
              Create the first saving cards or load sample data to populate the
              executive summary with pipeline, achieved value, approvals, and
              recent decisions.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-4 text-sm text-[var(--muted-foreground)]">
            <a href="/saving-cards/new" className={INLINE_LINK_CLASS}>
              Create saving card
            </a>
            <a href="/dashboard" className={INLINE_LINK_CLASS}>
              Open dashboard
            </a>
            <a href="/command-center" className={INLINE_LINK_CLASS}>
              Open command center
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {commandCenterError || dashboardError ? (
        <ExecutiveSummaryNotice
          title="Executive summary is partially unavailable"
          messages={noticeMessages}
        />
      ) : null}

      <Card variant="elevated">
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle>Executive Savings Summary</CardTitle>
              <CardDescription>
                A concise financial view of conversion, delivery, forecast, and
                workflow risk across the live savings portfolio.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">
                {formatPlainNumber(portfolioScope)} live initiatives
              </Badge>
              {annualTarget > 0 ? (
                <Badge tone="teal">
                  Annual target {formatCurrency(annualTarget, "EUR")}
                </Badge>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-4">
            <ExecutiveMetric
              label="Pipeline Savings"
              value={formatCurrency(pipelineSavings, "EUR")}
              detail={`${formatPlainNumber(portfolioScope)} initiatives currently in scope`}
            />
            <ExecutiveMetric
              label="Realised Savings"
              value={formatCurrency(realisedSavings, "EUR")}
              detail={`${formatPercent(deliveryCoverage)} of pipeline has moved into realised or achieved delivery`}
            />
            <ExecutiveMetric
              label="Achieved Savings"
              value={formatCurrency(achievedSavings, "EUR")}
              detail={`${formatPercent(achievedCoverage)} of pipeline is fully locked in`}
            />
            <ExecutiveMetric
              label="Forecast"
              value={formatCurrency(forecastSavings, "EUR")}
              detail={`${formatSignedCurrency(forecastDelta)} versus ${forecastComparisonLabel}`}
            />
          </div>

          <div className="grid gap-3 border-t border-[var(--border)] pt-5 lg:grid-cols-4">
            <SignalMetric
              label="Pending Approvals"
              value={formatPlainNumber(pendingApprovals)}
              detail={
                pendingApprovalQueue[0]
                  ? `Oldest request: ${pendingApprovalQueue[0].savingCardTitle} (${formatPlainNumber(pendingApprovalQueue[0].ageDays)}d waiting)`
                  : "No approvals are currently waiting in workflow."
              }
            />
            <SignalMetric
              label="Delayed Initiatives"
              value={formatPlainNumber(delayedInitiatives)}
              detail={
                overdueItems[0]
                  ? `Most delayed: ${overdueItems[0].title} (${formatPlainNumber(overdueItems[0].ageDays)}d overdue)`
                  : "No initiatives are currently past due."
              }
            />
            <SignalMetric
              label="Finance Locked"
              value={formatPlainNumber(financeLockedCount)}
              detail={
                financeLockedItems[0]
                  ? `${financeLockedItems[0].title} remains finance controlled`
                  : "No live initiatives are finance locked."
              }
            />
            <SignalMetric
              label="Current Outlook"
              value={formatSignedCurrency(forecastDelta)}
              detail={
                annualTarget > 0
                  ? "Forecast compared with the current annual target"
                  : "Forecast compared with achieved value"
              }
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Executive Outlook</CardTitle>
            <CardDescription>
              Immediate finance and leadership readouts from the current
              portfolio position.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <OutlookLine>
              {formatCurrency(pipelineSavings, "EUR")} sits in the active
              savings pipeline across {formatPlainNumber(portfolioScope)} live
              initiatives.
            </OutlookLine>
            <OutlookLine>
              {formatPercent(deliveryCoverage)} of pipeline value has already
              progressed into realised or achieved delivery.
            </OutlookLine>
            <OutlookLine>
              {formatPlainNumber(pendingApprovals)} approvals are still pending
              and {formatPlainNumber(delayedInitiatives)} initiatives are
              currently delayed.
            </OutlookLine>
            {annualTarget > 0 ? (
              <OutlookLine>
                Forecast is {formatSignedCurrency(forecastSavings - annualTarget)}{" "}
                against the current annual target of{" "}
                {formatCurrency(annualTarget, "EUR")}.
              </OutlookLine>
            ) : (
              <OutlookLine>
                Forecast stands at {formatCurrency(forecastSavings, "EUR")} and
                is {formatSignedCurrency(forecastSavings - achievedSavings)}{" "}
                against achieved value.
              </OutlookLine>
            )}
            <div className="flex flex-wrap gap-4 pt-2 text-sm text-[var(--muted-foreground)]">
              <a href="/dashboard" className={INLINE_LINK_CLASS}>
                Open dashboard
              </a>
              <a href="/command-center" className={INLINE_LINK_CLASS}>
                Review action queue
              </a>
              <a href="/open-actions" className={INLINE_LINK_CLASS}>
                View pending approvals
              </a>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Wins & Decisions</CardTitle>
            <CardDescription>
              The latest approval outcomes and workflow decisions recorded in
              the portfolio.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentDecisions.length ? (
              recentDecisions.slice(0, 4).map((decision) => (
                <div
                  key={decision.approvalId}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-[var(--foreground)]">
                        {decision.savingCardTitle}
                      </div>
                      <div className="text-sm text-[var(--muted-foreground)]">
                        {decision.phase} reviewed by {decision.approverName}
                      </div>
                    </div>
                    <Badge tone={decision.approved ? "success" : "rose"}>
                      {decision.approved ? "Approved" : "Rejected"}
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--muted-foreground)]">
                    <span>{decision.approverRole}</span>
                    <span>{formatDateLabel(decision.createdAt)}</span>
                  </div>
                  {decision.comment ? (
                    <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                      {decision.comment}
                    </p>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-6 text-sm text-[var(--muted-foreground)]">
                No recent decisions are available yet. Approval outcomes will
                appear here once reviewers act on live initiatives.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ExecutiveSummaryNotice({
  title,
  messages,
}: {
  title: string;
  messages: string[];
}) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          Some inputs could not be loaded. The surface remains available with
          the data that did load successfully.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {messages.map((message) => (
          <div
            key={message}
            className="rounded-lg bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted-foreground)]"
          >
            {message}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ExecutiveMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
      <div className="text-sm font-medium text-[var(--muted-foreground)]">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">
        {value}
      </div>
      <div className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
        {detail}
      </div>
    </div>
  );
}

function SignalMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="space-y-1 rounded-lg bg-[var(--surface)] px-4 py-3">
      <div className="text-sm font-medium text-[var(--muted-foreground)]">
        {label}
      </div>
      <div className="text-xl font-semibold tracking-[-0.02em] text-[var(--foreground)]">
        {value}
      </div>
      <div className="text-sm leading-6 text-[var(--muted-foreground)]">
        {detail}
      </div>
    </div>
  );
}

function OutlookLine({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg bg-[var(--surface)] px-4 py-3 text-sm leading-6 text-[var(--foreground)]">
      {children}
    </div>
  );
}

function normalizeMetricValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) {
    return "0%";
  }

  return `${Math.round(value)}%`;
}

function formatSignedCurrency(value: number) {
  if (!Number.isFinite(value) || value === 0) {
    return formatCurrency(0, "EUR");
  }

  return value > 0
    ? `+${formatCurrency(value, "EUR")}`
    : `-${formatCurrency(Math.abs(value), "EUR")}`;
}

function formatDateLabel(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
