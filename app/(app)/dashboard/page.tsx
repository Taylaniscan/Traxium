export const dynamic = "force-dynamic";

import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { buttonVariants } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireUser } from "@/lib/auth";
import { getDashboardData, getWorkspaceReadiness } from "@/lib/data";
import type { DashboardData, WorkspaceReadiness } from "@/lib/types";

const EMPTY_DASHBOARD_DATA: DashboardData = {
  cards: [],
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
      <div className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <SectionHeading title="Dashboard" />
              {workspaceReadiness ? (
                <span className="inline-flex rounded-full bg-[var(--muted)] px-3 py-1 text-xs font-medium text-[var(--muted-foreground)]">
                  {workspaceReadiness.workspace.name}
                </span>
              ) : null}
            </div>
            <p className="max-w-3xl text-sm text-[var(--muted-foreground)]">
              {workspaceReadiness
                ? `${workspaceReadiness.workspace.name} dashboard reflects ${workspaceReadiness.counts.savingCards} live organization-scoped saving card${workspaceReadiness.counts.savingCards === 1 ? "" : "s"}, workflow status, and reporting readiness for executive review.`
                : "Dashboard analytics reflect live organization-scoped savings, workflow, and reporting readiness."}
            </p>
          </div>
          <a href="/api/export" className={buttonVariants({ variant: "outline" })}>
            Export workbook
          </a>
        </div>
      </div>
      <DashboardClient data={data} readiness={workspaceReadiness} />
    </div>
  );
}
