export const dynamic = "force-dynamic";

import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireUser } from "@/lib/auth";
import { getDashboardData, getWorkspaceReadiness } from "@/lib/data";
import type { DashboardData, WorkspaceReadiness } from "@/lib/types";

const EMPTY_DASHBOARD_DATA: DashboardData = {
  cards: [],
};

const SERVER_OUTLINE_BUTTON_CLASS =
  "inline-flex h-10 items-center justify-center rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeading title="Dashboard" />
          <a href="/api/export" className={SERVER_OUTLINE_BUTTON_CLASS}>
            Export workbook
          </a>
      </div>
      <DashboardClient
        data={data}
        readiness={workspaceReadiness}
        viewer={{
          organizationMembershipRole: user.activeOrganization.membershipRole,
        }}
      />
    </div>
  );
}
