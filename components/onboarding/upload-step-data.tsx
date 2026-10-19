"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";

import {
  getMasterDataOnboardingStepConfig,
  type MasterDataOnboardingEntityKey,
} from "@/lib/onboarding/master-data-config";
import { Select } from "@/components/ui/select";

type UploadResponse = {
  error?: string;
  summary?: { created: number; skipped: number; failed: number };
  results?: Array<{
    row: number;
    name: string;
    status: "created" | "skipped" | "failed";
    message: string;
  }>;
};

export function UploadStepData({
  entity,
  buttonLabel,
  onCreated,
}: {
  entity: MasterDataOnboardingEntityKey;
  buttonLabel: string;
  onCreated: (count: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const [separator, setSeparator] = useState<"comma" | "semicolon" | "tab">(
    "comma",
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);
  const [issues, setIssues] = useState<NonNullable<UploadResponse["results"]>>(
    [],
  );
  const config = getMasterDataOnboardingStepConfig(entity);

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
      form.set("entity", entity);
      form.set("file", file);
      form.set("separator", separator);
      const response = await fetch("/api/onboarding/master-data", {
        method: "POST",
        body: form,
      });
      const result = (await response
        .json()
        .catch(() => null)) as UploadResponse | null;
      if (!response.ok || !result?.summary) {
        setMessage({
          text: result?.error ?? "Upload failed. Check the file and try again.",
          error: true,
        });
        return;
      }
      const { created, skipped, failed } = result.summary;
      if (created > 0) onCreated(created);
      setIssues(
        result.results?.filter((row) => row.status !== "created") ?? [],
      );
      setMessage({
        text: `${file.name}: ${created} added, ${skipped} already present or repeated, ${failed} could not be added.`,
        error: failed > 0,
      });
    } catch {
      setMessage({
        text: "The upload could not connect. Choose the file again to retry.",
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
          <h2 className="text-sm font-semibold">Have a list already?</h2>
          <p className="mt-1 text-xs leading-6 text-[#5b7075]">
            Upload up to 250 {config.pluralLabel} from CSV or XLSX. Only the
            first worksheet is used.
            {entity === "buyers"
              ? " This adds buyer records; colleague invitations are separate."
              : null}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="space-y-1">
          <label
            htmlFor={`separator-${entity}`}
            className="text-xs font-medium text-[#314b50]"
          >
            CSV separator
          </label>
          <Select
            id={`separator-${entity}`}
            value={separator}
            onChange={(event) =>
              setSeparator(event.target.value as typeof separator)
            }
            className="h-11 min-w-40 rounded-xl"
          >
            <option value="comma">Comma (,)</option>
            <option value="semicolon">Semicolon (;)</option>
            <option value="tab">Tab</option>
          </Select>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#68a58c] bg-white px-5 py-2 text-sm font-semibold text-[#155e52] transition hover:bg-[#eaf5ee] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155e52] disabled:opacity-60"
        >
          <Upload size={16} aria-hidden="true" />
          {busy ? "Uploading…" : buttonLabel}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={upload}
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>
      <p className="text-xs leading-5 text-[#5b7075]">
        This step saves{" "}
        {entity === "buyers"
          ? "name and email"
          : entity === "plants"
            ? "name and region"
            : "name"}
        . Other template columns are not stored.{" "}
        <a
          href={`/api/onboarding/master-data-template/${entity}?starter=1`}
          download
          className="font-semibold text-[#216f56] underline underline-offset-4"
        >
          Download a matching template
        </a>
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
            Review {issues.length} row result{issues.length === 1 ? "" : "s"}
          </summary>
          <ul className="mt-3 space-y-2">
            {issues.map((issue) => (
              <li key={`${issue.row}-${issue.name}`}>
                <span className="font-semibold">
                  Row {issue.row}
                  {issue.name ? ` · ${issue.name}` : ""}:
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
