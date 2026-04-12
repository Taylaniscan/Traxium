import { KanbanBoard } from "@/components/kanban/kanban-board";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireUser } from "@/lib/auth";
import { getSavingCards, getWorkspaceReadiness } from "@/lib/data";
import type { WorkspaceReadiness } from "@/lib/types";

type KanbanCards = Awaited<ReturnType<typeof getSavingCards>>;

async function loadKanbanCards(organizationId: string) {
  try {
    return {
      cards: (await getSavingCards(organizationId)) as KanbanCards,
      cardsError: null,
    };
  } catch (error) {
    console.error("Kanban data could not be loaded:", error);

    return {
      cards: [] as KanbanCards,
      cardsError:
        "Kanban board data could not be loaded right now. Refresh the page or try again in a moment.",
    };
  }
}

async function loadWorkspaceReadinessState(organizationId: string) {
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
        "Workspace setup status could not be loaded. The kanban board is still available, but readiness guidance is temporarily unavailable.",
    };
  }
}

export default async function KanbanPage() {
  const user = await requireUser();
  const [{ cards, cardsError }, { workspaceReadiness, readinessError }] =
    await Promise.all([
      loadKanbanCards(user.organizationId),
      loadWorkspaceReadinessState(user.organizationId),
    ]);

  return (
    <div className="space-y-6">
      <SectionHeading title="Kanban Board" />
      <KanbanBoard
        initialCards={cards}
        readiness={workspaceReadiness}
        loadState={{
          cardsError,
          readinessError,
        }}
      />
    </div>
  );
}
