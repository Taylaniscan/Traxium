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
  actualSaving: number | null;
  cumulativeForecast: number;
  cumulativeActual: number | null;
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
    let canceled = false;

    async function load() {
      if (!cards.length) {
        setRows([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        cards.forEach((card) => params.append("cardId", card.id));
        const response = await fetch(`/api/volume/portfolio?${params.toString()}`, {
          cache: "no-store",
        });
        const result = (await response.json().catch(() => null)) as
          | { timelines?: VolumeTimelineResult[]; error?: string }
          | null;

        if (!response.ok) {
          throw new Error(result?.error ?? "Volume timeline could not be loaded.");
        }

        if (canceled) {
          return;
        }

        const successful = result?.timelines ?? [];

        const monthlyMap = new Map<
          string,
          {
            period: string;
            periodKey: string;
            forecastSaving: number;
            actualSaving: number;
            hasActual: boolean;
          }
        >();

        for (const timeline of successful) {
          for (const row of timeline.timeline) {
            const current = monthlyMap.get(row.periodKey) ?? {
              period: row.period,
              periodKey: row.periodKey,
              forecastSaving: 0,
              actualSaving: 0,
              hasActual: false,
            };

            current.forecastSaving += row.forecastSaving;
            if (row.isConfirmed) {
              current.actualSaving += row.actualSaving;
              current.hasActual = true;
            }
            monthlyMap.set(row.periodKey, current);
          }
        }

        let cumulativeForecast = 0;
        let cumulativeActual = 0;
        const nextRows = Array.from(monthlyMap.values())
          .sort((a, b) => a.periodKey.localeCompare(b.periodKey))
          .map((row) => {
            cumulativeForecast += row.forecastSaving;
            if (row.hasActual) {
              cumulativeActual += row.actualSaving;
            }

            return {
              period: row.period,
              periodKey: row.periodKey,
              forecastSaving: row.forecastSaving,
              actualSaving: row.hasActual ? row.actualSaving : null,
              cumulativeForecast,
              cumulativeActual: row.hasActual ? cumulativeActual : null,
            };
          });

        setRows(nextRows);
      } catch (loadError) {
        if (!canceled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Volume S-curve could not be loaded."
          );
          setRows([]);
        }
      } finally {
        if (!canceled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      canceled = true;
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
          <div className="h-[520px] skeleton-shimmer rounded-3xl" />
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
            Portfolio-level monthly savings impact from forecast and confirmed actual volumes.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer
            width="100%"
            height="100%"
            initialDimension={{ width: 640, height: 320 }}
          >
            <AreaChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
              <XAxis dataKey="period" tickLine={false} axisLine={false} tick={{ fill: "var(--chart-axis)", fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--chart-axis)", fontSize: 12 }} />
              <Tooltip
                contentStyle={{ borderRadius: 12, borderColor: "var(--chart-grid)", backgroundColor: "var(--surface)", boxShadow: "var(--shadow-pop)", fontSize: 12 }}
                formatter={(value, name) => [
                  typeof value === "number" && Number.isFinite(value)
                    ? formatCurrency(Math.round(value), "USD")
                    : "No confirmed actual",
                  name === "forecastSaving" ? "Forecast" : "Actual",
                ]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine x={todayPeriodLabel} stroke="var(--chart-axis)" strokeDasharray="4 4" />
              <Area
                type="monotone"
                dataKey="forecastSaving"
                name="Forecast"
                stroke="var(--primary-action)"
                fill="var(--primary-soft-strong)"
                fillOpacity={0.55}
              />
              <Area
                type="monotone"
                dataKey="actualSaving"
                name="Actual"
                stroke="var(--phase-captured)"
                fill="var(--phase-captured-soft)"
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
            Cumulative forecast and confirmed actual savings progression across the portfolio.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer
            width="100%"
            height="100%"
            initialDimension={{ width: 640, height: 320 }}
          >
            <ComposedChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
              <XAxis dataKey="period" tickLine={false} axisLine={false} tick={{ fill: "var(--chart-axis)", fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--chart-axis)", fontSize: 12 }} />
              <Tooltip
                contentStyle={{ borderRadius: 12, borderColor: "var(--chart-grid)", backgroundColor: "var(--surface)", boxShadow: "var(--shadow-pop)", fontSize: 12 }}
                formatter={(value, name) => [
                  typeof value === "number" && Number.isFinite(value)
                    ? formatCurrency(Math.round(value), "USD")
                    : "No confirmed actual",
                  name === "cumulativeForecast" ? "Cumulative Forecast" : "Cumulative Actual",
                ]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine x={todayPeriodLabel} stroke="var(--chart-axis)" strokeDasharray="4 4" />
              <Line
                type="monotone"
                dataKey="cumulativeForecast"
                name="Cumulative Forecast"
                stroke="var(--primary-action)"
                strokeWidth={3}
                strokeDasharray="6 4"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="cumulativeActual"
                name="Cumulative Actual"
                stroke="var(--phase-captured)"
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
