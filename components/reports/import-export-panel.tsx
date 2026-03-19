"use client";

import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { WorkspaceReadiness } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ImportExportPanel({
  readiness,
}: {
  readiness?: WorkspaceReadiness | null;
}) {
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const liveCardCount = readiness?.counts.savingCards ?? 0;
  const configuredCollections = readiness?.masterData.filter((item) => item.ready).length ?? 0;
  const workflowCoverageReady = readiness?.workflowCoverage.filter((item) => item.ready).length ?? 0;
  const showRampUpState =
    !!readiness && (liveCardCount < 3 || !readiness.isWorkspaceReady);
  const nextActions = buildReportingNextActions(readiness);

  async function handleImport(formData: FormData) {
    const response = await fetch("/api/import", {
      method: "POST",
      body: formData
    });

    const result = await response.json().catch(() => null);
    setMessage(
      response.ok
        ? {
            tone: "success",
            text: `Imported ${result?.count ?? 0} saving card${result?.count === 1 ? "" : "s"}.`,
          }
        : {
            tone: "error",
            text: result?.error ?? "Import failed.",
          }
    );
  }

  return (
    <div className="space-y-6">
      <ReportingTrustCard readiness={readiness} />

      {showRampUpState ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>
              {!liveCardCount
                ? `${readiness?.workspace.name ?? "This workspace"} reporting is ready to launch`
                : readiness?.isWorkspaceReady
                  ? `${readiness.workspace.name} reporting is live and still ramping up`
                  : `${readiness?.workspace.name ?? "This workspace"} reporting is live, but setup is still in progress`}
            </CardTitle>
            <CardDescription>
              {!liveCardCount
                ? "Exports remain available, but the workbook will stay sparse until the first live saving cards are created or imported."
                : readiness?.isWorkspaceReady
                  ? `You currently have ${liveCardCount} live saving card${liveCardCount === 1 ? "" : "s"}. Reporting confidence will improve as more portfolio data, dates, and savings values accumulate.`
                  : `You already have ${liveCardCount} live saving card${liveCardCount === 1 ? "" : "s"}, but shared setup still needs attention to keep imports and reporting coverage consistent.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="grid gap-3 md:grid-cols-3">
              <OperationsMetric
                label="Reporting Scope"
                value={`${liveCardCount} live`}
                detail="Current saving cards in scope"
              />
              <OperationsMetric
                label="Setup Completeness"
                value={`${readiness?.coverage.overallPercent ?? 0}%`}
                detail={`${configuredCollections}/${readiness?.masterData.length ?? 6} collections configured`}
              />
              <OperationsMetric
                label="Workflow Coverage"
                value={`${workflowCoverageReady}/${readiness?.workflowCoverage.length ?? 3}`}
                detail="Approval roles currently assigned"
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

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Executive Workbook Export</CardTitle>
            <CardDescription>
              Download a structured workbook with a report summary sheet and the current saving-card register for this workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <OperationsMetric
                label="Portfolio Scope"
                value={`${liveCardCount} card${liveCardCount === 1 ? "" : "s"}`}
                detail="Live cards included in the export"
              />
              <OperationsMetric
                label="Reporting Freshness"
                value={formatDateLabel(readiness?.activity.lastPortfolioUpdateAt ?? null, "No updates yet")}
                detail="Most recent live portfolio update"
              />
              <OperationsMetric
                label="Coverage Limits"
                value={getCoverageLimitValue(readiness)}
                detail={getCoverageLimitDetail(readiness)}
              />
            </div>
            <div className="rounded-2xl bg-[var(--muted)]/60 p-4 text-sm text-[var(--muted-foreground)]">
              The workbook filename uses the workspace slug and export date, and the summary sheet records portfolio scope, setup completeness, and workflow coverage at export time.
            </div>
            <a href="/api/export" className={buttonVariants()}>
              Download Workbook
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Controlled Workbook Import</CardTitle>
            <CardDescription>
              Upload `.xlsx` workbooks aligned to saving-card columns for bulk creation inside the current workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <OperationsMetric
                label="Workspace Scope"
                value={readiness?.workspace.slug ?? "Current workspace"}
                detail="Imported rows stay organization-scoped"
              />
              <OperationsMetric
                label="Master Data"
                value={`${configuredCollections}/${readiness?.masterData.length ?? 6}`}
                detail="Configured collections available for cleaner imports"
              />
              <OperationsMetric
                label="Import Readiness"
                value={readiness?.isMasterDataReady ? "Ready" : "In progress"}
                detail="Shared data quality affects reporting consistency"
              />
            </div>
            <div className="space-y-2 rounded-2xl bg-[var(--muted)]/60 p-4 text-sm text-[var(--muted-foreground)]">
              <p>Use Excel workbooks with aligned saving-card columns and one row per initiative.</p>
              <p>
                Missing shared setup such as buyers, suppliers, materials, categories, plants, or business units can reduce reporting consistency after import.
              </p>
            </div>
            <form action={handleImport} className="space-y-4">
              <input type="file" name="file" accept=".xlsx,.xls" required />
              <Button type="submit">Import Workbook</Button>
            </form>
            {message ? (
              <p
                className={cn(
                  "rounded-xl px-4 py-3 text-sm",
                  message.tone === "success"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-rose-50 text-rose-700"
                )}
              >
                {message.text}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ReportingTrustCard({
  readiness,
}: {
  readiness?: WorkspaceReadiness | null;
}) {
  if (!readiness) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle>{readiness.workspace.name}</CardTitle>
          <CardDescription>
            Organization-scoped reporting operations area for workbook export, controlled bulk import, and portfolio coverage checks.
          </CardDescription>
        </div>
        <div className="rounded-full bg-[var(--muted)] px-3 py-1 text-xs font-medium text-[var(--muted-foreground)]">
          {readiness.isWorkspaceReady ? "Operationally ready" : "Setup still in progress"}
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-4">
        <OperationsMetric
          label="Workspace Slug"
          value={readiness.workspace.slug}
          detail={`Launched ${formatDateLabel(readiness.workspace.createdAt, "Unknown")}`}
        />
        <OperationsMetric
          label="Reporting Scope"
          value={`${readiness.counts.savingCards} live card${readiness.counts.savingCards === 1 ? "" : "s"}`}
          detail={`Last update ${formatDateLabel(readiness.activity.lastPortfolioUpdateAt, "No updates yet")}`}
        />
        <OperationsMetric
          label="Setup Completeness"
          value={`${readiness.coverage.overallPercent}%`}
          detail={`${readiness.coverage.masterDataReadyCount}/${readiness.coverage.masterDataTotal} collections and ${readiness.coverage.workflowReadyCount}/${readiness.coverage.workflowTotal} approval roles`}
        />
        <OperationsMetric
          label="Coverage Limits"
          value={getCoverageLimitValue(readiness)}
          detail={getCoverageLimitDetail(readiness)}
        />
      </CardContent>
    </Card>
  );
}

function OperationsMetric({
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

function getCoverageLimitValue(readiness?: WorkspaceReadiness | null) {
  if (!readiness) {
    return "Unknown";
  }

  const gapCount =
    readiness.missingCoreSetup.length + readiness.missingWorkflowCoverage.length;

  return gapCount ? `${gapCount} gap${gapCount === 1 ? "" : "s"}` : "Clear";
}

function getCoverageLimitDetail(readiness?: WorkspaceReadiness | null) {
  if (!readiness) {
    return "Workspace readiness is not available.";
  }

  const gaps = [
    ...readiness.missingCoreSetup,
    ...readiness.missingWorkflowCoverage,
  ];

  if (!gaps.length) {
    return "Core master data and approval coverage are in place for reporting.";
  }

  const visibleGaps = gaps.slice(0, 2).join(", ");
  const remainder = gaps.length > 2 ? ` +${gaps.length - 2} more` : "";
  return `${visibleGaps}${remainder} may limit import consistency or report completeness.`;
}

function buildReportingNextActions(readiness?: WorkspaceReadiness | null) {
  const actions: string[] = [];
  const cardCount = readiness?.counts.savingCards ?? 0;

  if (!cardCount) {
    actions.push("Create or import the first saving cards so exports reflect a live portfolio instead of an empty register.");
  } else if (cardCount < 3) {
    actions.push("Add more live saving cards so exports and analytics represent a broader operating portfolio.");
  }

  readiness?.missingCoreSetup.forEach((item) => {
    actions.push(`Add ${item} in Settings so import mapping and reporting stay consistent across the workspace.`);
  });

  readiness?.missingWorkflowCoverage.forEach((item) => {
    actions.push(`Assign at least one ${item} user so workflow-driven reporting reflects the real operating model.`);
  });

  if (!actions.length) {
    actions.push("Use workbook export for executive reporting and controlled import for bulk portfolio expansion in this workspace.");
  }

  return actions.slice(0, 4);
}
