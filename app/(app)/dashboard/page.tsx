export const dynamic = "force-dynamic";

import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireUser } from "@/lib/auth";
import { getDashboardData, getWorkspaceReadiness } from "@/lib/data";

type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
type WorkspaceReadiness = Awaited<ReturnType<typeof getWorkspaceReadiness>>;

const EMPTY_DASHBOARD_DATA: DashboardData = {
  cards: [],
  totalPipelineSavings: 0,
  totalRealisedSavings: 0,
  totalAchievedSavings: 0,
  byCategory: [],
  byBuyer: [],
  byBusinessUnit: [],
  monthlyTrend: [],
  savingsVsTarget: [],
};

export default async function DashboardPage() {
  const user = await requireUser();

  let data: DashboardData = EMPTY_DASHBOARD_DATA;
  let workspaceReadiness: WorkspaceReadiness | null = null;

  const [dataResult, readinessResult] = await Promise.allSettled([
    getDashboardData(user.organizationId),
    getWorkspaceReadiness(user.organizationId),
  ]);

  if (dataResult.status === "fulfilled") {
    data = dataResult.value;
  } else {
    console.log("Dashboard data could not be loaded:", dataResult.reason);
  }

  if (readinessResult.status === "fulfilled") {
    workspaceReadiness = readinessResult.value;
  } else {
    console.log("Workspace readiness could not be loaded:", readinessResult.reason);
  }

  return (
    <div className="space-y-6">
      <SectionHeading title="Dashboard" />
      <DashboardClient data={data} readiness={workspaceReadiness} />
    </div>
  );
}
