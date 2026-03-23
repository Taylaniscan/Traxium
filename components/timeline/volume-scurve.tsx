"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SavingCardPortfolio, VolumeTimelineResult } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/numberFormatter";

type AggregatedRow = {
  period: string;
  periodKey: string;
  forecastSaving: number;
  actualSaving: number;
  cumulativeForecast: number;
  cumulativeActual: number;
};

export function VolumeSCurve({
  cards,
  nowIso,
}: {
  cards: SavingCardPortfolio[];
  nowIso: string;
}) {
  const [rows, setRows] = useState<AggregatedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!cards.length) {
        setRows([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const responses = await Promise.allSettled(
          cards.map((card) =>
            fetch(`/api/saving-cards/${card.id}/volume`, {
              cache: "no-store",
            }).then(async (response) => {
              const result = await response.json().catch(() => null);

              if (!response.ok) {
                throw new Error(result?.error ?? "Volume timeline could not be loaded.");
              }

              return result as VolumeTimelineResult;
            })
          )
        );

        if (cancelled) {
          return;
        }

        const successful = responses
          .filter((result): result is PromiseFulfilledResult<VolumeTimelineResult> => result.status === "fulfilled")
          .map((result) => result.value);

        const monthlyMap = new Map<
          string,
          { period: string; periodKey: string; forecastSaving: number; actualSaving: number }
        >();

        for (const timeline of successful) {
          for (const row of timeline.timeline) {
            const current = monthlyMap.get(row.periodKey) ?? {
              period: row.period,
              periodKey: row.periodKey,
              forecastSaving: 0,
              actualSaving: 0,
            };

            current.forecastSaving += row.forecastSaving;
            current.actualSaving += row.actualSaving;
            monthlyMap.set(row.periodKey, current);
          }
        }

        let cumulativeForecast = 0;
        let cumulativeActual = 0;
        const nextRows = Array.from(monthlyMap.values())
          .sort((a, b) => a.periodKey.localeCompare(b.periodKey))
          .map((row) => {
            cumulativeForecast += row.forecastSaving;
            cumulativeActual += row.actualSaving;

            return {
              ...row,
              cumulativeForecast,
              cumulativeActual,
            };
          });

        setRows(nextRows);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Volume S-curve could not be loaded."
          );
          setRows([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [cards]);

  const todayPeriodLabel = useMemo(() => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(nowIso));
  }, [nowIso]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Volume S-Curve</CardTitle>
          <CardDescription>Loading portfolio volume performance.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[520px] animate-pulse rounded-3xl bg-slate-100" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Volume S-Curve</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!rows.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Volume S-Curve</CardTitle>
          <CardDescription>
            No saving card has volume forecast or actual data yet.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Monthly Forecast vs Actual</CardTitle>
          <CardDescription>
            Portfolio-level monthly savings impact from forecast and actual volumes.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="period" tickLine={false} axisLine={false} tick={{ fill: "#6B7280", fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: "#6B7280", fontSize: 12 }} />
              <Tooltip
                contentStyle={{ borderRadius: 12, borderColor: "#E5E7EB", fontSize: 12 }}
                formatter={(value: number, name: string) => [
                  formatCurrency(Math.round(value), "EUR"),
                  name === "forecastSaving" ? "Forecast" : "Actual",
                ]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine x={todayPeriodLabel} stroke="#94A3B8" strokeDasharray="4 4" />
              <Area
                type="monotone"
                dataKey="forecastSaving"
                name="Forecast"
                stroke="#2563EB"
                fill="#93C5FD"
                fillOpacity={0.55}
              />
              <Area
                type="monotone"
                dataKey="actualSaving"
                name="Actual"
                stroke="#16A34A"
                fill="#86EFAC"
                fillOpacity={0.45}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cumulative Volume S-Curve</CardTitle>
          <CardDescription>
            Cumulative forecast and actual savings progression across the portfolio.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="period" tickLine={false} axisLine={false} tick={{ fill: "#6B7280", fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: "#6B7280", fontSize: 12 }} />
              <Tooltip
                contentStyle={{ borderRadius: 12, borderColor: "#E5E7EB", fontSize: 12 }}
                formatter={(value: number, name: string) => [
                  formatCurrency(Math.round(value), "EUR"),
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
  );
}
