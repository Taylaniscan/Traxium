export const dynamic = "force-dynamic";

import { CommandCenterClient } from "@/components/command-center/command-center-client";
import { OpenActionsList } from "@/components/open-actions/open-actions-list";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireUser } from "@/lib/auth";
import {
  getCommandCenterData,
  getCommandCenterFilterOptions,
  getPendingApprovals,
  getPendingPhaseChangeRequests,
  getWorkspaceReadiness,
} from "@/lib/data";
import { captureException } from "@/lib/observability";
import { roleLabels } from "@/lib/constants";
import type {
  CommandCenterData,
  CommandCenterFilterOptions,
  WorkspaceReadiness,
} from "@/lib/types";
import { serializeDecimals } from "@/lib/utils/decimal";

type ActionCenterView = "mine" | "all";

function normalizeActionCenterView(value?: string | string[]): ActionCenterView {
  const normalized = Array.isArray(value) ? value[0] : value;
  return normalized === "all" ? "all" : "mine";
}

async function loadActionQueueState(input: {
  organizationId: string;
  userId: string;
  view: ActionCenterView;
}) {
  try {
    if (input.view === "all") {
      const requests = await getPendingPhaseChangeRequests(input.organizationId);
      return {
        actions: requests.map((request) => {
          const pendingApproverRoles = [
            ...new Set(
              request.approvals.map((approval) => roleLabels[approval.approver.role])
            ),
          ];
          const canDecide = request.approvals.some(
            (approval) => approval.approverId === input.userId
          );

          return {
            id: request.id,
            requestId: request.id,
            savingCardId: request.savingCard.id,
            savingCardTitle: request.savingCard.title,
            requestedBy: request.requestedBy.name,
            requestedAt: request.createdAt.toISOString(),
            currentPhase: request.currentPhase,
            requestedPhase: request.requestedPhase,
            comment: request.comment ?? null,
            canDecide,
            pendingApproverSummary:
              pendingApproverRoles.length > 0
                ? `${request.approvals.length} pending approver${request.approvals.length === 1 ? "" : "s"} · ${pendingApproverRoles.join(", ")}`
                : "Pending approval",
          };
        }),
      };
    }

    const approvals = await getPendingApprovals(input.userId, input.organizationId);
    return {
      actions: approvals.map((approval) => ({
        id: approval.id,
        requestId: approval.phaseChangeRequest.id,
        savingCardId: approval.phaseChangeRequest.savingCard.id,
        savingCardTitle: approval.phaseChangeRequest.savingCard.title,
        requestedBy: approval.phaseChangeRequest.requestedBy.name,
        requestedAt: approval.phaseChangeRequest.createdAt.toISOString(),
        currentPhase: approval.phaseChangeRequest.currentPhase,
        requestedPhase: approval.phaseChangeRequest.requestedPhase,
        comment: approval.phaseChangeRequest.comment ?? null,
        canDecide: true,
        pendingApproverSummary: "Assigned to you",
      })),
    };
  } catch (error) {
    captureException(error, {
      event: "action_center.page.actions_load_failed",
      route: "/command-center",
      organizationId: input.organizationId,
      userId: input.userId,
      payload: {
        resource:
          input.view === "all"
            ? "pending_phase_change_requests"
            : "pending_approvals",
        degradedRender: true,
        fallback: "empty_actions_list",
        view: input.view,
      },
    });
    return { actions: [] };
  }
}

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
  savingsByRiskLevel: [],
  savingsByQualificationStatus: [],
  pendingApprovalQueue: [],
  overdueItems: [],
  financeLockedItems: [],
  recentDecisions: [],
  recentActivity: [],
};

const EMPTY_COMMAND_CENTER_FILTER_OPTIONS: CommandCenterFilterOptions = {
  categories: [],
  businessUnits: [],
  buyers: [],
  plants: [],
  suppliers: [],
};

const SERVER_OUTLINE_BUTTON_CLASS =
  "inline-flex h-10 items-center justify-center rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

async function loadCommandCenterDataState(input: {
  organizationId: string;
  userId: string;
}) {
  try {
    return {
      initialData: (await getCommandCenterData(
        input.organizationId
      )) as CommandCenterData,
      dataError: null,
    };
  } catch (error) {
    captureException(error, {
      event: "command_center.page.data_load_failed",
      route: "/command-center",
      organizationId: input.organizationId,
      userId: input.userId,
      payload: {
        resource: "command_center_data",
        degradedRender: true,
        fallback: "empty_command_center_state",
      },
    });

    return {
      initialData: EMPTY_COMMAND_CENTER_DATA,
      dataError:
        "Command center analytics could not be loaded right now. Refresh the page or try again in a moment.",
    };
  }
}

async function loadCommandCenterFilterOptionsState(input: {
  organizationId: string;
  userId: string;
}) {
  try {
    return {
      filterOptions: (await getCommandCenterFilterOptions(
        input.organizationId
      )) as CommandCenterFilterOptions,
      filterOptionsError: null,
    };
  } catch (error) {
    captureException(error, {
      event: "command_center.page.filter_options_load_failed",
      route: "/command-center",
      organizationId: input.organizationId,
      userId: input.userId,
      payload: {
        resource: "filter_options",
        degradedRender: true,
        fallback: "empty_command_center_filters",
      },
    });

    return {
      filterOptions: EMPTY_COMMAND_CENTER_FILTER_OPTIONS,
      filterOptionsError:
        "Command center filters could not be loaded. Filter options are temporarily unavailable.",
    };
  }
}

async function loadCommandCenterReadinessState(input: {
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
      event: "command_center.page.readiness_load_failed",
      route: "/command-center",
      organizationId: input.organizationId,
      userId: input.userId,
      payload: {
        resource: "workspace_readiness",
        degradedRender: true,
        fallback: "command_center_without_readiness",
      },
    });

    return {
      workspaceReadiness: null,
      readinessError:
        "Workspace setup status could not be loaded. Command center charts are still available, but readiness guidance is temporarily unavailable.",
    };
  }
}

export default async function CommandCenterPage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string | string[] }>;
}) {
  const user = await requireUser();
  const resolvedSearchParams = (await searchParams) ?? {};
  const view = normalizeActionCenterView(resolvedSearchParams.view);

  const { initialData, dataError } = await loadCommandCenterDataState({
    organizationId: user.organizationId,
    userId: user.id,
  });
  const { filterOptions, filterOptionsError } =
    await loadCommandCenterFilterOptionsState({
      organizationId: user.organizationId,
      userId: user.id,
    });
  const { workspaceReadiness, readinessError } =
    await loadCommandCenterReadinessState({
      organizationId: user.organizationId,
      userId: user.id,
    });
  const { actions } = await loadActionQueueState({
    organizationId: user.organizationId,
    userId: user.id,
    view,
  });

  const viewOptions = [
    { label: "My Open Actions", href: "/command-center", active: view === "mine" },
    { label: "All Open Actions", href: "/command-center?view=all", active: view === "all" },
  ];

  return (
    <div className="space-y-8">
      <SectionHeading
        title="Action Center"
        subtitle="One place for what needs your attention — pending approvals and open workflow actions, plus the portfolio context behind them."
        action={
          <a href="/api/export" className={SERVER_OUTLINE_BUTTON_CLASS}>
            Export workbook
          </a>
        }
      />

      <section className="space-y-4" aria-label="Open actions">
        <OpenActionsList
          actions={serializeDecimals(actions)}
          readiness={serializeDecimals(workspaceReadiness)}
          view={view}
          viewOptions={viewOptions}
        />
      </section>

      <section className="space-y-4" aria-label="Portfolio command center">
        <CommandCenterClient
          initialData={serializeDecimals(initialData)}
          filterOptions={filterOptions}
          readiness={serializeDecimals(workspaceReadiness)}
          loadState={{
            dataError,
            filterOptionsError,
            readinessError,
          }}
        />
      </section>
    </div>
  );
}
