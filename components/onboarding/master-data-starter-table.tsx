"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  type MasterDataOnboardingEntityKey,
} from "@/lib/onboarding/master-data-config";
import { cn } from "@/lib/utils";

type StarterRow = Record<string, string>;

type StarterDataResult = {
  entity: MasterDataOnboardingEntityKey;
  summary: {
    created: number;
    skipped: number;
    failed: number;
  };
  results: Array<{
    row: number;
    status: "created" | "skipped" | "failed";
    name: string;
    message: string;
  }>;
};

type MasterDataStarterTableProps = {
  entityKey: MasterDataOnboardingEntityKey;
  count: number;
  buttonLabel?: string;
  compact?: boolean;
  panelId?: string;
};

function createEmptyRow(headers: readonly string[]) {
  return Object.fromEntries(headers.map((header) => [header, ""])) as StarterRow;
}

function createStarterRows(headers: readonly string[]) {
  return [createEmptyRow(headers), createEmptyRow(headers), createEmptyRow(headers)];
}

export function MasterDataStarterTable({
  entityKey,
  count,
  buttonLabel = "Add manually",
  compact = false,
  panelId,
}: MasterDataStarterTableProps) {
  const router = useRouter();
  const config = getMasterDataOnboardingStepConfig(entityKey);
  const starterTableId = panelId ?? `starter-data-${entityKey}`;
  const dialogId = `${starterTableId}-dialog`;
  const titleId = `${starterTableId}-title`;
  const tableMinWidth = Math.max(860, config.templateHeaders.length * 220 + 140);
  const [isOpen, setIsOpen] = useState(false);
  const [rows, setRows] = useState<StarterRow[]>(() =>
    createStarterRows(config.templateHeaders)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<StarterDataResult | null>(null);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    setRows(createStarterRows(config.templateHeaders));
    setResult(null);
    setMessage(null);
    setIsSaving(false);
  }, [config.templateHeaders]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function updateCell(rowIndex: number, column: string, value: string) {
    setRows((currentRows) =>
      currentRows.map((row, index) =>
        index === rowIndex
          ? {
              ...row,
              [column]: value,
            }
          : row
      )
    );
  }

  function addRow() {
    setRows((currentRows) => [
      ...currentRows,
      createEmptyRow(config.templateHeaders),
    ]);
  }

  function removeRow(rowIndex: number) {
    setRows((currentRows) =>
      currentRows.length <= 1
        ? currentRows
        : currentRows.filter((_, index) => index !== rowIndex)
    );
  }

  async function saveRows() {
    setIsSaving(true);
    setMessage(null);
    setResult(null);

    try {
      const response = await fetch("/api/onboarding/master-data", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          entity: entityKey,
          rows,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | StarterDataResult
        | { error?: string }
        | null;

      if (!response.ok) {
        setMessage({
          tone: "error",
          text:
            payload && "error" in payload
              ? payload.error ?? "Starter data could not be saved."
              : "Starter data could not be saved.",
        });
        return;
      }

      const resultPayload = payload as StarterDataResult;
      setResult(resultPayload);
      setMessage({
        tone: resultPayload.summary.failed > 0 ? "error" : "success",
        text: `${resultPayload.summary.created} created, ${resultPayload.summary.skipped} skipped, ${resultPayload.summary.failed} failed.`,
      });

      if (resultPayload.summary.created > 0) {
        setRows(createStarterRows(config.templateHeaders));
        router.refresh();
      }
    } catch (error) {
      setMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Starter data could not be saved.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      id={starterTableId}
      className={cn("space-y-3", compact ? "w-full" : undefined)}
    >
      <Button
        type="button"
        size="sm"
        variant="outline"
        aria-controls={dialogId}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        {isOpen ? "Close starter table" : buttonLabel}
      </Button>

      {isOpen ? (
        <div
          id={dialogId}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="fixed inset-0 z-50 overflow-y-auto bg-black/35 px-3 py-4 sm:px-6 lg:px-8"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsOpen(false);
            }
          }}
        >
          <div className="mx-auto flex min-h-full w-full max-w-7xl items-start justify-center">
            <div className="w-full space-y-5 rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 shadow-2xl sm:p-5 lg:p-6">
              <div className="flex flex-col gap-4 border-b border-[var(--border)] pb-4 md:flex-row md:items-start md:justify-between">
                <div className="max-w-3xl">
                  <p
                    id={titleId}
                    className="text-lg font-semibold text-[var(--foreground)]"
                  >
                    Starter data table for {config.pluralLabel}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                    Add a few starter records now. Empty rows are ignored,
                    duplicates are skipped, and readiness refreshes after new
                    records are saved.
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    Current count: {count}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                >
                  Close
                </Button>
              </div>

              <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
                <Table className="w-full" style={{ minWidth: tableMinWidth }}>
                  <TableHead>
                    <TableRow className="hover:bg-transparent">
                      {config.templateHeaders.map((header) => (
                        <TableHeaderCell
                          key={header}
                          className="min-w-[200px] whitespace-nowrap"
                        >
                          {header}
                          {config.requiredColumns.some(
                            (column) => column.key === header
                          ) ? (
                            <span className="ml-1 text-[var(--risk)]">*</span>
                          ) : null}
                        </TableHeaderCell>
                      ))}
                      <TableHeaderCell className="w-[130px] whitespace-nowrap">
                        Action
                      </TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((row, rowIndex) => (
                      <TableRow key={`starter-${entityKey}-${rowIndex}`}>
                        {config.templateHeaders.map((header) => (
                          <TableCell
                            key={`${entityKey}-${rowIndex}-${header}`}
                            className="min-w-[200px]"
                          >
                            <Input
                              aria-label={`${config.pluralLabel} row ${rowIndex + 1} ${header}`}
                              value={row[header] ?? ""}
                              onChange={(event) =>
                                updateCell(rowIndex, header, event.target.value)
                              }
                              placeholder={config.exampleRow[header] ?? header}
                              className="min-w-[180px]"
                            />
                          </TableCell>
                        ))}
                        <TableCell className="w-[130px]">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => removeRow(rowIndex)}
                            disabled={rows.length <= 1}
                          >
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

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

              {result?.results.length ? (
                <div className="space-y-2 text-sm text-[var(--muted-foreground)]">
                  {result.results
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
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3 border-t border-[var(--border)] pt-4">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={addRow}
                >
                  Add row
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={saveRows}
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : `Save ${config.pluralLabel}`}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
