export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

import { MonthlyCloseView } from "@/components/monthly-close/monthly-close-view";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireUser } from "@/lib/auth";
import {
  assembleMonthlyClose,
  lastCompletedMonthStart,
  monthKey,
  monthLabel,
  monthStartUtc,
  parseMonthKey,
} from "@/lib/monthly-close";
import { getMonthlyCloseSummary } from "@/lib/monthly-close-data";
import { captureException } from "@/lib/observability";
import { hasPermission } from "@/lib/permissions";

function buildRecentMonthOptions(selectedMonthStart: Date) {
  const now = new Date();
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const selectedKey = monthKey(selectedMonthStart);
  const options: Array<{ key: string; label: string; href: string; active: boolean }> = [];

  for (let index = 0; index < 12; index += 1) {
    const monthStart = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() - index, 1)
    );
    const key = monthKey(monthStart);
    options.push({
      key,
      label: monthLabel(monthStart),
      href: `/monthly-close?month=${key}`,
      active: key === selectedKey,
    });
  }

  if (!options.some((option) => option.active)) {
    options.unshift({
      key: selectedKey,
      label: monthLabel(selectedMonthStart),
      href: `/monthly-close?month=${selectedKey}`,
      active: true,
    });
  }

  return options;
}

export default async function MonthlyClosePage({
  searchParams,
}: {
  searchParams?: Promise<{ month?: string | string[] }>;
}) {
  const user = await requireUser();

  if (!hasPermission(user.role, "viewReports")) {
    redirect("/dashboard");
  }

  const resolved = (await searchParams) ?? {};
  const rawMonth = Array.isArray(resolved.month) ? resolved.month[0] : resolved.month;
  const selectedMonthStart = monthStartUtc(
    parseMonthKey(rawMonth) ?? lastCompletedMonthStart()
  );

  let summary;
  let loadError: string | null = null;
  try {
    summary = await getMonthlyCloseSummary(user.organizationId, selectedMonthStart);
  } catch (error) {
    captureException(error, {
      event: "monthly_close.page.load_failed",
      route: "/monthly-close",
      organizationId: user.organizationId,
      userId: user.id,
      payload: {
        resource: "monthly_close_summary",
        degradedRender: true,
        month: monthKey(selectedMonthStart),
      },
    });
    summary = assembleMonthlyClose({
      monthStart: selectedMonthStart,
      cards: [],
      forecastsByCard: new Map(),
      actualsByCard: new Map(),
      pendingRequestCardIds: new Set(),
    });
    loadError =
      "Monthly close could not be loaded right now. Refresh the page or try again in a moment.";
  }

  const monthOptions = buildRecentMonthOptions(selectedMonthStart);

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Monthly Close"
        subtitle="Close the month: confirm actuals, clear finance reviews, and reconcile forecast against actual savings."
        action={
          <a
            href="/reports"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--muted)]"
          >
            Back to Reports
          </a>
        }
      />
      <MonthlyCloseView
        summary={summary}
        monthOptions={monthOptions}
        loadError={loadError}
      />
    </div>
  );
}
