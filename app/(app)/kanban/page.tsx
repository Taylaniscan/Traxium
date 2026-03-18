import { KanbanBoard } from "@/components/kanban/kanban-board";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireUser } from "@/lib/auth";
import { getSavingCards, getWorkspaceReadiness } from "@/lib/data";

type KanbanCards = Awaited<ReturnType<typeof getSavingCards>>;
type WorkspaceReadiness = Awaited<ReturnType<typeof getWorkspaceReadiness>>;

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
      <SectionHeading title="Kanban Board" />
      <KanbanBoard initialCards={cards} readiness={workspaceReadiness} />
    </div>
  );
}
