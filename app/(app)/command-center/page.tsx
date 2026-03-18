export const dynamic = "force-dynamic";

import { CommandCenterClient } from "@/components/command-center/command-center-client";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireUser } from "@/lib/auth";
import { getCommandCenterData, getCommandCenterFilterOptions } from "@/lib/data";

type CommandCenterData = Awaited<ReturnType<typeof getCommandCenterData>>;
type CommandCenterFilterOptions = Awaited<ReturnType<typeof getCommandCenterFilterOptions>>;

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

  try {
    [initialData, filterOptions] = await Promise.all([
      getCommandCenterData(user.organizationId),
      getCommandCenterFilterOptions(user.organizationId),
    ]);
  } catch (error) {
    console.log("Command Center data could not be loaded:", error);
  }

  return (
    <div className="space-y-6">
      <SectionHeading title="Command Center" />
      <CommandCenterClient
        initialData={initialData}
        filterOptions={filterOptions}
      />
    </div>
  );
}
