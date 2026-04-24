"use client";

import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import type { WorkspaceReadiness } from "@/lib/types";
import { cn } from "@/lib/utils";

type ImportMessage = {
  tone: "success" | "error";
  text: string;
};

type MasterDataImportType = "buyers" | "suppliers" | "materials";
type MasterDataImportResult = {
  row: number;
  status: "created" | "skipped" | "failed";
  name: string;
  message: string;
};
type MasterDataImportResponse = {
  importType: MasterDataImportType;
  summary: {
    created: number;
    skipped: number;
    failed: number;
  };
  results: MasterDataImportResult[];
};

const MASTER_DATA_IMPORT_OPTIONS: Record<
  MasterDataImportType,
  {
    label: string;
    description: string;
    headers: Array<{ name: string; optional?: boolean }>;
    sampleRows: string[][];
  }
> = {
  buyers: {
    label: "Buyers",
    description:
      "Bulk-create buyer records for the current workspace. Existing names are skipped and never overwritten.",
    headers: [
      { name: "Name" },
      { name: "Email", optional: true },
    ],
    sampleRows: [
      ["Strategic Buyer", "buyer@company.com"],
      ["Regional Buyer", ""],
    ],
  },
  suppliers: {
    label: "Suppliers",
    description:
      "Bulk-create supplier records for the current workspace. Existing names are skipped and never overwritten.",
    headers: [{ name: "Name" }],
    sampleRows: [["Atlas Chemicals"], ["Northwind Packaging"]],
  },
  materials: {
    label: "Materials",
    description:
      "Bulk-create material records for the current workspace. Existing names are skipped and never overwritten.",
    headers: [{ name: "Name" }],
    sampleRows: [["PET Resin"], ["Aluminum Coil"]],
  },
};

export function ImportExportPanel({
  readiness,
}: {
  readiness?: WorkspaceReadiness | null;
}) {
  const [savingCardMessage, setSavingCardMessage] = useState<ImportMessage | null>(null);
  const [masterDataMessage, setMasterDataMessage] = useState<ImportMessage | null>(null);
  const [masterDataResult, setMasterDataResult] =
    useState<MasterDataImportResponse | null>(null);
  const [masterDataImportType, setMasterDataImportType] =
    useState<MasterDataImportType>("buyers");
  const liveCardCount = readiness?.counts.savingCards ?? 0;
  const configuredCollections = readiness?.masterData.filter((item) => item.ready).length ?? 0;
  const workflowCoverageReady = readiness?.workflowCoverage.filter((item) => item.ready).length ?? 0;
  const showRampUpState =
    !!readiness && (liveCardCount < 3 || !readiness.isWorkspaceReady);
  const nextActions = buildReportingNextActions(readiness);
  const selectedMasterDataOption = MASTER_DATA_IMPORT_OPTIONS[masterDataImportType];

  async function handleImport(formData: FormData) {
    const response = await fetch("/api/import", {
      method: "POST",
      body: formData
    });

    const result = await response.json().catch(() => null);
    setSavingCardMessage(
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

  async function handleMasterDataImport(formData: FormData) {
    const response = await fetch("/api/import", {
      method: "POST",
      body: formData,
    });

    const result = (await response.json().catch(() => null)) as MasterDataImportResponse | {
      error?: string;
    } | null;

    if (!response.ok) {
      setMasterDataResult(null);
      setMasterDataMessage({
        tone: "error",
        text: result && "error" in result ? result.error ?? "Import failed." : "Import failed.",
      });
      return;
    }

    const summary =
      result && "summary" in result
        ? result.summary
        : { created: 0, skipped: 0, failed: 0 };

    setMasterDataResult(
      result && "summary" in result ? (result as MasterDataImportResponse) : null
    );
    setMasterDataMessage({
      tone: summary.failed > 0 ? "error" : "success",
      text: `${summary.created} created, ${summary.skipped} skipped, ${summary.failed} failed.`,
    });
  }

  return (
    <div className="space-y-6">
      {showRampUpState ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>
              {!liveCardCount
                ? "Reporting is ready to launch"
                : readiness?.isWorkspaceReady
                  ? "Reporting is live and still ramping up"
                  : "Reporting is live, but setup is still in progress"}
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
            {savingCardMessage ? (
              <p
                className={cn(
                  "rounded-xl px-4 py-3 text-sm",
                  savingCardMessage.tone === "success"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-rose-50 text-rose-700"
                )}
              >
                {savingCardMessage.text}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Core Master Data Import</CardTitle>
          <CardDescription>
            Bulk-create buyers, suppliers, or materials for this workspace from a structured CSV or `.xlsx` file.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 lg:grid-cols-[220px_1fr]">
            <div className="space-y-2">
              <label
                className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]"
                htmlFor="master-data-import-type"
              >
                Import type
              </label>
              <Select
                id="master-data-import-type"
                name="importType"
                value={masterDataImportType}
                onChange={(event) =>
                  setMasterDataImportType(event.target.value as MasterDataImportType)
                }
              >
                <option value="buyers">Buyers</option>
                <option value="suppliers">Suppliers</option>
                <option value="materials">Materials</option>
              </Select>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/40 p-4 text-sm text-[var(--muted-foreground)]">
              <p className="font-medium text-[var(--foreground)]">
                {selectedMasterDataOption.label} file format
              </p>
              <p className="mt-2">{selectedMasterDataOption.description}</p>
              <p className="mt-3">
                Exact headers:{" "}
                <code className="rounded bg-white px-2 py-1 text-[12px] text-[var(--foreground)]">
                  {selectedMasterDataOption.headers
                    .map((header) =>
                      header.optional ? `${header.name} (optional)` : header.name
                    )
                    .join(" | ")}
                </code>
              </p>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {selectedMasterDataOption.sampleRows.map((row, index) => (
                  <div
                    key={`${selectedMasterDataOption.label}-${index}`}
                    className="rounded-xl border border-dashed border-[var(--border)] bg-white px-3 py-2"
                  >
                    <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                      Sample row {index + 1}
                    </p>
                    <p className="mt-1 font-mono text-[12px] text-[var(--foreground)]">
                      {row.join(" | ")}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs">
                Duplicate names already present in this workspace, or repeated earlier in the same workbook, are skipped instead of overwritten.
              </p>
            </div>
          </div>

          <form action={handleMasterDataImport} className="space-y-4">
            <input type="hidden" name="importType" value={masterDataImportType} />
            <input type="file" name="file" accept=".csv,.xlsx" required />
            <Button type="submit">Import Master Data</Button>
          </form>

          {masterDataMessage ? (
            <p
              className={cn(
                "rounded-xl px-4 py-3 text-sm",
                masterDataMessage.tone === "success"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-rose-50 text-rose-700"
              )}
            >
              {masterDataMessage.text}
            </p>
          ) : null}

          {masterDataResult ? (
            <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-white/80 p-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <OperationsMetric
                  label="Created"
                  value={String(masterDataResult.summary.created)}
                  detail="New records added"
                />
                <OperationsMetric
                  label="Skipped"
                  value={String(masterDataResult.summary.skipped)}
                  detail="Duplicates already covered"
                />
                <OperationsMetric
                  label="Failed"
                  value={String(masterDataResult.summary.failed)}
                  detail="Rows needing correction"
                />
              </div>
              <div className="space-y-2">
                {masterDataResult.results
                  .filter((item) => item.status !== "created")
                  .map((item) => (
                    <div
                      key={`${item.row}-${item.name}-${item.status}`}
                      className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm"
                    >
                      <p className="font-medium text-[var(--foreground)]">
                        Row {item.row}
                        {item.name ? ` · ${item.name}` : ""}
                      </p>
                      <p className="mt-1 text-[var(--muted-foreground)]">
                        {item.status === "skipped" ? "Skipped" : "Failed"}: {item.message}
                      </p>
                    </div>
                  ))}
                {masterDataResult.results.every((item) => item.status === "created") ? (
                  <p className="text-sm text-[var(--muted-foreground)]">
                    All rows were created successfully.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
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
      <p className="text-[11px] text-[var(--muted-foreground)]">{label}</p>
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
