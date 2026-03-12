"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowUpRight, CircleDollarSign, Filter, Target, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { implementationComplexities, phaseLabels, qualificationStatuses, savingDrivers } from "@/lib/constants";
import { formatCurrency, formatNumber } from "@/lib/utils/numberFormatter";

type DashboardData = Awaited<ReturnType<typeof import("@/lib/data").getDashboardData>>;

export function DashboardClient({ data }: { data: DashboardData }) {
  const [filters, setFilters] = useState({
    savingDriver: "",
    implementationComplexity: "",
    qualificationStatus: ""
  });

  const filteredCards = useMemo(
    () =>
      data.cards.filter((card) => {
        if (filters.savingDriver && card.savingDriver !== filters.savingDriver) return false;
        if (filters.implementationComplexity && card.implementationComplexity !== filters.implementationComplexity) return false;
        if (filters.qualificationStatus && card.qualificationStatus !== filters.qualificationStatus) return false;
        return true;
      }),
    [data.cards, filters]
  );

  const metrics = useMemo(() => deriveDashboardMetrics(filteredCards), [filteredCards]);

  const kpis = [
    { label: "Pipeline Savings", value: metrics.pipelineSavings, icon: CircleDollarSign },
    { label: "Realised Savings", value: metrics.realisedSavings, icon: TrendingUp },
    { label: "Achieved Savings", value: metrics.achievedSavings, icon: Target },
    { label: "Savings Forecast", value: metrics.forecastSavings, icon: ArrowUpRight }
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle>Portfolio Filters</CardTitle>
            <CardDescription>Refine the dashboard by driver, implementation effort, or qualification stage.</CardDescription>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/60 p-2">
            <Filter className="h-4 w-4 text-[var(--muted-foreground)]" />
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Select value={filters.savingDriver} onChange={(event) => setFilters((current) => ({ ...current, savingDriver: event.target.value }))}>
            <option value="">All saving drivers</option>
            {savingDrivers.map((driver) => (
              <option key={driver} value={driver}>
                {driver}
              </option>
            ))}
          </Select>
          <Select
            value={filters.implementationComplexity}
            onChange={(event) => setFilters((current) => ({ ...current, implementationComplexity: event.target.value }))}
          >
            <option value="">All implementation complexity</option>
            {implementationComplexities.map((complexity) => (
              <option key={complexity} value={complexity}>
                {complexity}
              </option>
            ))}
          </Select>
          <Select
            value={filters.qualificationStatus}
            onChange={(event) => setFilters((current) => ({ ...current, qualificationStatus: event.target.value }))}
          >
            <option value="">All qualification statuses</option>
            {qualificationStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label}>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="rounded-xl bg-blue-50 p-2 text-[var(--primary)]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted-foreground)]">KPI</span>
                </div>
                <div className="space-y-1">
                  <p className="text-[32px] font-semibold leading-none tracking-tight text-[var(--foreground)]">{formatCurrency(kpi.value, "EUR")}</p>
                  <p className="text-[13px] font-medium text-[var(--muted-foreground)]">{kpi.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <ChartCard title="Savings by Category" description="Contribution by procurement category." data={metrics.byCategory} color="#2563EB" />
        <ChartCard title="Savings by Driver" description="Savings grouped by initiative driver." data={metrics.byDriver} color="#1D4ED8" />
        <ForecastCard data={metrics.monthlyTrend} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <TableCard
          title="Top Saving Projects"
          description="Highest-value saving cards in the current filtered portfolio."
          rows={metrics.topProjects}
        />
        <TableCard
          title="Benchmark Opportunities"
          description="Cards with open commercial headroom based on remaining baseline-to-new price gap."
          rows={metrics.benchmarkOpportunities}
        />
      </div>
    </div>
  );
}

function ChartCard({
  title,
  description,
  data,
  color
}: {
  title: string;
  description: string;
  data: Array<{ label: string; savings: number }>;
  color: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#6B7280", fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatNumber(value)} tick={{ fill: "#6B7280", fontSize: 12 }} />
            <Tooltip
              cursor={{ fill: "rgba(37, 99, 235, 0.06)" }}
              contentStyle={{ borderRadius: 12, borderColor: "#E5E7EB", fontSize: 12 }}
              formatter={(value: number) => formatCurrency(value, "EUR")}
            />
            <Bar dataKey="savings" fill={color} radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function ForecastCard({ data }: { data: Array<{ month: string; savings: number; forecast: number }> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Savings Forecast</CardTitle>
        <CardDescription>Current savings run-rate versus forecast pipeline contribution.</CardDescription>
      </CardHeader>
      <CardContent className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "#6B7280", fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatNumber(value)} tick={{ fill: "#6B7280", fontSize: 12 }} />
            <Tooltip
              cursor={{ stroke: "#2563EB", strokeOpacity: 0.18 }}
              contentStyle={{ borderRadius: 12, borderColor: "#E5E7EB", fontSize: 12 }}
              formatter={(value: number) => formatCurrency(value, "EUR")}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: "#6B7280" }} />
            <Line type="monotone" dataKey="savings" name="Savings" stroke="#2563EB" strokeWidth={3} dot={false} />
            <Line type="monotone" dataKey="forecast" name="Forecast" stroke="#16A34A" strokeWidth={3} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function TableCard({
  title,
  description,
  rows
}: {
  title: string;
  description: string;
  rows: Array<{ title: string; category: string; phase: string; value: number }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHead>
            <tr>
              <TableHeaderCell>Project</TableHeaderCell>
              <TableHeaderCell>Category</TableHeaderCell>
              <TableHeaderCell>Phase</TableHeaderCell>
              <TableHeaderCell className="text-right">Value</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {rows.length ? (
              rows.map((row) => (
                <TableRow key={`${row.title}-${row.phase}`}>
                  <TableCell className="font-medium">{row.title}</TableCell>
                  <TableCell>{row.category}</TableCell>
                  <TableCell>{row.phase}</TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(row.value, "EUR")}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell className="py-8 text-[var(--muted-foreground)]" colSpan={4}>
                  No saving cards match the active filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function deriveDashboardMetrics(cards: DashboardData["cards"]) {
  const pipelineSavings = cards.filter((card) => card.phase !== "CANCELLED").reduce((sum, card) => sum + card.calculatedSavings, 0);
  const realisedSavings = cards.filter((card) => card.phase === "REALISED").reduce((sum, card) => sum + card.calculatedSavings, 0);
  const achievedSavings = cards.filter((card) => card.phase === "ACHIEVED").reduce((sum, card) => sum + card.calculatedSavings, 0);

  const monthlyTrend = Object.values(
    cards.reduce<Record<string, { month: string; savings: number; forecast: number }>>((acc, card) => {
      const key = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(card.impactStartDate));
      acc[key] ??= { month: key, savings: 0, forecast: 0 };
      acc[key].savings += card.calculatedSavings;
      acc[key].forecast += card.calculatedSavings * getForecastFactor(card.frequency);
      return acc;
    }, {})
  );

  return {
    pipelineSavings,
    realisedSavings,
    achievedSavings,
    forecastSavings: monthlyTrend.reduce((sum, item) => sum + item.forecast, 0),
    monthlyTrend,
    byCategory: groupSavings(cards, (card) => card.category.name),
    byDriver: groupSavings(cards, (card) => card.savingDriver ?? "Unspecified"),
    topProjects: [...cards]
      .sort((a, b) => b.calculatedSavings - a.calculatedSavings)
      .slice(0, 5)
      .map((card) => ({
        title: card.title,
        category: card.category.name,
        phase: phaseLabels[card.phase],
        value: card.calculatedSavings
      })),
    benchmarkOpportunities: [...cards]
      .map((card) => ({
        title: card.title,
        category: card.category.name,
        phase: phaseLabels[card.phase],
        value: Math.max((card.baselinePrice - card.newPrice) * card.annualVolume, 0)
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
  };
}

function groupSavings(cards: DashboardData["cards"], getLabel: (card: DashboardData["cards"][number]) => string) {
  return Object.values(
    cards.reduce<Record<string, { label: string; savings: number }>>((acc, card) => {
      const key = getLabel(card);
      acc[key] ??= { label: key, savings: 0 };
      acc[key].savings += card.calculatedSavings;
      return acc;
    }, {})
  );
}

function getForecastFactor(frequency: DashboardData["cards"][number]["frequency"]) {
  switch (frequency) {
    case "ONE_TIME":
      return 1;
    case "MULTI_YEAR":
      return 1.6;
    default:
      return 1.2;
  }
}
