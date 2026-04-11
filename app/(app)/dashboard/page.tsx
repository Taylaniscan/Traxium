export const dynamic = "force-dynamic";

import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireUser } from "@/lib/auth";
import { getDashboardData, getWorkspaceReadiness } from "@/lib/data";
import type { DashboardData, WorkspaceReadiness } from "@/lib/types";

const EMPTY_DASHBOARD_DATA: DashboardData = {
  cards: [],
};

async function loadDashboardCards(organizationId: string) {
  try {
    return {
      data: (await getDashboardData(organizationId)) as DashboardData,
      dataError: null,
    };
  } catch (error) {
    console.error("Dashboard data could not be loaded:", error);

    return {
      data: EMPTY_DASHBOARD_DATA,
      dataError:
        "Dashboard analytics could not be loaded right now. Refresh the page or try again in a moment.",
    };
  }
}

async function loadDashboardReadiness(organizationId: string) {
  try {
    return {
      workspaceReadiness: (await getWorkspaceReadiness(
        organizationId
      )) as WorkspaceReadiness | null,
      readinessError: null,
    };
  } catch (error) {
    console.error("Workspace readiness could not be loaded:", error);

    return {
      workspaceReadiness: null,
      readinessError:
        "Workspace setup status could not be loaded. Dashboard charts are still available, but readiness guidance is temporarily unavailable.",
    };
  }
}

const SERVER_OUTLINE_BUTTON_CLASS =
  "inline-flex h-10 items-center justify-center rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

export default async function DashboardPage() {
  const user = await requireUser();
  const [{ data, dataError }, { workspaceReadiness, readinessError }] =
    await Promise.all([
      loadDashboardCards(user.organizationId),
      loadDashboardReadiness(user.organizationId),
    ]);

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
        loadState={{
          dataError,
          readinessError,
        }}
        viewer={{
          organizationMembershipRole: user.activeOrganization.membershipRole,
        }}
      />
    </div>
  );
}
