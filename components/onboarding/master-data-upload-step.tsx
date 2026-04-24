"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, type ChangeEvent, type ReactNode } from "react";

import { MasterDataStarterTable } from "@/components/onboarding/master-data-starter-table";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import {
  getMasterDataOnboardingStepConfig,
  getMasterDataTemplateDownloadHref,
  isMasterDataImportEntityKey,
  type MasterDataOnboardingColumnDefinition,
  type MasterDataOnboardingEntityKey,
} from "@/lib/onboarding/master-data-config";
import { cn } from "@/lib/utils";

type UploadMessage = {
  tone: "success" | "error";
  text: string;
};

type OnboardingMasterDataImportResult = {
  row: number;
  status: "created" | "skipped" | "failed";
  name: string;
  message: string;
};

type OnboardingMasterDataImportResponse = {
  importType: "buyers" | "suppliers" | "materials" | "categories";
  summary: {
    created: number;
    skipped: number;
    failed: number;
  };
  results: OnboardingMasterDataImportResult[];
};

type MasterDataUploadStepProps = {
  stepNumber: number;
  entityKey: MasterDataOnboardingEntityKey;
  status: "complete" | "current" | "pending";
  count: number;
};

function getStatusBadge(status: MasterDataUploadStepProps["status"]) {
  switch (status) {
    case "complete":
      return { label: "Complete", tone: "emerald" as const };
    case "current":
      return { label: "Recommended next", tone: "blue" as const };
    default:
      return { label: "Pending", tone: "slate" as const };
  }
}

export function MasterDataUploadStep({
  stepNumber,
  entityKey,
  status,
  count,
}: MasterDataUploadStepProps) {
  const router = useRouter();
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<UploadMessage | null>(null);
  const [importResult, setImportResult] =
    useState<OnboardingMasterDataImportResponse | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputId = useId();
  const badge = getStatusBadge(status);
  const config = getMasterDataOnboardingStepConfig(entityKey);
  const exampleRowValues = config.templateHeaders.map(
    (header) => config.exampleRow[header] ?? ""
  );
  const uploadImportType = isMasterDataImportEntityKey(entityKey) ? entityKey : null;
  const uploadEnabled = config.uploadEnabled && uploadImportType !== null;

  function handleFileSelection() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    if (!file || !uploadImportType) {
      event.currentTarget.value = "";
      return;
    }

    setSelectedFileName(file.name);
    setUploadMessage(null);
    setImportResult(null);
    setIsUploading(true);

    const formData = new FormData();
    formData.set("importType", uploadImportType);
    formData.set("file", file);

    try {
      const response = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json().catch(() => null)) as
        | OnboardingMasterDataImportResponse
        | { error?: string }
        | null;

      if (!response.ok) {
        setUploadMessage({
          tone: "error",
          text:
            result && "error" in result
              ? result.error ?? "Upload failed."
              : "Upload failed.",
        });
        return;
      }

      const summary =
        result && "summary" in result
          ? result.summary
          : { created: 0, skipped: 0, failed: 0 };

      setImportResult(
        result && "summary" in result
          ? (result as OnboardingMasterDataImportResponse)
          : null
      );
      setUploadMessage({
        tone: summary.failed > 0 ? "error" : "success",
        text: `${summary.created} created, ${summary.skipped} skipped, ${summary.failed} failed.`,
      });

      if (summary.created > 0) {
        router.refresh();
      }
    } catch {
      setUploadMessage({
        tone: "error",
        text: "Upload failed.",
      });
    } finally {
      setIsUploading(false);
      event.currentTarget.value = "";
    }
  }

  return (
    <Card className={status === "current" ? "border-[rgba(37,99,235,0.24)]" : undefined}>
      <CardContent className="py-5">
        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-5">
            <div className="flex min-w-0 gap-4">
              <div
                className={cn(
                  "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
                  status === "complete"
                    ? "border-[rgba(22,163,74,0.24)] bg-[rgba(22,163,74,0.08)] text-[var(--success)]"
                    : status === "current"
                      ? "border-[rgba(37,99,235,0.24)] bg-[rgba(37,99,235,0.08)] text-[var(--info)]"
                      : "border-[var(--border)] bg-[var(--muted)]/45 text-[var(--muted-foreground)]"
                )}
              >
                {status === "complete" ? "✓" : stepNumber}
              </div>

              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    Step {stepNumber}
                  </p>
                  <Badge tone={badge.tone}>{badge.label}</Badge>
                </div>
                <div>
                  <h3 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">
                    {config.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                    {config.description}
                  </p>
                </div>
                <p className="text-sm font-medium text-[var(--foreground)]">
                  {count > 0
                    ? `${count} ${count === 1 ? config.singularLabel : config.pluralLabel} already configured.`
                    : `No ${config.pluralLabel} configured yet.`}
                </p>
                <p className="text-sm text-[var(--muted-foreground)]">{config.helper}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Upload first
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                Use a template to prepare {config.pluralLabel} in bulk. Manual entry stays
                available as a fallback when you only need a small number of records.
              </p>

              <input
                id={fileInputId}
                ref={fileInputRef}
                type="file"
                accept={config.fileInputAccept}
                className="hidden"
                disabled={!uploadEnabled || isUploading}
                onChange={handleFileChange}
              />

              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleFileSelection}
                  disabled={!uploadEnabled || isUploading}
                >
                  {isUploading
                    ? "Uploading..."
                    : uploadEnabled
                      ? "Upload file"
                      : "Upload coming soon"}
                </Button>
                <MasterDataStarterTable
                  entityKey={entityKey}
                  count={count}
                  compact
                  panelId={`starter-data-upload-${entityKey}`}
                />
                <a
                  href={getMasterDataTemplateDownloadHref(entityKey)}
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                  download={config.templateFileName}
                >
                  Download template
                </a>
              </div>

              <p className="mt-3 text-xs leading-5 text-[var(--muted-foreground)]">
                {uploadEnabled
                  ? `Accepted in onboarding right now: ${config.acceptedFileTypes.join(", ")}.`
                  : "Template download is ready now. Upload processing for this step is not connected yet, so manual entry remains the live path."}
              </p>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                Field guide
              </p>
              <div className="mt-3 space-y-4">
                <GuideSection title="Accepted file types">
                  <div className="flex flex-wrap gap-2">
                    {config.acceptedFileTypes.map((fileType) => (
                      <span
                        key={fileType}
                        className="rounded-full bg-[var(--muted)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)]"
                      >
                        {fileType}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                    Download the CSV template and keep the column names exactly as
                    shown below.
                  </p>
                </GuideSection>

                <GuideSection title="Use these column names exactly">
                  <code className="block rounded-xl bg-[var(--background)] px-3 py-3 text-sm text-[var(--foreground)]">
                    {config.templateHeaders.join(", ")}
                  </code>
                </GuideSection>

                <GuideSection title="Required columns">
                  <div className="space-y-3">
                    {config.requiredColumns.map((column) => (
                      <FieldGuideItem key={column.key} column={column} tone="Required" />
                    ))}
                  </div>
                </GuideSection>

                <GuideSection title="Optional columns">
                  <div className="space-y-3">
                    {config.optionalColumns.map((column) => (
                      <FieldGuideItem key={column.key} column={column} tone="Optional" />
                    ))}
                  </div>
                </GuideSection>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                Example row
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                This example shows one complete row with optional fields filled in.
                If you do not use an optional field yet, you can leave that cell blank.
              </p>
              <div className="mt-3 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--background)]">
                <Table>
                  <TableHead>
                    <TableRow className="hover:bg-transparent">
                      {config.templateHeaders.map((header) => (
                        <TableHeaderCell key={header}>{header}</TableHeaderCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow className="hover:bg-transparent">
                      {exampleRowValues.map((value, index) => (
                        <TableCell key={`${config.templateHeaders[index]}-${value}`}>
                          {value}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                Result summary
              </p>
              <div className="mt-3 space-y-2 text-sm leading-6 text-[var(--muted-foreground)]">
                {isUploading && selectedFileName ? (
                  <>
                    <p className="font-medium text-[var(--foreground)]">
                      Selected file: {selectedFileName}
                    </p>
                    <p>
                      Upload in progress. Traxium is validating rows and preparing
                      the import result.
                    </p>
                  </>
                ) : importResult ? (
                  <>
                    {selectedFileName ? (
                      <p className="font-medium text-[var(--foreground)]">
                        Latest file: {selectedFileName}
                      </p>
                    ) : null}
                    {uploadMessage ? (
                      <p
                        className={cn(
                          "rounded-xl px-4 py-3 text-sm",
                          uploadMessage.tone === "success"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-rose-50 text-rose-700"
                        )}
                      >
                        {uploadMessage.text}
                      </p>
                    ) : null}
                    <div className="grid gap-3 sm:grid-cols-3">
                      <ResultMetric
                        label="Created"
                        value={String(importResult.summary.created)}
                        detail="New records added"
                      />
                      <ResultMetric
                        label="Skipped"
                        value={String(importResult.summary.skipped)}
                        detail="Duplicates already covered"
                      />
                      <ResultMetric
                        label="Failed"
                        value={String(importResult.summary.failed)}
                        detail="Rows needing correction"
                      />
                    </div>
                    <div className="space-y-2">
                      {importResult.results
                        .filter((item) => item.status !== "created")
                        .map((item) => (
                          <div
                            key={`${item.row}-${item.name}-${item.status}`}
                            className="rounded-xl border border-[var(--border)] px-4 py-3"
                          >
                            <p className="font-medium text-[var(--foreground)]">
                              Row {item.row}
                              {item.name ? ` · ${item.name}` : ""}
                            </p>
                            <p>
                              {item.status === "skipped" ? "Skipped" : "Failed"}:{" "}
                              {item.message}
                            </p>
                          </div>
                        ))}
                      {importResult.results.every((item) => item.status === "created") ? (
                        <p>All rows were created successfully.</p>
                      ) : null}
                    </div>
                  </>
                ) : uploadMessage ? (
                  <p
                    className={cn(
                      "rounded-xl px-4 py-3 text-sm",
                      uploadMessage.tone === "success"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-rose-50 text-rose-700"
                    )}
                  >
                    {uploadMessage.text}
                  </p>
                ) : count > 0 ? (
                  <>
                    <p className="font-medium text-[var(--foreground)]">
                      This step is already marked complete from live readiness.
                    </p>
                    <p>
                      Traxium currently sees {count}{" "}
                      {count === 1 ? config.singularLabel : config.pluralLabel} in the workspace.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-[var(--foreground)]">
                      {uploadEnabled
                        ? "No upload has been processed yet."
                        : "Upload is not connected for this step yet."}
                    </p>
                    <p>
                      {uploadEnabled
                        ? "Choose a CSV or XLSX file to validate rows, create what is new, and see skipped or failed lines immediately."
                        : "Download the template now and use manual entry if you need records before bulk upload support for this step is added."}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ResultMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold text-[var(--foreground)]">{value}</p>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">{detail}</p>
    </div>
  );
}

function GuideSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function FieldGuideItem({
  column,
  tone,
}: {
  column: MasterDataOnboardingColumnDefinition;
  tone: "Required" | "Optional";
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-[var(--foreground)]">
          {column.label}
        </p>
        <span className="rounded-full bg-[var(--muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted-foreground)]">
          {tone}
        </span>
      </div>
      <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
        {column.description}
      </p>
    </div>
  );
}
