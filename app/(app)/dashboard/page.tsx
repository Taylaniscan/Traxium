export const dynamic = "force-dynamic";

import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/data";

type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

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

  try {
    data = await getDashboardData(user.organizationId);
  } catch (error) {
    console.log("Dashboard data could not be loaded:", error);
  }

  return (
    <div className="space-y-6">
      <SectionHeading title="Dashboard" />
      <DashboardClient data={data} />
    </div>
  );
}
