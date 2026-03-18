export const dynamic = "force-dynamic";

import { OpenActionsList } from "@/components/open-actions/open-actions-list";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireUser } from "@/lib/auth";
import { getPendingApprovals } from "@/lib/data";

type PendingApprovals = Awaited<ReturnType<typeof getPendingApprovals>>;

export default async function OpenActionsPage() {
  const user = await requireUser();

  let approvals: PendingApprovals = [];

  try {
    approvals = await getPendingApprovals(user.id, user.organizationId);
  } catch (error) {
    console.log("Open actions data could not be loaded:", error);
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
      <OpenActionsList actions={actions} />
    </div>
  );
}
