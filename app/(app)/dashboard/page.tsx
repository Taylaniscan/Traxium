export const dynamic = "force-dynamic";

import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { SectionHeading } from "@/components/ui/section-heading";
import { getDashboardData } from "@/lib/data";

export default async function DashboardPage() {

  let data;

  try {
    data = await getDashboardData();
  } catch (error) {
    console.log("Dashboard data could not be loaded:", error);

    data = {
      cards: [],
      monthlyTrend: [],
      savingsByCategory: [],
      savingsByBuyer: [],
      savingsVsTarget: []
    } as any;
  }

  return (
    <div className="space-y-6">
      <SectionHeading title="Dashboard" />
      <DashboardClient data={data} />
    </div>
  );
}