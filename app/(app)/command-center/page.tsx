export const dynamic = "force-dynamic";

import { CommandCenterClient } from "@/components/command-center/command-center-client";
import { SectionHeading } from "@/components/ui/section-heading";
import { getCommandCenterData, getCommandCenterFilterOptions } from "@/lib/data";

export default async function CommandCenterPage() {
  let initialData;
  let filterOptions;

  try {
    [initialData, filterOptions] = await Promise.all([
      getCommandCenterData(),
      getCommandCenterFilterOptions(),
    ]);
  } catch (error) {
    console.log("Command Center data could not be loaded:", error);

    initialData = {
      cards: [],
      savingsByPhase: [],
      savingsByCategory: [],
      savingsByBusinessUnit: [],
      implementationComplexityBreakdown: [],
      qualificationStatusBreakdown: [],
      savingDriverBreakdown: [],
      totalSavingsEUR: 0,
      totalSavingsUSD: 0,
      activeProjects: 0,
      financeLockedCount: 0,
    } as any;

    filterOptions = {
      categories: [],
      businessUnits: [],
      buyers: [],
      plants: [],
      suppliers: [],
    } as any;
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