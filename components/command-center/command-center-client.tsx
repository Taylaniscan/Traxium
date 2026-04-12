"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowRight,
  Clock3,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Filter,
  LockKeyhole,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import type {
  CommandCenterActivityItem,
  CommandCenterAttentionItem,
  CommandCenterApiError,
  CommandCenterData,
  CommandCenterDecisionItem,
  CommandCenterFilterOptions,
  CommandCenterFilters,
  CommandCenterPendingApprovalItem,
  CommandCenterResolvedFilters,
  WorkspaceReadiness,
} from "@/lib/types";
import {
  commandCenterFilterKeys,
  emptyCommandCenterFilters,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber } from "@/lib/utils/numberFormatter";

export type CommandCenterClientLoadState = {
  dataError?: string | null;
  filterOptionsError?: string | null;
  readinessError?: string | null;
};

type CommandCenterDataWarning = {
  hasInvalidPipelineValues: boolean;
  hasInvalidForecastValues: boolean;
  hasInvalidSupplierValues: boolean;
};

type ChartState = "loading" | "empty" | "error" | "ready";
type CommandCenterSectionId =
  | "analytics"
  | "pending-approvals"
  | "quick-actions"
  | "overdue-items"
  | "finance-locked-items"
  | "recent-decisions"
  | "recent-record-activity";

function isDevelopment() {
  return process.env.NODE_ENV !== "production";
}

function normalizeCommandCenterNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeCommandCenterLabel(value: unknown, fallback: string) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || fallback;
}

function normalizeCommandCenterTimestamp(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function normalizeCommandCenterStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeCommandCenterLabel(item, ""))
    .filter(Boolean);
}

export function normalizeCommandCenterData(
  data: CommandCenterData
): CommandCenterData {
  return {
    filters: {
      ...emptyCommandCenterFilters,
      ...data.filters,
    },
    kpis: {
      totalPipelineSavings: normalizeCommandCenterNumber(
        data.kpis.totalPipelineSavings
      ),
      realisedSavings: normalizeCommandCenterNumber(data.kpis.realisedSavings),
      achievedSavings: normalizeCommandCenterNumber(data.kpis.achievedSavings),
      savingsForecast: normalizeCommandCenterNumber(data.kpis.savingsForecast),
      activeProjects: normalizeCommandCenterNumber(data.kpis.activeProjects),
      pendingApprovals: normalizeCommandCenterNumber(data.kpis.pendingApprovals),
    },
    pipelineByPhase: data.pipelineByPhase.map((item) => ({
      phase: normalizeCommandCenterLabel(item.phase, "UNKNOWN"),
      label: normalizeCommandCenterLabel(item.label, "Unknown phase"),
      savings: normalizeCommandCenterNumber(item.savings),
    })),
    forecastCurve: data.forecastCurve.map((item) => ({
      month: normalizeCommandCenterLabel(item.month, "Unknown timing"),
      savings: normalizeCommandCenterNumber(item.savings),
      forecast: normalizeCommandCenterNumber(item.forecast),
    })),
    topSuppliers: data.topSuppliers.map((item) => ({
      supplier: normalizeCommandCenterLabel(item.supplier, "Unknown supplier"),
      savings: normalizeCommandCenterNumber(item.savings),
    })),
    savingsByRiskLevel: data.savingsByRiskLevel.map((item) => ({
      level: normalizeCommandCenterLabel(item.level, "Unrated"),
      savings: normalizeCommandCenterNumber(item.savings),
    })),
    savingsByQualificationStatus: data.savingsByQualificationStatus.map(
      (item) => ({
        status: normalizeCommandCenterLabel(item.status, "Unspecified"),
        savings: normalizeCommandCenterNumber(item.savings),
      })
    ),
    pendingApprovalQueue: (data.pendingApprovalQueue ?? []).map((item) => ({
      requestId: normalizeCommandCenterLabel(item.requestId, "unknown-request"),
      savingCardId: normalizeCommandCenterLabel(item.savingCardId, "unknown-card"),
      savingCardTitle: normalizeCommandCenterLabel(item.savingCardTitle, "Unknown saving card"),
      currentPhase: normalizeCommandCenterLabel(item.currentPhase, "Unknown phase"),
      requestedPhase: normalizeCommandCenterLabel(item.requestedPhase, "Unknown phase"),
      requestedByName: normalizeCommandCenterLabel(item.requestedByName, "Unknown requester"),
      requestedByRole: normalizeCommandCenterLabel(item.requestedByRole, "Unknown role"),
      createdAt: normalizeCommandCenterTimestamp(item.createdAt),
      ageDays: normalizeCommandCenterNumber(item.ageDays),
      isOverdue: Boolean(item.isOverdue),
      pendingApproverCount: normalizeCommandCenterNumber(item.pendingApproverCount),
      pendingApproverRoles: normalizeCommandCenterStringList(item.pendingApproverRoles),
      savings: normalizeCommandCenterNumber(item.savings),
      financeLocked: Boolean(item.financeLocked),
    })),
    overdueItems: (data.overdueItems ?? []).map((item) => ({
      savingCardId: normalizeCommandCenterLabel(item.savingCardId, "unknown-card"),
      title: normalizeCommandCenterLabel(item.title, "Unknown saving card"),
      phase: normalizeCommandCenterLabel(item.phase, "Unknown phase"),
      buyerName: normalizeCommandCenterLabel(item.buyerName, "Unknown buyer"),
      categoryName: normalizeCommandCenterLabel(item.categoryName, "Unknown category"),
      dateLabel: normalizeCommandCenterLabel(item.dateLabel, "Date"),
      dateValue: normalizeCommandCenterTimestamp(item.dateValue),
      ageDays: normalizeCommandCenterNumber(item.ageDays),
      savings: normalizeCommandCenterNumber(item.savings),
      financeLocked: Boolean(item.financeLocked),
    })),
    financeLockedItems: (data.financeLockedItems ?? []).map((item) => ({
      savingCardId: normalizeCommandCenterLabel(item.savingCardId, "unknown-card"),
      title: normalizeCommandCenterLabel(item.title, "Unknown saving card"),
      phase: normalizeCommandCenterLabel(item.phase, "Unknown phase"),
      buyerName: normalizeCommandCenterLabel(item.buyerName, "Unknown buyer"),
      categoryName: normalizeCommandCenterLabel(item.categoryName, "Unknown category"),
      dateLabel: normalizeCommandCenterLabel(item.dateLabel, "Date"),
      dateValue: normalizeCommandCenterTimestamp(item.dateValue),
      ageDays: normalizeCommandCenterNumber(item.ageDays),
      savings: normalizeCommandCenterNumber(item.savings),
      financeLocked: Boolean(item.financeLocked),
    })),
    recentDecisions: (data.recentDecisions ?? []).map((item) => ({
      approvalId: normalizeCommandCenterLabel(item.approvalId, "unknown-approval"),
      savingCardId: normalizeCommandCenterLabel(item.savingCardId, "unknown-card"),
      savingCardTitle: normalizeCommandCenterLabel(item.savingCardTitle, "Unknown saving card"),
      phase: normalizeCommandCenterLabel(item.phase, "Unknown phase"),
      approverName: normalizeCommandCenterLabel(item.approverName, "Unknown approver"),
      approverRole: normalizeCommandCenterLabel(item.approverRole, "Unknown role"),
      status: normalizeCommandCenterLabel(item.status, "Unknown"),
      approved: Boolean(item.approved),
      createdAt: normalizeCommandCenterTimestamp(item.createdAt),
      comment: typeof item.comment === "string" ? item.comment : null,
    })),
    recentActivity: (data.recentActivity ?? []).map((item) => ({
      savingCardId: normalizeCommandCenterLabel(item.savingCardId, "unknown-card"),
      savingCardTitle: normalizeCommandCenterLabel(item.savingCardTitle, "Unknown saving card"),
      phase: normalizeCommandCenterLabel(item.phase, "Unknown phase"),
      buyerName: normalizeCommandCenterLabel(item.buyerName, "Unknown buyer"),
      categoryName: normalizeCommandCenterLabel(item.categoryName, "Unknown category"),
      updatedAt: normalizeCommandCenterTimestamp(item.updatedAt),
      financeLocked: Boolean(item.financeLocked),
      savings: normalizeCommandCenterNumber(item.savings),
    })),
  };
}

export function hasMeaningfulCommandCenterData(data: CommandCenterData) {
  return (
    data.kpis.totalPipelineSavings > 0 ||
    data.kpis.realisedSavings > 0 ||
    data.kpis.achievedSavings > 0 ||
    data.kpis.savingsForecast > 0 ||
    data.kpis.activeProjects > 0 ||
    data.kpis.pendingApprovals > 0 ||
    (data.pendingApprovalQueue?.length ?? 0) > 0 ||
    (data.overdueItems?.length ?? 0) > 0 ||
    (data.financeLockedItems?.length ?? 0) > 0 ||
    (data.recentDecisions?.length ?? 0) > 0 ||
    data.pipelineByPhase.some((item) => item.savings > 0) ||
    data.forecastCurve.some((item) => item.savings > 0 || item.forecast > 0) ||
    data.topSuppliers.some((item) => item.savings > 0)
  );
}

function inspectCommandCenterData(
  data: CommandCenterData
): CommandCenterDataWarning {
  return {
    hasInvalidPipelineValues: data.pipelineByPhase.some(
      (item) =>
        typeof item.savings !== "number" || !Number.isFinite(item.savings)
    ),
    hasInvalidForecastValues: data.forecastCurve.some(
      (item) =>
        typeof item.savings !== "number" ||
        !Number.isFinite(item.savings) ||
        typeof item.forecast !== "number" ||
        !Number.isFinite(item.forecast)
    ),
    hasInvalidSupplierValues: data.topSuppliers.some(
      (item) =>
        typeof item.savings !== "number" || !Number.isFinite(item.savings)
    ),
  };
}

function resolveChartState(
  points: ReadonlyArray<Record<string, unknown>>,
  keys: readonly string[]
) {
  const hasData = points.some((point) =>
    keys.some((key) => normalizeCommandCenterNumber(point[key]) > 0)
  );

  return hasData ? ("ready" as const) : ("empty" as const);
}

export function CommandCenterClient({
  initialData,
  filterOptions,
  readiness,
  loadState,
}: {
  initialData: CommandCenterData;
  filterOptions: CommandCenterFilterOptions;
  readiness?: WorkspaceReadiness | null;
  loadState?: CommandCenterClientLoadState;
}) {
  const [data, setData] = useState(() => normalizeCommandCenterData(initialData));
  const [filters, setFilters] = useState<CommandCenterResolvedFilters>(() => ({
    ...emptyCommandCenterFilters,
    ...initialData.filters,
  }));
  const [activeSection, setActiveSection] =
    useState<CommandCenterSectionId>("analytics");
  const [isLoading, setIsLoading] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const initialRenderRef = useRef(true);

  const dataError = loadState?.dataError?.trim() || null;
  const filterOptionsError = loadState?.filterOptionsError?.trim() || null;
  const readinessError = loadState?.readinessError?.trim() || null;
  const safeData = useMemo(() => normalizeCommandCenterData(data), [data]);
  const hasMeaningfulData = hasMeaningfulCommandCenterData(safeData);
  const hasActiveFilters = Object.values(filters).some(Boolean);
  const pendingApprovalQueue = safeData.pendingApprovalQueue ?? [];
  const overdueItems = safeData.overdueItems ?? [];
  const financeLockedItems = safeData.financeLockedItems ?? [];
  const recentDecisions = safeData.recentDecisions ?? [];
  const recentActivity = safeData.recentActivity ?? [];
  const overdueApprovalCount = pendingApprovalQueue.filter((item) => item.isOverdue).length;
  const sectionTabs: Array<{
    id: CommandCenterSectionId;
    label: string;
    count?: number;
  }> = [
    { id: "analytics", label: "Analytics & Trend Context" },
    {
      id: "pending-approvals",
      label: "Pending Approvals",
      count: safeData.kpis.pendingApprovals,
    },
    { id: "quick-actions", label: "Quick Actions" },
    { id: "overdue-items", label: "Overdue Items", count: overdueItems.length },
    {
      id: "finance-locked-items",
      label: "Finance Locked Items",
      count: financeLockedItems.length,
    },
    {
      id: "recent-decisions",
      label: "Recent Decisions",
      count: recentDecisions.length,
    },
    {
      id: "recent-record-activity",
      label: "Recent Record Activity",
      count: recentActivity.length,
    },
  ];
  const debugInfo = inspectCommandCenterData(initialData);
  const showDevWarning =
    isDevelopment() &&
    (debugInfo.hasInvalidPipelineValues ||
      debugInfo.hasInvalidForecastValues ||
      debugInfo.hasInvalidSupplierValues);

  useEffect(() => {
    if (initialRenderRef.current) {
      initialRenderRef.current = false;
      return;
    }

    let ignore = false;

    setIsLoading(true);
    setRefreshError(null);

    fetchCommandCenterData(filters)
      .then((result) => {
        if (!ignore) {
          setData(normalizeCommandCenterData(result));
        }
      })
      .catch((error) => {
        if (!ignore) {
          setRefreshError(
            error instanceof Error
              ? error.message
              : "Command center refresh failed."
          );
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [filters]);

  return (
    <div className="space-y-6">
      {readinessError ? (
        <InlineNotice
          title="Workspace setup status is temporarily unavailable"
          description={readinessError}
        />
      ) : null}
      {filterOptionsError ? (
        <InlineNotice
          title="Command center filters are temporarily unavailable"
          description={filterOptionsError}
        />
      ) : null}
      {refreshError ? (
        <InlineNotice
          title="Command center refresh failed"
          description={refreshError}
          tone="error"
        />
      ) : null}
      {showDevWarning ? (
        <InlineNotice
          title="Development data warning"
          description="Some command center inputs were invalid and were normalized locally so the charts can still render."
        />
      ) : null}
      {isLoading ? (
        <InlineNotice
          title="Updating command center"
          description="Refreshing analytics for the active filters."
        />
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-[var(--border)] bg-[var(--surface-elevated)]/65">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle>Global Filters</CardTitle>
              <CardDescription>
                Narrow the action queue and portfolio context by category, ownership, or supplier.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={hasActiveFilters ? "teal" : "slate"}>
                {hasActiveFilters ? "Filtered view" : "Full portfolio"}
              </Badge>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/50 p-2">
                <Filter className="h-4 w-4 text-[var(--muted-foreground)]" />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
          <FilterField label="Category">
            <Select
              value={filters.categoryId}
              disabled={Boolean(filterOptionsError)}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  categoryId: event.target.value,
                }))
              }
            >
              <option value="">All categories</option>
              {filterOptions.categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="Business Unit">
            <Select
              value={filters.businessUnitId}
              disabled={Boolean(filterOptionsError)}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  businessUnitId: event.target.value,
                }))
              }
            >
              <option value="">All business units</option>
              {filterOptions.businessUnits.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="Buyer">
            <Select
              value={filters.buyerId}
              disabled={Boolean(filterOptionsError)}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  buyerId: event.target.value,
                }))
              }
            >
              <option value="">All buyers</option>
              {filterOptions.buyers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="Plant">
            <Select
              value={filters.plantId}
              disabled={Boolean(filterOptionsError)}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  plantId: event.target.value,
                }))
              }
            >
              <option value="">All plants</option>
              {filterOptions.plants.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="Supplier">
            <Select
              value={filters.supplierId}
              disabled={Boolean(filterOptionsError)}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  supplierId: event.target.value,
                }))
              }
            >
              <option value="">All suppliers</option>
              {filterOptions.suppliers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </FilterField>
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              disabled={!hasActiveFilters}
              onClick={() => setFilters(emptyCommandCenterFilters)}
              className="w-full"
            >
              Clear filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {dataError ? (
        <StateCard
          title="Command center charts are unavailable"
          description={dataError}
          action={
            <Link
              href="/command-center"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Refresh command center
            </Link>
          }
        />
      ) : !hasMeaningfulData ? (
        <StateCard
          title={
            hasActiveFilters
              ? "No command-center data matches the current view"
              : "No live command-center data yet"
          }
          description={
            hasActiveFilters
              ? "Clear the active filters to return to the full command-center view."
              : "Create and progress saving cards so the command center has real portfolio data to display."
          }
          action={
            hasActiveFilters ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setFilters(emptyCommandCenterFilters)}
              >
                Clear filters
              </Button>
            ) : (
              <Link
                href="/saving-cards/new"
                className={buttonVariants({ size: "sm" })}
              >
                Create saving card
              </Link>
            )
          }
        />
      ) : (
        <>
          {readiness && !readiness.isWorkspaceReady ? (
            <InlineNotice
              title="Workspace setup is still in progress"
              description="The command center is live, but analytics will become more reliable as setup and card coverage improve."
            />
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <ActionStatCard
              label="Pending approvals"
              value={formatNumber(safeData.kpis.pendingApprovals)}
              detail={
                overdueApprovalCount > 0
                  ? `${overdueApprovalCount} request${overdueApprovalCount === 1 ? "" : "s"} overdue`
                  : "Waiting on reviewer action"
              }
              icon={AlertTriangle}
              tone="warning"
              isActive={activeSection === "pending-approvals"}
              onClick={() => setActiveSection("pending-approvals")}
            />
            <ActionStatCard
              label="Overdue items"
              value={formatNumber(overdueItems.length)}
              detail="Past planned end date and still unresolved"
              icon={Clock3}
              tone="error"
              isActive={activeSection === "overdue-items"}
              onClick={() => setActiveSection("overdue-items")}
            />
            <ActionStatCard
              label="Finance-locked items"
              value={formatNumber(financeLockedItems.length)}
              detail="Controlled records still active in the portfolio"
              icon={LockKeyhole}
              tone="slate"
              isActive={activeSection === "finance-locked-items"}
              onClick={() => setActiveSection("finance-locked-items")}
            />
            <ActionStatCard
              label="Recent decisions"
              value={formatNumber(recentDecisions.length)}
              detail="Latest approval outcomes and reviewer actions"
              icon={ShieldCheck}
              tone="success"
              isActive={activeSection === "recent-decisions"}
              onClick={() => setActiveSection("recent-decisions")}
            />
          </div>

          <Card className="overflow-hidden">
            <CardHeader className="border-b border-[var(--border)] bg-[var(--surface-elevated)]/55">
              <div className="space-y-3">
                <div>
                  <CardTitle>Command Center Views</CardTitle>
                  <CardDescription>
                    Switch between focused operational views without losing the current filters.
                  </CardDescription>
                </div>
                <div className="overflow-x-auto pb-1">
                  <div className="flex min-w-max gap-2">
                    {sectionTabs.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveSection(tab.id)}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition",
                          activeSection === tab.id
                            ? "border-[var(--primary)] bg-[rgba(53,93,122,0.08)] text-[var(--foreground)]"
                            : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] hover:bg-[var(--surface-elevated)] hover:text-[var(--foreground)]"
                        )}
                      >
                        <span>{tab.label}</span>
                        {typeof tab.count === "number" ? (
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                              activeSection === tab.id
                                ? "bg-[var(--primary)] text-white"
                                : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                            )}
                          >
                            {tab.count}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {activeSection === "analytics" ? (
                <>
                  <SectionBand
                    eyebrow="Portfolio Context"
                    title="Analytics and trend context"
                    description="Use the analytics below to understand the broader savings mix after the urgent work above is under control."
                  />

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <MetricCard
                      label="Pipeline Savings"
                      value={formatCurrency(safeData.kpis.totalPipelineSavings, "EUR")}
                      icon={CircleDollarSign}
                      status={isLoading ? "Updating" : "Live"}
                    />
                    <MetricCard
                      label="Realised Savings"
                      value={formatCurrency(safeData.kpis.realisedSavings, "EUR")}
                      icon={TrendingUp}
                      status={isLoading ? "Updating" : "Live"}
                    />
                    <MetricCard
                      label="Savings Forecast"
                      value={formatCurrency(safeData.kpis.savingsForecast, "EUR")}
                      icon={ClipboardList}
                      status={isLoading ? "Updating" : "Live"}
                    />
                    <MetricCard
                      label="Achieved Savings"
                      value={formatCurrency(safeData.kpis.achievedSavings, "EUR")}
                      icon={CheckCircle2}
                      status={isLoading ? "Updating" : "Live"}
                    />
                  </div>

                  <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                    <ChartCard
                      title="Savings Pipeline by Phase"
                      description="Current savings value by workflow phase."
                      status={resolveChartState(safeData.pipelineByPhase, ["savings"])}
                      heightClassName="h-80"
                      emptyMessage="No pipeline savings are available for the current view."
                    >
                      <PipelineBarChart data={safeData.pipelineByPhase} />
                    </ChartCard>

                    <ChartCard
                      title="Savings Forecast Over Time"
                      description="Current savings and forecast by month."
                      status={resolveChartState(safeData.forecastCurve, [
                        "savings",
                        "forecast",
                      ])}
                      heightClassName="h-80"
                      emptyMessage="No savings forecast data is available for the current view."
                    >
                      <ForecastAreaPanel data={safeData.forecastCurve.slice(-6)} />
                    </ChartCard>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                    <ChartCard
                      title="Top Suppliers by Savings Impact"
                      description="Supplier exposure ranked by associated savings value."
                      status={resolveChartState(safeData.topSuppliers, ["savings"])}
                      heightClassName="h-[420px]"
                      emptyMessage="No supplier savings exposure is available for the current view."
                    >
                      <SupplierBarChart data={safeData.topSuppliers} />
                    </ChartCard>
                    <PortfolioMixCard
                      riskData={safeData.savingsByRiskLevel}
                      qualificationData={safeData.savingsByQualificationStatus}
                    />
                  </div>
                </>
              ) : null}

              {activeSection === "pending-approvals" ? (
                <ActionQueueCard
                  items={pendingApprovalQueue}
                  totalCount={safeData.kpis.pendingApprovals}
                />
              ) : null}

              {activeSection === "quick-actions" ? <QuickActionsCard /> : null}

              {activeSection === "overdue-items" ? (
                <AttentionListCard
                  title="Overdue items"
                  description="Initiatives past planned end date and still not achieved or cancelled."
                  items={overdueItems}
                  emptyMessage="No overdue initiatives in the current view."
                  tone="error"
                  actionHref="/saving-cards"
                  actionLabel="Open saving cards"
                />
              ) : null}

              {activeSection === "finance-locked-items" ? (
                <AttentionListCard
                  title="Finance-locked items"
                  description="Finance-controlled cards still moving through execution or validation."
                  items={financeLockedItems}
                  emptyMessage="No finance-locked items require follow-up in the current view."
                  tone="slate"
                  actionHref="/saving-cards"
                  actionLabel="Review locked cards"
                />
              ) : null}

              {activeSection === "recent-decisions" ? (
                <DecisionFeedCard items={recentDecisions} />
              ) : null}

              {activeSection === "recent-record-activity" ? (
                <RecentActivityCard items={recentActivity} />
              ) : null}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export function buildCommandCenterSearchParams(filters: CommandCenterFilters) {
  const params = new URLSearchParams();

  for (const key of commandCenterFilterKeys) {
    const value = filters[key]?.trim();

    if (value) {
      params.set(key, value);
    }
  }

  return params;
}

async function fetchCommandCenterData(
  filters: CommandCenterFilters
): Promise<CommandCenterData> {
  const params = buildCommandCenterSearchParams(filters);
  const query = params.toString();
  const response = await fetch(
    query ? `/api/command-center?${query}` : "/api/command-center",
    {
      cache: "no-store",
      credentials: "include",
    }
  );

  const result = (await response.json()) as
    | CommandCenterData
    | CommandCenterApiError;

  if (!response.ok || "error" in result) {
    throw new Error(
      "error" in result ? result.error : "Command center refresh failed."
    );
  }

  return result;
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold text-[var(--muted-foreground)]">
        {label}
      </p>
      {children}
    </div>
  );
}

function SectionBand({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
        {eyebrow}
      </p>
      <h2 className="text-[1.35rem] font-semibold tracking-[-0.02em] text-[var(--foreground)]">
        {title}
      </h2>
      <p className="max-w-4xl text-sm leading-6 text-[var(--muted-foreground)]">
        {description}
      </p>
    </div>
  );
}

function ActionStatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
  isActive,
  onClick,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ComponentType<{ className?: string }>;
  tone: "warning" | "error" | "success" | "slate";
  isActive?: boolean;
  onClick?: () => void;
}) {
  const toneClass =
    tone === "error"
      ? "border-[rgba(161,59,45,0.18)] bg-[rgba(161,59,45,0.06)]"
      : tone === "warning"
        ? "border-[rgba(139,94,21,0.18)] bg-[rgba(139,94,21,0.08)]"
        : tone === "success"
          ? "border-[rgba(31,107,77,0.18)] bg-[rgba(31,107,77,0.08)]"
          : "border-[var(--border)] bg-[var(--surface)]";
  const iconToneClass =
    tone === "error"
      ? "text-[var(--risk)]"
      : tone === "warning"
        ? "text-[var(--warning)]"
        : tone === "success"
          ? "text-[var(--success)]"
          : "text-[var(--text-secondary)]";

  return (
    <button type="button" onClick={onClick} className="w-full text-left">
      <Card
        className={cn(
          toneClass,
          "transition hover:border-[var(--primary)] hover:shadow-sm",
          isActive && "border-[var(--primary)] shadow-sm"
        )}
      >
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="rounded-xl border border-[var(--border)] bg-white/70 p-2">
              <Icon className={cn("h-5 w-5", iconToneClass)} />
            </div>
            <Badge tone={tone === "warning" ? "amber" : tone === "error" ? "error" : tone === "success" ? "emerald" : "slate"}>
              {isActive ? "Open" : "Action"}
            </Badge>
          </div>
          <div className="space-y-1">
            <p className="text-[32px] font-semibold leading-none tracking-tight text-[var(--foreground)]">
              {value}
            </p>
            <p className="text-sm font-semibold text-[var(--foreground)]">{label}</p>
            <p className="text-sm text-[var(--muted-foreground)]">{detail}</p>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

function ActionQueueCard({
  items,
  totalCount,
}: {
  items: CommandCenterPendingApprovalItem[];
  totalCount: number;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-[var(--border)] bg-[var(--surface-elevated)]/65">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Pending approvals</CardTitle>
            <CardDescription>
              The action queue shows the oldest pending phase-change requests first so bottlenecks are visible immediately.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={items.some((item) => item.isOverdue) ? "amber" : "slate"}>
              {totalCount} open
            </Badge>
            <Badge tone="slate">Showing oldest {items.length}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length ? (
          items.map((item) => (
            <Link
              key={item.requestId}
              href={`/saving-cards/${item.savingCardId}`}
              className="block rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--primary)] hover:bg-[var(--surface-elevated)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {item.savingCardTitle}
                    </p>
                    <Badge tone={item.isOverdue ? "amber" : "teal"}>
                      {item.isOverdue ? "Overdue" : "Waiting"}
                    </Badge>
                    {item.financeLocked ? <Badge tone="lock">Finance locked</Badge> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted-foreground)]">
                    <span>{item.currentPhase}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                    <span>{item.requestedPhase}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    {formatCurrency(item.savings, "EUR")}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {formatCommandCenterRelativeDays(item.ageDays)}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[var(--muted-foreground)]">
                <span>
                  Requested by {item.requestedByName} · {item.requestedByRole}
                </span>
                <span>
                  Pending reviewers: {item.pendingApproverRoles.join(", ") || "Unassigned"}
                </span>
                <span>{item.pendingApproverCount} reviewer action{item.pendingApproverCount === 1 ? "" : "s"} pending</span>
              </div>
            </Link>
          ))
        ) : (
          <ListEmptyState message="No pending approvals require action in the current view." />
        )}
        <div className="pt-2">
          <Link
            href="/open-actions"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Open approval queue
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function AttentionListCard({
  title,
  description,
  items,
  emptyMessage,
  tone,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  items: CommandCenterAttentionItem[];
  emptyMessage: string;
  tone: "error" | "slate";
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-[var(--border)] bg-[var(--surface-elevated)]/65">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length ? (
          items.map((item) => (
            <Link
              key={`${title}-${item.savingCardId}`}
              href={`/saving-cards/${item.savingCardId}`}
              className="block rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--primary)] hover:bg-[var(--surface-elevated)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {item.title}
                    </p>
                    <Badge tone={tone === "error" ? "error" : "lock"}>
                      {tone === "error" ? "Overdue" : "Locked"}
                    </Badge>
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {item.phase} · {item.buyerName} · {item.categoryName}
                  </p>
                </div>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {formatCurrency(item.savings, "EUR")}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[var(--muted-foreground)]">
                <span>
                  {item.dateLabel}: {formatCommandCenterDate(item.dateValue)}
                </span>
                <span>
                  {tone === "error"
                    ? `${item.ageDays} day${item.ageDays === 1 ? "" : "s"} overdue`
                    : `Updated ${formatCommandCenterRelativeDays(item.ageDays, true)}`}
                </span>
                {item.financeLocked ? <span>Finance lock active</span> : null}
              </div>
            </Link>
          ))
        ) : (
          <ListEmptyState message={emptyMessage} />
        )}
        <div className="pt-2">
          <Link href={actionHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
            {actionLabel}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickActionsCard() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-[var(--border)] bg-[var(--surface-elevated)]/65">
        <CardTitle>Quick actions</CardTitle>
        <CardDescription>
          Jump straight into the operational surfaces most likely to resolve what is flagged above.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Link href="/open-actions" className={buttonVariants({ size: "sm" })}>
          Open approvals
        </Link>
        <Link href="/kanban" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Review kanban flow
        </Link>
        <Link href="/saving-cards" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Browse saving cards
        </Link>
        <Link href="/saving-cards/new" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          Create saving card
        </Link>
      </CardContent>
    </Card>
  );
}

function DecisionFeedCard({
  items,
}: {
  items: CommandCenterDecisionItem[];
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-[var(--border)] bg-[var(--surface-elevated)]/65">
        <CardTitle>Recent decisions</CardTitle>
        <CardDescription>
          Latest approval outcomes so resolved work is clearly separated from items still waiting.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length ? (
          items.map((item) => (
            <Link
              key={item.approvalId}
              href={`/saving-cards/${item.savingCardId}`}
              className="block rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--primary)] hover:bg-[var(--surface-elevated)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {item.savingCardTitle}
                    </p>
                    <Badge tone={item.approved ? "emerald" : "error"}>
                      {item.approved ? "Approved" : "Rejected"}
                    </Badge>
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {item.phase} · {item.approverName} · {item.approverRole}
                  </p>
                </div>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {formatCommandCenterDate(item.createdAt)}
                </p>
              </div>
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                {item.comment?.trim() || "No reviewer comment provided."}
              </p>
            </Link>
          ))
        ) : (
          <ListEmptyState message="No approval decisions have been recorded in the current view yet." />
        )}
      </CardContent>
    </Card>
  );
}

function RecentActivityCard({
  items,
}: {
  items: CommandCenterActivityItem[];
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-[var(--border)] bg-[var(--surface-elevated)]/65">
        <CardTitle>Recent record activity</CardTitle>
        <CardDescription>
          The most recently changed records across the filtered portfolio, useful for operational follow-up even without a dedicated review log.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length ? (
          items.map((item) => (
            <Link
              key={`${item.savingCardId}-${item.updatedAt}`}
              href={`/saving-cards/${item.savingCardId}`}
              className="block rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--primary)] hover:bg-[var(--surface-elevated)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {item.savingCardTitle}
                    </p>
                    <Badge tone="slate">{item.phase}</Badge>
                    {item.financeLocked ? <Badge tone="lock">Finance locked</Badge> : null}
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {item.buyerName} · {item.categoryName}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    {formatCurrency(item.savings, "EUR")}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Updated {formatCommandCenterDate(item.updatedAt)}
                  </p>
                </div>
              </div>
            </Link>
          ))
        ) : (
          <ListEmptyState message="No recent record activity is available in the current view." />
        )}
      </CardContent>
    </Card>
  );
}

function PortfolioMixCard({
  riskData,
  qualificationData,
}: {
  riskData: CommandCenterData["savingsByRiskLevel"];
  qualificationData: CommandCenterData["savingsByQualificationStatus"];
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-[var(--border)] bg-[var(--surface-elevated)]/65">
        <CardTitle>Portfolio risk and qualification mix</CardTitle>
        <CardDescription>
          Supporting context for where value is concentrated by operational risk and validation maturity.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <DistributionList
          title="By risk level"
          items={riskData.map((item) => ({
            label: item.level,
            value: item.savings,
          }))}
          emptyMessage="No risk mix is available for the current view."
        />
        <DistributionList
          title="By qualification status"
          items={qualificationData.map((item) => ({
            label: item.status,
            value: item.savings,
          }))}
          emptyMessage="No qualification mix is available for the current view."
        />
      </CardContent>
    </Card>
  );
}

function DistributionList({
  title,
  items,
  emptyMessage,
}: {
  title: string;
  items: Array<{ label: string; value: number }>;
  emptyMessage: string;
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold text-[var(--muted-foreground)]">
        {title}
      </p>
      {items.length ? (
        items.map((item) => {
          const share = total > 0 ? (item.value / total) * 100 : 0;

          return (
            <div key={item.label} className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-[var(--foreground)]">
                  {item.label}
                </span>
                <span className="text-sm font-semibold text-[var(--foreground)]">
                  {formatCurrency(item.value, "EUR")}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-elevated)]">
                <div
                  className="h-full rounded-full bg-[var(--primary)]"
                  style={{ width: `${Math.max(share, items.length === 1 ? 100 : 6)}%` }}
                />
              </div>
            </div>
          );
        })
      ) : (
        <ListEmptyState message={emptyMessage} />
      )}
    </div>
  );
}

function ListEmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--muted)]/25 px-4 py-6 text-sm text-[var(--muted-foreground)]">
      {message}
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  status,
}: {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
  status: string;
}) {
  return (
    <Card className="border-[var(--border)] bg-[var(--surface)] shadow-none">
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-2">
            <Icon className="h-5 w-5 text-[var(--text-secondary)]" />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
            {status}
          </span>
        </div>
        <div className="space-y-1">
          <p className="text-[28px] font-semibold leading-none tracking-tight">
            {value}
          </p>
          <p className="text-[13px] font-medium text-[var(--muted-foreground)]">
            {label}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title,
  description,
  status,
  heightClassName,
  emptyMessage,
  children,
}: {
  title: string;
  description: string;
  status: ChartState;
  heightClassName: string;
  emptyMessage: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className={heightClassName}>
        {status === "loading" ? (
          <ChartStateMessage message="Loading chart..." />
        ) : status === "error" ? (
          <ChartStateMessage message="This chart is unavailable right now." />
        ) : status === "empty" ? (
          <ChartStateMessage message={emptyMessage} />
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

function ChartStateMessage({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--muted)]/30 px-6 text-center text-sm text-[var(--muted-foreground)]">
      {message}
    </div>
  );
}

function PipelineBarChart({
  data,
}: {
  data: CommandCenterData["pipelineByPhase"];
}) {
  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#6B7280", fontSize: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#6B7280", fontSize: 12 }}
            tickFormatter={(value) => formatCurrency(value, "EUR")}
          />
          <Tooltip
            contentStyle={{ borderRadius: 12, borderColor: "#E5E7EB", fontSize: 12 }}
            formatter={(value: number) => [
              formatCurrency(value, "EUR"),
              "Savings",
            ]}
          />
          <Bar dataKey="savings" fill="#2563EB" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ForecastAreaPanel({
  data,
}: {
  data: CommandCenterData["forecastCurve"];
}) {
  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#6B7280", fontSize: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#6B7280", fontSize: 12 }}
            tickFormatter={(value) => formatCurrency(value, "EUR")}
          />
          <Tooltip
            contentStyle={{ borderRadius: 12, borderColor: "#E5E7EB", fontSize: 12 }}
            formatter={(value: number, name: string) => [
              formatCurrency(value, "EUR"),
              name === "forecast" ? "Forecast" : "Savings",
            ]}
          />
          <Area
            type="monotone"
            dataKey="savings"
            name="Savings"
            stroke="#2563EB"
            fill="#93C5FD"
            fillOpacity={0.55}
          />
          <Area
            type="monotone"
            dataKey="forecast"
            name="Forecast"
            stroke="#16A34A"
            fill="#86EFAC"
            fillOpacity={0.35}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function SupplierBarChart({
  data,
}: {
  data: CommandCenterData["topSuppliers"];
}) {
  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 8, bottom: 0, left: 12 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#6B7280", fontSize: 12 }}
            tickFormatter={(value) => formatCurrency(value, "EUR")}
          />
          <YAxis
            type="category"
            dataKey="supplier"
            width={120}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#6B7280", fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{ borderRadius: 12, borderColor: "#E5E7EB", fontSize: 12 }}
            formatter={(value: number) => [
              formatCurrency(value, "EUR"),
              "Savings",
            ]}
          />
          <Bar dataKey="savings" fill="#4F46E5" radius={[0, 8, 8, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function formatCommandCenterDate(value: string) {
  if (!value) {
    return "Unknown date";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}

function formatCommandCenterRelativeDays(days: number, prefix = false) {
  if (days <= 0) {
    return prefix ? "today" : "Today";
  }

  if (prefix) {
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }

  return `${days} day${days === 1 ? "" : "s"} waiting`;
}

function StateCard({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Card className="border-amber-200 bg-amber-50/80">
      <CardHeader>
        <CardTitle className="text-amber-950">{title}</CardTitle>
        <CardDescription className="text-amber-900">
          {description}
        </CardDescription>
      </CardHeader>
      {action ? <CardContent className="pt-0">{action}</CardContent> : null}
    </Card>
  );
}

function InlineNotice({
  title,
  description,
  tone = "warning",
}: {
  title: string;
  description: string;
  tone?: "warning" | "error";
}) {
  const className =
    tone === "error"
      ? "border-rose-200 bg-rose-50/80"
      : "border-amber-200 bg-amber-50/80";
  const titleClass = tone === "error" ? "text-rose-950" : "text-amber-950";
  const descriptionClass =
    tone === "error" ? "text-rose-900" : "text-amber-900";

  return (
    <Card className={className}>
      <CardContent className="space-y-1 py-4">
        <p className={cn("text-sm font-semibold", titleClass)}>{title}</p>
        <p className={cn("text-sm", descriptionClass)}>{description}</p>
      </CardContent>
    </Card>
  );
}
