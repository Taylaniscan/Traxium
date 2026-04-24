export const dynamic = "force-dynamic";

import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireUser } from "@/lib/auth";
import { getDashboardData, getWorkspaceReadiness } from "@/lib/data";
import { captureException } from "@/lib/observability";
import type { DashboardData, WorkspaceReadiness } from "@/lib/types";

const EMPTY_DASHBOARD_DATA: DashboardData = {
  cards: [],
};

async function loadDashboardCards(input: {
  organizationId: string;
  userId: string;
}) {
  try {
    return {
      data: (await getDashboardData(input.organizationId)) as DashboardData,
      dataError: null,
    };
  } catch (error) {
    captureException(error, {
      event: "dashboard.page.data_load_failed",
      route: "/dashboard",
      organizationId: input.organizationId,
      userId: input.userId,
      payload: {
        resource: "dashboard_data",
        degradedRender: true,
        fallback: "empty_dashboard_state",
      },
    });

    return {
      data: EMPTY_DASHBOARD_DATA,
      dataError:
        "Dashboard analytics could not be loaded right now. Refresh the page or try again in a moment.",
    };
  }
}

async function loadDashboardReadiness(input: {
  organizationId: string;
  userId: string;
}) {
  try {
    return {
      workspaceReadiness: (await getWorkspaceReadiness(
        input.organizationId
      )) as WorkspaceReadiness | null,
      readinessError: null,
    };
  } catch (error) {
    captureException(error, {
      event: "dashboard.page.readiness_load_failed",
      route: "/dashboard",
      organizationId: input.organizationId,
      userId: input.userId,
      payload: {
        resource: "workspace_readiness",
        degradedRender: true,
        fallback: "dashboard_without_readiness",
      },
    });

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
      loadDashboardCards({
        organizationId: user.organizationId,
        userId: user.id,
      }),
      loadDashboardReadiness({
        organizationId: user.organizationId,
        userId: user.id,
      }),
    ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeading
          title="Dashboard"
          subtitle="Executive procurement-finance control surface across the active savings portfolio."
        />
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
