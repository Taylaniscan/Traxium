"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Filter,
  Target,
  TrendingUp
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { formatCurrency, formatNumber } from "@/lib/utils/numberFormatter";

type CommandCenterData = Awaited<ReturnType<typeof import("@/lib/data").getCommandCenterData>>;
type FilterOptions = Awaited<ReturnType<typeof import("@/lib/data").getCommandCenterFilterOptions>>;

type Filters = {
  categoryId: string;
  businessUnitId: string;
  buyerId: string;
  plantId: string;
  supplierId: string;
};

export function CommandCenterClient({
  initialData,
  filterOptions
}: {
  initialData: CommandCenterData;
  filterOptions: FilterOptions;
}) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    categoryId: initialData.filters.categoryId ?? "",
    businessUnitId: initialData.filters.businessUnitId ?? "",
    buyerId: initialData.filters.buyerId ?? "",
    plantId: initialData.filters.plantId ?? "",
    supplierId: initialData.filters.supplierId ?? ""
  });

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.categoryId) params.set("categoryId", filters.categoryId);
    if (filters.businessUnitId) params.set("businessUnitId", filters.businessUnitId);
    if (filters.buyerId) params.set("buyerId", filters.buyerId);
    if (filters.plantId) params.set("plantId", filters.plantId);
    if (filters.supplierId) params.set("supplierId", filters.supplierId);

    let ignore = false;
    setLoading(true);

    fetch(`/api/command-center?${params.toString()}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((result) => {
        if (!ignore) setData(result);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [filters]);

  const kpis = [
    { label: "Pipeline Savings", value: formatCurrency(data.kpis.totalPipelineSavings, "EUR"), icon: CircleDollarSign, tone: "text-blue-600" },
    { label: "Realised Savings", value: formatCurrency(data.kpis.realisedSavings, "EUR"), icon: TrendingUp, tone: "text-emerald-600" },
    { label: "Achieved Savings", value: formatCurrency(data.kpis.achievedSavings, "EUR"), icon: Target, tone: "text-indigo-600" },
    { label: "Savings Forecast", value: formatCurrency(data.kpis.savingsForecast, "EUR"), icon: ClipboardList, tone: "text-amber-600" },
    { label: "Active Saving Projects", value: formatNumber(data.kpis.activeProjects), icon: CheckCircle2, tone: "text-slate-600" },
    { label: "Pending Approvals", value: formatNumber(data.kpis.pendingApprovals), icon: AlertTriangle, tone: "text-rose-600" }
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle>Global Filters</CardTitle>
            <CardDescription>Filter the command center by ownership, scope, or supplier exposure.</CardDescription>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/60 p-2">
            <Filter className="h-4 w-4 text-[var(--muted-foreground)]" />
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Select value={filters.categoryId} onChange={(event) => setFilters((current) => ({ ...current, categoryId: event.target.value }))}>
            <option value="">All categories</option>
            {filterOptions.categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
          <Select value={filters.businessUnitId} onChange={(event) => setFilters((current) => ({ ...current, businessUnitId: event.target.value }))}>
            <option value="">All business units</option>
            {filterOptions.businessUnits.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
          <Select value={filters.buyerId} onChange={(event) => setFilters((current) => ({ ...current, buyerId: event.target.value }))}>
            <option value="">All buyers</option>
            {filterOptions.buyers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
          <Select value={filters.plantId} onChange={(event) => setFilters((current) => ({ ...current, plantId: event.target.value }))}>
            <option value="">All plants</option>
            {filterOptions.plants.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
          <Select value={filters.supplierId} onChange={(event) => setFilters((current) => ({ ...current, supplierId: event.target.value }))}>
            <option value="">All suppliers</option>
            {filterOptions.suppliers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label}>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="rounded-xl bg-[var(--muted)]/70 p-2">
                    <Icon className={`h-5 w-5 ${kpi.tone}`} />
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
                    {loading ? "Updating" : "Live"}
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-[32px] font-semibold leading-none tracking-tight">{kpi.value}</p>
                  <p className="text-[13px] font-medium text-[var(--muted-foreground)]">{kpi.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Savings Pipeline by Phase</CardTitle>
            <CardDescription>Phase-level visibility across the active and cancelled savings portfolio.</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.pipelineByPhase}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#6B7280", fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatNumber(value)} tick={{ fill: "#6B7280", fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: 12, borderColor: "#E5E7EB", fontSize: 12 }} formatter={(value: number) => formatCurrency(value, "EUR")} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="savings" name="Savings" stackId="total" fill="#2563EB" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Savings Forecast Over Time</CardTitle>
            <CardDescription>Monthly forecast curve derived from impact timing and value realisation patterns.</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.forecastCurve}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "#6B7280", fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatNumber(value)} tick={{ fill: "#6B7280", fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: 12, borderColor: "#E5E7EB", fontSize: 12 }} formatter={(value: number) => formatCurrency(value, "EUR")} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="savings" name="Current Savings" stroke="#2563EB" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="forecast" name="Forecast" stroke="#16A34A" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Top Suppliers by Savings Impact</CardTitle>
            <CardDescription>Supplier exposure ranked by associated savings value.</CardDescription>
          </CardHeader>
          <CardContent className="h-[420px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.topSuppliers} layout="vertical" margin={{ left: 18 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(value) => formatNumber(value)} tick={{ fill: "#6B7280", fontSize: 12 }} />
                <YAxis dataKey="supplier" type="category" width={120} tickLine={false} axisLine={false} tick={{ fill: "#111827", fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: 12, borderColor: "#E5E7EB", fontSize: 12 }} formatter={(value: number) => formatCurrency(value, "EUR")} />
                <Bar dataKey="savings" fill="#1D4ED8" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Savings by Risk Level</CardTitle>
              <CardDescription>Exposure based on the currently selected sourcing alternative risk signal.</CardDescription>
            </CardHeader>
            <CardContent className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.savingsByRiskLevel}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="level" tickLine={false} axisLine={false} tick={{ fill: "#6B7280", fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatNumber(value)} tick={{ fill: "#6B7280", fontSize: 12 }} />
                  <Tooltip contentStyle={{ borderRadius: 12, borderColor: "#E5E7EB", fontSize: 12 }} formatter={(value: number) => formatCurrency(value, "EUR")} />
                  <Bar dataKey="savings" fill="#F59E0B" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Savings by Qualification Status</CardTitle>
              <CardDescription>Validation maturity of the current savings portfolio.</CardDescription>
            </CardHeader>
            <CardContent className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.savingsByQualificationStatus}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="status" tickLine={false} axisLine={false} tick={{ fill: "#6B7280", fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatNumber(value)} tick={{ fill: "#6B7280", fontSize: 12 }} />
                  <Tooltip contentStyle={{ borderRadius: 12, borderColor: "#E5E7EB", fontSize: 12 }} formatter={(value: number) => formatCurrency(value, "EUR")} />
                  <Bar dataKey="savings" fill="#16A34A" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Benchmark Opportunities</CardTitle>
          <CardDescription>High-value opportunities where current price remains above the benchmark scenario.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table className="min-w-[980px] bg-white">
            <TableHead>
              <tr>
                <TableHeaderCell>Material</TableHeaderCell>
                <TableHeaderCell>Supplier</TableHeaderCell>
                <TableHeaderCell>Plant</TableHeaderCell>
                <TableHeaderCell className="text-right">Current Price</TableHeaderCell>
                <TableHeaderCell className="text-right">Benchmark Price</TableHeaderCell>
                <TableHeaderCell className="text-right">Variance %</TableHeaderCell>
                <TableHeaderCell className="text-right">Potential Saving</TableHeaderCell>
                <TableHeaderCell className="text-right">Action</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {data.benchmarkOpportunities.length ? (
                data.benchmarkOpportunities.map((row) => (
                  <TableRow key={row.savingCardId}>
                    <TableCell className="font-medium">{row.material}</TableCell>
                    <TableCell>{row.supplier}</TableCell>
                    <TableCell>{row.plant}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.currentPrice, "EUR")}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.benchmarkPrice, "EUR")}</TableCell>
                    <TableCell className="text-right font-medium">{row.variancePercent.toFixed(1)}%</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(row.potentialSaving, "EUR")}</TableCell>
                    <TableCell className="text-right">
                      <Link href="/saving-cards/new" className="inline-flex h-8 items-center rounded-lg bg-[var(--primary)] px-3 text-xs font-medium text-white hover:bg-[#1d4ed8]">
                        Create Saving Card
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-[var(--muted-foreground)]">
                    No benchmark opportunities match the active filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
