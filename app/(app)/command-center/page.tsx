export const dynamic = "force-dynamic";

import { CommandCenterClient } from "@/components/command-center/command-center-client";
import { buttonVariants } from "@/components/ui/button";
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
      <div className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <SectionHeading title="Command Center" />
              {workspaceReadiness ? (
                <span className="inline-flex rounded-full bg-[var(--muted)] px-3 py-1 text-xs font-medium text-[var(--muted-foreground)]">
                  {workspaceReadiness.workspace.name}
                </span>
              ) : null}
            </div>
            <p className="max-w-3xl text-sm text-[var(--muted-foreground)]">
              {workspaceReadiness
                ? `${workspaceReadiness.workspace.name} command center reflects ${workspaceReadiness.counts.savingCards} live organization-scoped saving card${workspaceReadiness.counts.savingCards === 1 ? "" : "s"}, supplier exposure, forecast timing, and workflow demand for operational reporting.`
                : "Command center analytics reflect live organization-scoped savings, supplier, forecast, and workflow signals."}
            </p>
          </div>
          <a href="/api/export" className={buttonVariants({ variant: "outline" })}>
            Export workbook
          </a>
        </div>
      </div>
      <CommandCenterClient
        initialData={initialData}
        filterOptions={filterOptions}
        readiness={workspaceReadiness}
      />
    </div>
  );
}
