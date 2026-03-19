import { KanbanBoard } from "@/components/kanban/kanban-board";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireUser } from "@/lib/auth";
import { getSavingCards, getWorkspaceReadiness } from "@/lib/data";
import type { WorkspaceReadiness } from "@/lib/types";

type KanbanCards = Awaited<ReturnType<typeof getSavingCards>>;

export default async function KanbanPage() {
  const user = await requireUser();

  let cards: KanbanCards = [];
  let workspaceReadiness: WorkspaceReadiness | null = null;

  const [cardsResult, readinessResult] = await Promise.allSettled([
    getSavingCards(user.organizationId),
    getWorkspaceReadiness(user.organizationId),
  ]);

  if (cardsResult.status === "fulfilled") {
    cards = cardsResult.value;
  } else {
    console.log("Kanban data could not be loaded:", cardsResult.reason);
  }

  if (readinessResult.status === "fulfilled") {
    workspaceReadiness = readinessResult.value;
  } else {
    console.log("Workspace readiness could not be loaded:", readinessResult.reason);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <SectionHeading title="Kanban Board" />
          {workspaceReadiness ? (
            <span className="inline-flex rounded-full bg-[var(--muted)] px-3 py-1 text-xs font-medium text-[var(--muted-foreground)]">
              {workspaceReadiness.workspace.name}
            </span>
          ) : null}
        </div>
        <p className="max-w-3xl text-sm text-[var(--muted-foreground)]">
          {workspaceReadiness
            ? `${workspaceReadiness.workspace.name} board reflects live organization-scoped workflow stages, approval handoffs, and sourcing momentum.`
            : "This board reflects live organization-scoped workflow stages, approval handoffs, and sourcing momentum."}
        </p>
      </div>
      <KanbanBoard initialCards={cards} readiness={workspaceReadiness} />
    </div>
  );
}
