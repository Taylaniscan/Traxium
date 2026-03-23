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

export default async function CommandCenterPage() {
  const user = await requireUser();

  let initialData: CommandCenterData = EMPTY_COMMAND_CENTER_DATA;
  let filterOptions: CommandCenterFilterOptions = EMPTY_COMMAND_CENTER_FILTER_OPTIONS;
  let workspaceReadiness: WorkspaceReadiness | null = null;

  const [dataResult, filterOptionsResult, readinessResult] = await Promise.allSettled([
    getCommandCenterData(user.organizationId),
    getCommandCenterFilterOptions(user.organizationId),
    getWorkspaceReadiness(user.organizationId),
  ]);

  if (dataResult.status === "fulfilled") {
    initialData = dataResult.value;
  } else {
    console.log("Command Center data could not be loaded:", dataResult.reason);
  }

  if (filterOptionsResult.status === "fulfilled") {
    filterOptions = filterOptionsResult.value;
  } else {
    console.log("Command Center filter options could not be loaded:", filterOptionsResult.reason);
  }

  if (readinessResult.status === "fulfilled") {
    workspaceReadiness = readinessResult.value;
  } else {
    console.log("Workspace readiness could not be loaded:", readinessResult.reason);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeading title="Command Center" />
          <a href="/api/export" className={SERVER_OUTLINE_BUTTON_CLASS}>
            Export workbook
          </a>
      </div>
      <CommandCenterClient
        initialData={initialData}
        filterOptions={filterOptions}
        readiness={workspaceReadiness}
      />
    </div>
  );
}
