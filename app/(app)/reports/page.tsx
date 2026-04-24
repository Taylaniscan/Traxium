import { ExecutiveSavingsSummary } from "@/components/reports/executive-savings-summary";
import { ImportExportPanel } from "@/components/reports/import-export-panel";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireUser } from "@/lib/auth";
import { getCommandCenterData, getDashboardData, getWorkspaceReadiness } from "@/lib/data";
import { captureException } from "@/lib/observability";
import type { CommandCenterData, DashboardData, WorkspaceReadiness } from "@/lib/types";

const EMPTY_DASHBOARD_DATA: DashboardData = {
  cards: [],
};

const EMPTY_COMMAND_CENTER_DATA: CommandCenterData = {
  filters: {},
  kpis: {
    totalPipelineSavings: 0,
    realisedSavings: 0,
    achievedSavings: 0,
    savingsForecast: 0,
    activeProjects: 0,
    pendingApprovals: 0,
  },
  pipelineByPhase: [],
  forecastCurve: [],
  topSuppliers: [],
  savingsByRiskLevel: [],
  savingsByQualificationStatus: [],
  pendingApprovalQueue: [],
  overdueItems: [],
  financeLockedItems: [],
  recentDecisions: [],
  recentActivity: [],
};

async function loadReportsReadinessState(input: {
  organizationId: string;
  userId: string;
}) {
  try {
    return {
      workspaceReadiness: (await getWorkspaceReadiness(
        input.organizationId
      )) as WorkspaceReadiness | null,
    };
  } catch (error) {
    captureException(error, {
      event: "reports.page.readiness_load_failed",
      route: "/reports",
      organizationId: input.organizationId,
      userId: input.userId,
      payload: {
        resource: "workspace_readiness",
        degradedRender: true,
        fallback: "reports_without_readiness",
      },
    });

    return {
      workspaceReadiness: null,
    };
  }
}

async function loadReportsCommandCenterState(input: {
  organizationId: string;
  userId: string;
}) {
  try {
    return {
      commandCenterData: (await getCommandCenterData(
        input.organizationId
      )) as CommandCenterData,
      commandCenterError: null,
    };
  } catch (error) {
    captureException(error, {
      event: "reports.page.command_center_summary_load_failed",
      route: "/reports",
      organizationId: input.organizationId,
      userId: input.userId,
      payload: {
        resource: "command_center_summary",
        degradedRender: true,
        fallback: "empty_command_center_summary",
      },
    });

    return {
      commandCenterData: EMPTY_COMMAND_CENTER_DATA,
      commandCenterError:
        "Executive workflow indicators could not be loaded. Pending approvals and recent decisions may be incomplete.",
    };
  }
}

async function loadReportsDashboardState(input: {
  organizationId: string;
  userId: string;
}) {
  try {
    return {
      dashboardData: (await getDashboardData(input.organizationId)) as DashboardData,
      dashboardError: null,
    };
  } catch (error) {
    captureException(error, {
      event: "reports.page.dashboard_summary_load_failed",
      route: "/reports",
      organizationId: input.organizationId,
      userId: input.userId,
      payload: {
        resource: "dashboard_summary",
        degradedRender: true,
        fallback: "empty_dashboard_summary",
      },
    });

    return {
      dashboardData: EMPTY_DASHBOARD_DATA,
      dashboardError:
        "Portfolio savings totals could not be loaded. Financial summary values may be incomplete.",
    };
  }
}

export default async function ReportsPage() {
  const user = await requireUser();
  const [
    { workspaceReadiness },
    { commandCenterData, commandCenterError },
    { dashboardData, dashboardError },
  ] = await Promise.all([
    loadReportsReadinessState({
      organizationId: user.organizationId,
      userId: user.id,
    }),
    loadReportsCommandCenterState({
      organizationId: user.organizationId,
      userId: user.id,
    }),
    loadReportsDashboardState({
      organizationId: user.organizationId,
      userId: user.id,
    }),
  ]);

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Reports"
        subtitle="Executive savings summary for finance leadership, plus workbook exports for deeper offline review."
      />
      <ExecutiveSavingsSummary
        commandCenterData={commandCenterData}
        dashboardData={dashboardData}
        loadState={{
          commandCenterError,
          dashboardError,
        }}
      />
      <ImportExportPanel readiness={workspaceReadiness} />
    </div>
  );
}
