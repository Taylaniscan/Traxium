"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import { Select } from "@/components/ui/select";
import { resolveUploadErrorMessage } from "@/lib/upload-limits";

type ImportResult = {
  error?: string;
  count?: number;
  results?: Array<{ row: number; title?: string; message: string }>;
};

export function UploadSavingCards({
  onImported,
}: {
  onImported: (count: number) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const [decimalSeparator, setDecimalSeparator] = useState<"dot" | "comma">(
    "dot",
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);
  const [issues, setIssues] = useState<NonNullable<ImportResult["results"]>>(
    [],
  );

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage(null);
    setIssues([]);
    try {
      const form = new FormData();
      form.set("importType", "saving_cards");
      form.set("decimalSeparator", decimalSeparator);
      form.set("file", file);
      const response = await fetch("/api/import", {
        method: "POST",
        body: form,
      });
      const result = (await response
        .json()
        .catch(() => null)) as ImportResult | null;
      if (!response.ok) {
        setMessage({
          text: resolveUploadErrorMessage(
            response.status,
            result?.error,
            "The workbook could not be imported."
          ),
          error: true,
        });
        setIssues(result?.results ?? []);
        return;
      }
      const count = result?.count ?? 0;
      setMessage({
        text: `${count} saving card${count === 1 ? "" : "s"} imported as Proposed.`,
        error: false,
      });
      if (count > 0) onImported(count);
    } catch {
      setMessage({
        text: "The upload could not connect. Choose the workbook again to retry.",
        error: true,
      });
    } finally {
      inFlight.current = false;
      setBusy(false);
      input.value = "";
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-[#d6e6df] bg-[#f6faf7] p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <FileSpreadsheet
          size={21}
          className="mt-0.5 shrink-0 text-[#226f55]"
          aria-hidden="true"
        />
        <div>
          <h2 className="text-sm font-semibold">
            Already tracking savings in a workbook?
          </h2>
          <p className="mt-1 text-xs leading-6 text-[#5b7075]">
            Import an XLSX file. Traxium checks every row before saving any
            cards; imported cards start as Proposed.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="space-y-1">
          <label
            htmlFor="onboarding-card-decimal"
            className="text-xs font-medium text-[#314b50]"
          >
            Text-number decimal separator
          </label>
          <Select
            id="onboarding-card-decimal"
            value={decimalSeparator}
            onChange={(event) =>
              setDecimalSeparator(event.target.value as typeof decimalSeparator)
            }
            className="h-11 min-w-40 rounded-xl"
          >
            <option value="dot">Point (12.5)</option>
            <option value="comma">Comma (12,5)</option>
          </Select>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#68a58c] bg-white px-5 py-2 text-sm font-semibold text-[#155e52] transition hover:bg-[#eaf5ee] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155e52] disabled:opacity-60"
        >
          <Upload size={16} aria-hidden="true" />
          {busy ? "Uploading…" : "Upload your saving cards"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={upload}
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>
      <p className="text-xs leading-5 text-[#5b7075]">
        Download the{" "}
        <a
          href="/api/export"
          className="font-semibold text-[#216f56] underline underline-offset-4"
        >
          workbook with an import template
        </a>
        . Use USD or EUR and explicit volume units.
      </p>
      {message ? (
        <div
          role={message.error ? "alert" : "status"}
          className={`rounded-xl px-4 py-3 text-sm ${message.error ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-900"}`}
        >
          {message.text}
        </div>
      ) : null}
      {issues.length > 0 ? (
        <details className="rounded-lg border border-[#d6e6df] bg-white p-3 text-xs">
          <summary className="cursor-pointer font-semibold">
            Review {issues.length} row issue{issues.length === 1 ? "" : "s"}
          </summary>
          <ul className="mt-3 space-y-2">
            {issues.map((issue) => (
              <li key={`${issue.row}-${issue.title ?? ""}`}>
                <span className="font-semibold">
                  Row {issue.row}
                  {issue.title ? ` · ${issue.title}` : ""}:
                </span>{" "}
                {issue.message}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
