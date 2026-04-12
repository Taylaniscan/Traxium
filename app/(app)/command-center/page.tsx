export const dynamic = "force-dynamic";

import { CommandCenterClient } from "@/components/command-center/command-center-client";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireUser } from "@/lib/auth";
import {
  getCommandCenterData,
  getCommandCenterFilterOptions,
  getWorkspaceReadiness,
} from "@/lib/data";
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

async function loadCommandCenterDataState(organizationId: string) {
  try {
    return {
      initialData: (await getCommandCenterData(organizationId)) as CommandCenterData,
      dataError: null,
    };
  } catch (error) {
    console.error("Command Center data could not be loaded:", error);

    return {
      initialData: EMPTY_COMMAND_CENTER_DATA,
      dataError:
        "Command center analytics could not be loaded right now. Refresh the page or try again in a moment.",
    };
  }
}

async function loadCommandCenterFilterOptionsState(organizationId: string) {
  try {
    return {
      filterOptions: (await getCommandCenterFilterOptions(
        organizationId
      )) as CommandCenterFilterOptions,
      filterOptionsError: null,
    };
  } catch (error) {
    console.error("Command Center filter options could not be loaded:", error);

    return {
      filterOptions: EMPTY_COMMAND_CENTER_FILTER_OPTIONS,
      filterOptionsError:
        "Command center filters could not be loaded. Filter options are temporarily unavailable.",
    };
  }
}

async function loadCommandCenterReadinessState(organizationId: string) {
  try {
    return {
      workspaceReadiness: (await getWorkspaceReadiness(
        organizationId
      )) as WorkspaceReadiness | null,
      readinessError: null,
    };
  } catch (error) {
    console.error("Workspace readiness could not be loaded:", error);

    return {
      workspaceReadiness: null,
      readinessError:
        "Workspace setup status could not be loaded. Command center charts are still available, but readiness guidance is temporarily unavailable.",
    };
  }
}

export default async function CommandCenterPage() {
  const user = await requireUser();
  const { initialData, dataError } = await loadCommandCenterDataState(
    user.organizationId
  );
  const { filterOptions, filterOptionsError } =
    await loadCommandCenterFilterOptionsState(user.organizationId);
  const { workspaceReadiness, readinessError } =
    await loadCommandCenterReadinessState(user.organizationId);

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
