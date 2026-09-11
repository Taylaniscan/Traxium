import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  MonthlyCloseCardRow,
  MonthlyCloseStatus,
  MonthlyCloseSummary,
} from "@/lib/monthly-close";
import { formatCurrency, formatNumber } from "@/lib/utils/numberFormatter";

type MonthOption = {
  key: string;
  label: string;
  href: string;
  active: boolean;
};

const STATUS_SECTIONS: Array<{
  status: MonthlyCloseStatus;
  title: string;
  description: string;
  emptyMessage: string;
  tone: "amber" | "rose" | "emerald";
}> = [
  {
    status: "missing-actuals",
    title: "Missing actuals",
    description: "No actual quantity has been confirmed for this month yet.",
    emptyMessage: "Every in-window card has actuals for this month.",
    tone: "amber",
  },
  {
    status: "needs-finance-review",
    title: "Needs finance review",
    description: "A phase-change request is waiting on finance approval.",
    emptyMessage: "No cards are waiting on finance review this month.",
    tone: "rose",
  },
  {
    status: "closed",
    title: "Closed",
    description: "Actuals are entered and no finance review is pending.",
    emptyMessage: "No cards are fully closed for this month yet.",
    tone: "emerald",
  },
];

function StatusBadge({ status }: { status: MonthlyCloseStatus }) {
  if (status === "closed") {
    return <Badge tone="emerald">Closed</Badge>;
  }
  if (status === "needs-finance-review") {
    return <Badge tone="rose">Needs review</Badge>;
  }
  return <Badge tone="amber">Missing actuals</Badge>;
}

function CardRow({ row }: { row: MonthlyCloseCardRow }) {
  const variance = row.varianceQty;
  return (
    <Link
      href={`/saving-cards/${row.savingCardId}`}
      className="grid grid-cols-2 gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm transition hover:bg-[var(--muted)]/40 md:grid-cols-[1.4fr_repeat(4,0.7fr)]"
    >
      <div className="col-span-2 flex items-center gap-2 md:col-span-1">
        <StatusBadge status={row.status} />
        <span className="truncate font-medium text-[var(--foreground)]">
          {row.title}
        </span>
      </div>
      <div className="text-[var(--muted-foreground)]">
        <span className="md:hidden">Forecast qty: </span>
        {row.forecastQty === null ? "—" : formatNumber(row.forecastQty)}
      </div>
      <div className="text-[var(--muted-foreground)]">
        <span className="md:hidden">Actual qty: </span>
        {row.actualQty === null ? "—" : formatNumber(row.actualQty)}
      </div>
      <div
        className={
          variance === null
            ? "text-[var(--muted-foreground)]"
            : variance >= 0
              ? "text-[var(--success)]"
              : "text-[var(--risk)]"
        }
      >
        <span className="md:hidden">Variance: </span>
        {variance === null
          ? "—"
          : `${variance > 0 ? "+" : ""}${formatNumber(variance)}`}
      </div>
      <div className="font-medium text-[var(--foreground)]">
        <span className="md:hidden">Month value: </span>
        {formatCurrency(Math.round(row.proratedMonthValueUSD), "USD")}
      </div>
    </Link>
  );
}

export function MonthlyCloseView({
  summary,
  monthOptions,
  loadError,
}: {
  summary: MonthlyCloseSummary;
  monthOptions: MonthOption[];
  loadError?: string | null;
}) {
  const closedPercent =
    summary.totalCards > 0
      ? Math.round((summary.closedCount / summary.totalCards) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {loadError ? (
        <Card className="border-dashed">
          <CardContent className="px-5 py-4 text-sm text-[var(--muted-foreground)]">
            {loadError}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2" aria-label="Select month">
        {monthOptions.map((option) => (
          <Link
            key={option.key}
            href={option.href}
            className={
              option.active
                ? "rounded-full bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-white"
                : "rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition hover:bg-[var(--muted)]"
            }
          >
            {option.label}
          </Link>
        ))}
      </div>

      <Card variant="elevated">
        <CardHeader>
          <CardTitle>{summary.monthLabel} close</CardTitle>
          <CardDescription>
            {summary.closedCount} of {summary.totalCards} cards closed ({closedPercent}%).
            {summary.missingActualsCount > 0
              ? ` ${summary.missingActualsCount} need actuals.`
              : ""}
            {summary.needsFinanceReviewCount > 0
              ? ` ${summary.needsFinanceReviewCount} need finance review.`
              : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <p className="text-xs text-[var(--muted-foreground)]">Cards closed</p>
            <p className="mt-1 text-2xl font-semibold">
              {summary.closedCount}/{summary.totalCards}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <p className="text-xs text-[var(--muted-foreground)]">Forecast savings (USD)</p>
            <p className="mt-1 text-2xl font-semibold">
              {formatCurrency(Math.round(summary.totalForecastSavingsUSD), "USD")}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <p className="text-xs text-[var(--muted-foreground)]">Actual savings (USD)</p>
            <p className="mt-1 text-2xl font-semibold">
              {formatCurrency(Math.round(summary.totalActualSavingsUSD), "USD")}
            </p>
          </div>
        </CardContent>
      </Card>

      {STATUS_SECTIONS.map((section) => {
        const rows = summary.cards.filter((row) => row.status === section.status);
        return (
          <Card key={section.status}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2">
                  {section.title}
                  <Badge tone={section.tone}>{rows.length}</Badge>
                </CardTitle>
              </div>
              <CardDescription>{section.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {rows.length ? (
                rows.map((row) => <CardRow key={row.savingCardId} row={row} />)
              ) : (
                <p className="text-sm text-[var(--muted-foreground)]">
                  {section.emptyMessage}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
