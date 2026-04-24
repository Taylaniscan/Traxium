import { KanbanBoard } from "@/components/kanban/kanban-board";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireUser } from "@/lib/auth";
import { getSavingCards, getWorkspaceReadiness } from "@/lib/data";
import { captureException } from "@/lib/observability";
import type { WorkspaceReadiness } from "@/lib/types";

type KanbanCards = Awaited<ReturnType<typeof getSavingCards>>;

async function loadKanbanCards(input: {
  organizationId: string;
  userId: string;
}) {
  try {
    return {
      cards: (await getSavingCards(input.organizationId)) as KanbanCards,
      cardsError: null,
    };
  } catch (error) {
    captureException(error, {
      event: "kanban.page.cards_load_failed",
      route: "/kanban",
      organizationId: input.organizationId,
      userId: input.userId,
      payload: {
        resource: "saving_cards",
        degradedRender: true,
        fallback: "empty_kanban_board",
      },
    });

    return {
      cards: [] as KanbanCards,
      cardsError:
        "Kanban board data could not be loaded right now. Refresh the page or try again in a moment.",
    };
  }
}

async function loadWorkspaceReadinessState(input: {
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
      event: "kanban.page.readiness_load_failed",
      route: "/kanban",
      organizationId: input.organizationId,
      userId: input.userId,
      payload: {
        resource: "workspace_readiness",
        degradedRender: true,
        fallback: "kanban_without_readiness",
      },
    });

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
      loadKanbanCards({
        organizationId: user.organizationId,
        userId: user.id,
      }),
      loadWorkspaceReadinessState({
        organizationId: user.organizationId,
        userId: user.id,
      }),
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
