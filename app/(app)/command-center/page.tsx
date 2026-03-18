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
} from "@/lib/types";

type WorkspaceReadiness = Awaited<ReturnType<typeof getWorkspaceReadiness>>;

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
  benchmarkOpportunities: [],
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
      <SectionHeading title="Command Center" />
      <CommandCenterClient
        initialData={initialData}
        filterOptions={filterOptions}
        readiness={workspaceReadiness}
      />
    </div>
  );
}
