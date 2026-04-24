export const dynamic = "force-dynamic";

import { CommandCenterClient } from "@/components/command-center/command-center-client";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireUser } from "@/lib/auth";
import {
  getCommandCenterData,
  getCommandCenterFilterOptions,
  getWorkspaceReadiness,
} from "@/lib/data";
import { captureException } from "@/lib/observability";
import type {
  CommandCenterData,
  CommandCenterFilterOptions,
  WorkspaceReadiness,
} from "@/lib/types";

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

const EMPTY_COMMAND_CENTER_FILTER_OPTIONS: CommandCenterFilterOptions = {
  categories: [],
  businessUnits: [],
  buyers: [],
  plants: [],
  suppliers: [],
};

const SERVER_OUTLINE_BUTTON_CLASS =
  "inline-flex h-10 items-center justify-center rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

async function loadCommandCenterDataState(input: {
  organizationId: string;
  userId: string;
}) {
  try {
    return {
      initialData: (await getCommandCenterData(
        input.organizationId
      )) as CommandCenterData,
      dataError: null,
    };
  } catch (error) {
    captureException(error, {
      event: "command_center.page.data_load_failed",
      route: "/command-center",
      organizationId: input.organizationId,
      userId: input.userId,
      payload: {
        resource: "command_center_data",
        degradedRender: true,
        fallback: "empty_command_center_state",
      },
    });

    return {
      initialData: EMPTY_COMMAND_CENTER_DATA,
      dataError:
        "Command center analytics could not be loaded right now. Refresh the page or try again in a moment.",
    };
  }
}

async function loadCommandCenterFilterOptionsState(input: {
  organizationId: string;
  userId: string;
}) {
  try {
    return {
      filterOptions: (await getCommandCenterFilterOptions(
        input.organizationId
      )) as CommandCenterFilterOptions,
      filterOptionsError: null,
    };
  } catch (error) {
    captureException(error, {
      event: "command_center.page.filter_options_load_failed",
      route: "/command-center",
      organizationId: input.organizationId,
      userId: input.userId,
      payload: {
        resource: "filter_options",
        degradedRender: true,
        fallback: "empty_command_center_filters",
      },
    });

    return {
      filterOptions: EMPTY_COMMAND_CENTER_FILTER_OPTIONS,
      filterOptionsError:
        "Command center filters could not be loaded. Filter options are temporarily unavailable.",
    };
  }
}

async function loadCommandCenterReadinessState(input: {
  organizationId: string;
  userId: string;
}) {
  try {
    return {
      workspaceReadiness: (await getWorkspaceReadiness(
        input.organizationId
      )) as WorkspaceReadiness | null,
      readinessError: null,
    };
  } catch (error) {
    captureException(error, {
      event: "command_center.page.readiness_load_failed",
      route: "/command-center",
      organizationId: input.organizationId,
      userId: input.userId,
      payload: {
        resource: "workspace_readiness",
        degradedRender: true,
        fallback: "command_center_without_readiness",
      },
    });

    return {
      workspaceReadiness: null,
      readinessError:
        "Workspace setup status could not be loaded. Command center charts are still available, but readiness guidance is temporarily unavailable.",
    };
  }
}

export default async function CommandCenterPage() {
  const user = await requireUser();
  const { initialData, dataError } = await loadCommandCenterDataState({
    organizationId: user.organizationId,
    userId: user.id,
  });
  const { filterOptions, filterOptionsError } =
    await loadCommandCenterFilterOptionsState({
      organizationId: user.organizationId,
      userId: user.id,
    });
  const { workspaceReadiness, readinessError } =
    await loadCommandCenterReadinessState({
      organizationId: user.organizationId,
      userId: user.id,
    });

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Command Center"
        subtitle="A focused operating view for approvals, blockers, finance-controlled records, and the portfolio context behind them."
        action={
          <a href="/api/export" className={SERVER_OUTLINE_BUTTON_CLASS}>
            Export workbook
          </a>
        }
      />
      <CommandCenterClient
        initialData={initialData}
        filterOptions={filterOptions}
        readiness={workspaceReadiness}
        loadState={{
          dataError,
          filterOptionsError,
          readinessError,
        }}
      />
    </div>
  );
}
