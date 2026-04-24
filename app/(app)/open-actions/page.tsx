export const dynamic = "force-dynamic";

import { OpenActionsList } from "@/components/open-actions/open-actions-list";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireUser } from "@/lib/auth";
import {
  getPendingApprovals,
  getPendingPhaseChangeRequests,
  getWorkspaceReadiness,
} from "@/lib/data";
import { captureException } from "@/lib/observability";
import { roleLabels } from "@/lib/constants";

type PendingApprovals = Awaited<ReturnType<typeof getPendingApprovals>>;
type PendingPhaseChangeRequests = Awaited<
  ReturnType<typeof getPendingPhaseChangeRequests>
>;
type WorkspaceReadiness = Awaited<ReturnType<typeof getWorkspaceReadiness>>;
type OpenActionsView = "mine" | "all";

function normalizeOpenActionsView(value?: string | string[]): OpenActionsView {
  const normalized = Array.isArray(value) ? value[0] : value;
  return normalized === "all" ? "all" : "mine";
}

export default async function OpenActionsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const user = await requireUser();
  const resolvedSearchParams = await searchParams;
  const view = normalizeOpenActionsView(resolvedSearchParams.view);

  let approvals: PendingApprovals = [];
  let requests: PendingPhaseChangeRequests = [];
  let workspaceReadiness: WorkspaceReadiness | null = null;

  const [actionsResult, readinessResult] = await Promise.allSettled([
    view === "all"
      ? getPendingPhaseChangeRequests(user.organizationId)
      : getPendingApprovals(user.id, user.organizationId),
    getWorkspaceReadiness(user.organizationId),
  ]);

  if (actionsResult.status === "fulfilled") {
    if (view === "all") {
      requests = actionsResult.value as PendingPhaseChangeRequests;
    } else {
      approvals = actionsResult.value as PendingApprovals;
    }
  } else {
    captureException(actionsResult.reason, {
      event: "open_actions.page.actions_load_failed",
      route: "/open-actions",
      organizationId: user.organizationId,
      userId: user.id,
      payload: {
        resource: view === "all" ? "pending_phase_change_requests" : "pending_approvals",
        degradedRender: true,
        fallback: "empty_actions_list",
        view,
      },
    });
  }

  if (readinessResult.status === "fulfilled") {
    workspaceReadiness = readinessResult.value;
  } else {
    captureException(readinessResult.reason, {
      event: "open_actions.page.readiness_load_failed",
      route: "/open-actions",
      organizationId: user.organizationId,
      userId: user.id,
      payload: {
        resource: "workspace_readiness",
        degradedRender: true,
        fallback: "actions_without_readiness",
        view,
      },
    });
  }

  const actions =
    view === "all"
      ? requests.map((request) => {
          const pendingApproverRoles = [
            ...new Set(
              request.approvals.map((approval) => roleLabels[approval.approver.role])
            ),
          ];
          const canDecide = request.approvals.some(
            (approval) => approval.approverId === user.id
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
        })
      : approvals.map((approval) => ({
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
        }));

  const viewOptions = [
    {
      label: "My Open Actions",
      href: "/open-actions",
      active: view === "mine",
    },
    {
      label: "All Open Actions",
      href: "/open-actions?view=all",
      active: view === "all",
    },
  ];

  return (
    <div className="space-y-6">
      <SectionHeading title="Open Actions" />
      <OpenActionsList
        actions={actions}
        readiness={workspaceReadiness}
        view={view}
        viewOptions={viewOptions}
      />
    </div>
  );
}
