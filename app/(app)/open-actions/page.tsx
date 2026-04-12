export const dynamic = "force-dynamic";

import { OpenActionsList } from "@/components/open-actions/open-actions-list";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireUser } from "@/lib/auth";
import { getPendingApprovals, getWorkspaceReadiness } from "@/lib/data";

type PendingApprovals = Awaited<ReturnType<typeof getPendingApprovals>>;
type WorkspaceReadiness = Awaited<ReturnType<typeof getWorkspaceReadiness>>;

export default async function OpenActionsPage() {
  const user = await requireUser();

  let approvals: PendingApprovals = [];
  let workspaceReadiness: WorkspaceReadiness | null = null;

  const [approvalsResult, readinessResult] = await Promise.allSettled([
    getPendingApprovals(user.id, user.organizationId),
    getWorkspaceReadiness(user.organizationId),
  ]);

  if (approvalsResult.status === "fulfilled") {
    approvals = approvalsResult.value;
  } else {
    console.log("Open actions data could not be loaded:", approvalsResult.reason);
  }

  if (readinessResult.status === "fulfilled") {
    workspaceReadiness = readinessResult.value;
  } else {
    console.log("Workspace readiness could not be loaded:", readinessResult.reason);
  }

  const actions = approvals.map((approval) => ({
    id: approval.id,
    requestId: approval.phaseChangeRequest.id,
    savingCardId: approval.phaseChangeRequest.savingCard.id,
    savingCardTitle: approval.phaseChangeRequest.savingCard.title,
    requestedBy: approval.phaseChangeRequest.requestedBy.name,
    requestedAt: approval.phaseChangeRequest.createdAt.toISOString(),
    currentPhase: approval.phaseChangeRequest.currentPhase,
    requestedPhase: approval.phaseChangeRequest.requestedPhase,
    comment: approval.phaseChangeRequest.comment ?? null,
  }));

  return (
    <div className="space-y-6">
      <SectionHeading title="Open Actions" />
      <OpenActionsList actions={actions} readiness={workspaceReadiness} />
    </div>
  );
}
