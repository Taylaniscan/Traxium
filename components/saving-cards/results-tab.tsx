"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  Download,
  Loader2,
  UploadCloud,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type {
  VolumeImportResult,
  VolumeTimelineResult,
  VolumeTimelineRow,
} from "@/lib/types";
import { formatCurrency } from "@/lib/utils/numberFormatter";

type EditableField = "forecast" | "actual";

type EditingCell = {
  periodKey: string;
  field: EditableField;
  value: string;
};

type SerialVolumeResponse = VolumeTimelineResult;

const EMPTY_TIMELINE: SerialVolumeResponse = {
  timeline: [],
  summary: {
    ytdForecastSaving: 0,
    ytdActualSaving: 0,
    ytdVarianceSaving: 0,
    ytdVariancePercent: null,
    ytdForecastQty: 0,
    ytdActualQty: 0,
    ytdVarianceQty: 0,
    totalForecastMonths: 0,
    confirmedMonths: 0,
    hasData: false,
  },
};

export function ResultsTab({
  savingCardId,
  materialName,
  baselinePrice,
  newPrice,
  annualVolume,
  volumeUnit,
  currency,
}: {
  savingCardId: string;
  materialName: string;
  baselinePrice: number;
  newPrice: number;
  annualVolume: number;
  volumeUnit: string;
  currency: "EUR" | "USD";
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [data, setData] = useState<SerialVolumeResponse>(EMPTY_TIMELINE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [draftPeriod, setDraftPeriod] = useState("");
  const [draftForecastQty, setDraftForecastQty] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<VolumeImportResult | null>(null);

  const loadTimeline = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/saving-cards/${savingCardId}/volume`, {
        cache: "no-store",
      });
      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error ?? "Volume timeline could not be loaded.");
      }

      setData(result as SerialVolumeResponse);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Volume timeline could not be loaded."
      );
      setData(EMPTY_TIMELINE);
    } finally {
      setLoading(false);
    }
  }, [savingCardId]);

  useEffect(() => {
    void loadTimeline();
  }, [loadTimeline]);

  const staticForecastSaving = (baselinePrice - newPrice) * annualVolume;
  const todayPeriodLabel = getCurrentPeriodLabel();
  const chartRows = useMemo(() => {
    let cumulativeForecast = 0;
    let cumulativeActual = 0;

    return data.timeline.map((row) => {
      cumulativeForecast += row.forecastSaving;
      cumulativeActual += row.actualSaving;

      return {
        ...row,
        cumulativeForecast,
        cumulativeActual,
      };
    });
  }, [data.timeline]);

  async function saveCell(cell: EditingCell) {
    const trimmed = cell.value.trim();
    const route =
      cell.field === "forecast"
        ? `/api/saving-cards/${savingCardId}/volume/forecast`
        : `/api/saving-cards/${savingCardId}/volume/actual`;
    const row = data.timeline.find((item) => item.periodKey === cell.periodKey);

    if (!row) {
      setEditing(null);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      let response: Response;

      if (!trimmed) {
        response = await fetch(route, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ period: cell.periodKey }),
        });
      } else {
        const quantity = Number(trimmed);

        if (!Number.isFinite(quantity) || quantity < 0) {
          throw new Error("Quantity must be zero or greater.");
        }

        response = await fetch(route, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            cell.field === "forecast"
              ? {
                  period: cell.periodKey,
                  forecastQty: quantity,
                  unit: row.unit || volumeUnit,
                }
              : {
                  period: cell.periodKey,
                  actualQty: quantity,
                  unit: row.unit || volumeUnit,
                }
          ),
        });
      }

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error ?? "Volume data could not be saved.");
      }

      setEditing(null);
      await loadTimeline();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Volume data could not be saved."
      );
    } finally {
      setSaving(false);
    }
  }

  async function addForecastPeriod() {
    if (!draftPeriod.trim()) {
      setError("Select a month before adding a forecast.");
      return;
    }

    const quantity = Number(draftForecastQty);
    if (!Number.isFinite(quantity) || quantity < 0) {
      setError("Forecast quantity must be zero or greater.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/saving-cards/${savingCardId}/volume/forecast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period: draftPeriod,
          forecastQty: quantity,
          unit: volumeUnit,
        }),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error ?? "Forecast could not be added.");
      }

      setDraftPeriod("");
      setDraftForecastQty("");
      await loadTimeline();
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "Forecast could not be added.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadImportFile(file: File) {
    setImporting(true);
    setError(null);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/saving-cards/${savingCardId}/volume/import`, {
        method: "POST",
        body: formData,
      });
      const result = (await response.json().catch(() => null)) as VolumeImportResult & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result?.error ?? "Volume import failed.");
      }

      setImportResult(result);
      await loadTimeline();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Volume import failed.");
    } finally {
      setImporting(false);
    }
  }

  function downloadTemplate() {
    const current = new Date();
    const monthOne = `${current.getUTCFullYear()}-${String(current.getUTCMonth()).padStart(2, "0")}`;
    const monthTwo = `${current.getUTCFullYear()}-${String(current.getUTCMonth() + 1).padStart(2, "0")}`;
    const template = [
      `Period,Forecast (${volumeUnit}),Actual (${volumeUnit})`,
      `${monthOne},1200,1180`,
      `${monthTwo},1325,`,
    ].join("\n");

    const blob = new Blob([template], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `traxium-volume-template-${materialName.toLowerCase().replace(/\s+/g, "-")}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-[var(--border)] bg-[var(--surface-elevated)]/75">
          <p className="text-[11px] font-semibold text-[var(--muted-foreground)]">
            Value Tracking
          </p>
          <CardTitle>Results & Realisation</CardTitle>
          <CardDescription>
            Track monthly forecast and actual consumption so the commercial case, realised savings, and variance stay visible in one operational surface.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ResultMetric
            label="Static Forecast"
            value={formatCurrency(Math.round(staticForecastSaving), currency)}
            detail={`${formatVolume(annualVolume)} ${volumeUnit} annual baseline`}
            tone="slate"
          />
          <ResultMetric
            label="YTD Forecast Saving"
            value={formatCurrency(Math.round(data.summary.ytdForecastSaving), currency)}
            detail={`${data.summary.totalForecastMonths} planned month${data.summary.totalForecastMonths === 1 ? "" : "s"}`}
            tone="blue"
          />
          <ResultMetric
            label="YTD Actual Saving"
            value={formatCurrency(Math.round(data.summary.ytdActualSaving), currency)}
            detail={`${data.summary.confirmedMonths} confirmed month${data.summary.confirmedMonths === 1 ? "" : "s"}`}
            tone="emerald"
          />
          <ResultMetric
            label="Volume Variance"
            value={`${formatSignedVolume(data.summary.ytdVarianceQty)} ${volumeUnit}`}
            detail={formatSignedCurrency(data.summary.ytdVarianceSaving, currency)}
            tone={data.summary.ytdVarianceQty >= 0 ? "emerald" : "rose"}
          />
        </CardContent>
      </Card>

      {loading ? (
        <ResultsLoadingSkeleton />
      ) : data.summary.hasData ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-[var(--border)] bg-[var(--surface-elevated)]/65">
              <CardTitle>Monthly Volume Performance</CardTitle>
              <CardDescription>
                Forecast versus actual consumption by month.
              </CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartRows}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="period" tickLine={false} axisLine={false} tick={{ fill: "#6B7280", fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "#6B7280", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, borderColor: "#E5E7EB", fontSize: 12 }}
                    formatter={(value: number, name: string) => [
                      `${formatVolume(value)} ${volumeUnit}`,
                      name === "forecastQty" ? "Forecast" : "Actual",
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine x={todayPeriodLabel} stroke="#94A3B8" strokeDasharray="4 4" />
                  <Bar dataKey="forecastQty" name="Forecast" fill="#2563EB" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="actualQty" name="Actual" radius={[8, 8, 0, 0]}>
                    {chartRows.map((row) => (
                      <Cell
                        key={`actual-${row.periodKey}`}
                        fill={row.actualQty >= row.forecastQty ? "#16A34A" : "#DC2626"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="border-b border-[var(--border)] bg-[var(--surface-elevated)]/65">
              <CardTitle>Cumulative Savings S-Curve</CardTitle>
              <CardDescription>
                Cumulative forecast versus actual savings progression.
              </CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartRows}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="period" tickLine={false} axisLine={false} tick={{ fill: "#6B7280", fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "#6B7280", fontSize: 12 }} tickFormatter={(value) => formatVolume(value)} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, borderColor: "#E5E7EB", fontSize: 12 }}
                    formatter={(value: number, name: string) => [
                      formatCurrency(Math.round(value), currency),
                      name === "cumulativeForecast" ? "Cumulative Forecast" : "Cumulative Actual",
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine x={todayPeriodLabel} stroke="#94A3B8" strokeDasharray="4 4" />
                  <Line
                    type="monotone"
                    dataKey="cumulativeForecast"
                    name="Cumulative Forecast"
                    stroke="#2563EB"
                    strokeWidth={3}
                    strokeDasharray="6 4"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="cumulativeActual"
                    name="Cumulative Actual"
                    stroke="#16A34A"
                    strokeWidth={3}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-[var(--border)] bg-[var(--surface-elevated)]/65">
            <CardTitle>No volume data yet</CardTitle>
            <CardDescription>
              Add monthly forecast rows to start tracking forecast versus actual savings impact.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-elevated)]/55 px-4 py-8 text-center">
              <p className="text-sm font-medium text-[var(--foreground)]">
                The result ledger is empty
              </p>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Add monthly forecast periods below to start building realised-versus-forecast visibility for this initiative.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-[var(--border)] bg-[var(--surface-elevated)]/65">
          <CardTitle>Monthly Volume Table</CardTitle>
          <CardDescription>
            Forecast and actual consumption volumes for {materialName}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b bg-white/70">
              <tr>
                {[
                  "Period",
                  `Forecast (${volumeUnit})`,
                  `Actual (${volumeUnit})`,
                  "Forecast Saving",
                  "Actual Saving",
                  "Variance",
                  "Status",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="px-3 py-3 text-left font-semibold text-[var(--muted-foreground)]"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.timeline.length ? (
                data.timeline.map((row) => (
                  <tr key={row.periodKey} className="border-b">
                    <td className="px-3 py-3 font-medium">{row.period}</td>
                    <td className="px-3 py-3">
                      <EditableVolumeCell
                        row={row}
                        field="forecast"
                        editing={editing}
                        saving={saving}
                        onStartEdit={setEditing}
                        onChangeEditing={setEditing}
                        onSave={saveCell}
                        onCancel={() => setEditing(null)}
                        defaultUnit={volumeUnit}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <EditableVolumeCell
                        row={row}
                        field="actual"
                        editing={editing}
                        saving={saving}
                        onStartEdit={setEditing}
                        onChangeEditing={setEditing}
                        onSave={saveCell}
                        onCancel={() => setEditing(null)}
                        defaultUnit={volumeUnit}
                      />
                    </td>
                    <td className="px-3 py-3">{formatCurrency(Math.round(row.forecastSaving), currency)}</td>
                    <td className="px-3 py-3">{formatCurrency(Math.round(row.actualSaving), currency)}</td>
                    <td className="px-3 py-3">
                      <VarianceChip row={row} currency={currency} />
                    </td>
                    <td className="px-3 py-3">
                      {row.actualSource ? (
                        <Badge tone="emerald">Confirmed</Badge>
                      ) : row.forecastSource ? (
                        <Badge tone="blue">Forecast only</Badge>
                      ) : (
                        <span className="text-[var(--muted-foreground)]">—</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-8 text-center text-[var(--muted-foreground)]"
                  >
                    No forecast periods have been added yet.
                  </td>
                </tr>
              )}
              <tr className="bg-[var(--muted)]/35">
                <td className="px-3 py-3 font-medium">Add forecast month</td>
                <td className="px-3 py-3">
                  <Input
                    type="month"
                    value={draftPeriod}
                    onChange={(event) => setDraftPeriod(event.target.value)}
                    className="min-w-[170px]"
                  />
                </td>
                <td className="px-3 py-3">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={`Forecast ${volumeUnit}`}
                    value={draftForecastQty}
                    onChange={(event) => setDraftForecastQty(event.target.value)}
                  />
                </td>
                <td className="px-3 py-3 text-[var(--muted-foreground)]" colSpan={3}>
                  Add a new month to start tracking forecast and actual consumption.
                </td>
                <td className="px-3 py-3 text-right">
                  <Button type="button" size="sm" onClick={addForecastPeriod} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Add
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--surface-elevated)]/65">
          <div>
            <CardTitle>CSV Import</CardTitle>
            <CardDescription>
              Upload monthly forecast and actual volumes from CSV or Excel.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setImportOpen((open) => !open)}
          >
            {importOpen ? "Hide" : "Show"}
            <ChevronDown className={`ml-2 h-4 w-4 transition ${importOpen ? "rotate-180" : ""}`} />
          </Button>
        </CardHeader>

        {importOpen ? (
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={downloadTemplate}>
                <Download className="mr-2 h-4 w-4" />
                Download template
              </Button>
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
              >
                {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                Upload file
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void uploadImportFile(file);
                  }
                  event.target.value = "";
                }}
              />
            </div>

            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                const file = event.dataTransfer.files?.[0];
                if (file) {
                  void uploadImportFile(file);
                }
              }}
              className={`rounded-3xl border-2 border-dashed p-8 text-center transition ${
                dragging
                  ? "border-[var(--primary)] bg-[var(--muted)]"
                  : "border-[var(--border)] bg-white/60"
              }`}
            >
              <UploadCloud className="mx-auto mb-3 h-8 w-8 text-[var(--muted-foreground)]" />
              <p className="text-sm font-medium">
                Drag and drop a CSV or Excel file here
              </p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                Accepted headers: Period, Forecast, Actual, Unit
              </p>
            </div>

            {importResult ? (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/45 p-4 text-sm">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="font-medium">{importResult.imported} imported</span>
                  <span className="font-medium">{importResult.rejected} rejected</span>
                </div>
                {importResult.errors.length ? (
                  <ul className="mt-3 space-y-1 text-[var(--muted-foreground)]">
                    {importResult.errors.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-[var(--muted-foreground)]">
                    Import completed without row errors.
                  </p>
                )}
              </div>
            ) : null}
          </CardContent>
        ) : null}
      </Card>
    </div>
  );
}

function EditableVolumeCell({
  row,
  field,
  editing,
  saving,
  onStartEdit,
  onChangeEditing,
  onSave,
  onCancel,
  defaultUnit,
}: {
  row: VolumeTimelineRow;
  field: EditableField;
  editing: EditingCell | null;
  saving: boolean;
  onStartEdit: (cell: EditingCell) => void;
  onChangeEditing: (cell: EditingCell | null) => void;
  onSave: (cell: EditingCell) => Promise<void>;
  onCancel: () => void;
  defaultUnit: string;
}) {
  const isActualField = field === "actual";
  const hasValue = isActualField ? Boolean(row.actualSource) : Boolean(row.forecastSource);
  const value = isActualField ? row.actualQty : row.forecastQty;
  const isEditing = editing?.periodKey === row.periodKey && editing?.field === field;

  if (isActualField && row.isFuture) {
    return <span className="text-[var(--muted-foreground)]">—</span>;
  }

  if (isEditing && editing) {
    return (
      <Input
        autoFocus
        type="number"
        step="0.01"
        min="0"
        value={editing.value}
        onChange={(event) =>
          onChangeEditing({
            ...editing,
            value: event.target.value,
          })
        }
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void onSave(editing);
          }

          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
        disabled={saving}
        placeholder={defaultUnit}
        className="h-9"
      />
    );
  }

  return (
    <button
      type="button"
      className="inline-flex min-h-9 items-center rounded-lg px-2 py-1 text-left transition hover:bg-[var(--muted)]"
      onClick={() =>
        onStartEdit({
          periodKey: row.periodKey,
          field,
          value: hasValue ? String(value) : "",
        })
      }
    >
      {hasValue ? formatVolume(value) : <span className="text-[var(--muted-foreground)]">Click to add</span>}
    </button>
  );
}

function ResultMetric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "slate" | "blue" | "emerald" | "rose";
}) {
  const toneClass =
    tone === "blue"
      ? "text-blue-700"
      : tone === "emerald"
        ? "text-emerald-700"
        : tone === "rose"
          ? "text-rose-700"
          : "text-slate-700";

  return (
    <Card className="border-[var(--border)] bg-[var(--surface)] shadow-none">
      <CardContent className="space-y-2">
        <p className="text-[11px] font-semibold text-[var(--muted-foreground)]">
          {label}
        </p>
        <p className={`text-2xl font-semibold tracking-tight ${toneClass}`}>{value}</p>
        <p className="text-sm text-[var(--muted-foreground)]">{detail}</p>
      </CardContent>
    </Card>
  );
}

function VarianceChip({
  row,
  currency,
}: {
  row: VolumeTimelineRow;
  currency: "EUR" | "USD";
}) {
  const positive = row.varianceSaving >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  const toneClass = positive ? "text-emerald-700" : "text-rose-700";

  return (
    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${positive ? "bg-emerald-50" : "bg-rose-50"} ${toneClass}`}>
      <Icon className="h-3.5 w-3.5" />
      <span>
        {formatSignedCurrency(row.varianceSaving, currency)}
        {row.variancePercent !== null ? ` (${formatSignedPercent(row.variancePercent)})` : ""}
      </span>
    </div>
  );
}

function ResultsLoadingSkeleton() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="space-y-3">
              <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
              <div className="h-8 w-36 animate-pulse rounded bg-slate-200" />
              <div className="h-3 w-32 animate-pulse rounded bg-slate-200" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="h-80 animate-pulse rounded-2xl bg-slate-100" />
          </Card>
        ))}
      </div>
    </div>
  );
}

function formatVolume(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatSignedCurrency(value: number, currency: "EUR" | "USD") {
  const absolute = formatCurrency(Math.round(Math.abs(value)), currency);
  if (value === 0) {
    return absolute;
  }

  return `${value > 0 ? "+" : "-"}${absolute}`;
}

function formatSignedPercent(value: number) {
  const absolute = Math.abs(value).toFixed(1);
  if (value === 0) {
    return "0.0%";
  }

  return `${value > 0 ? "+" : "-"}${absolute}%`;
}

function formatSignedVolume(value: number) {
  const absolute = formatVolume(Math.abs(value));
  if (value === 0) {
    return absolute;
  }

  return `${value > 0 ? "+" : "-"}${absolute}`;
}

function getCurrentPeriodLabel() {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date());
}
