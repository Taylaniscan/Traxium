import { KanbanBoard } from "@/components/kanban/kanban-board";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireUser } from "@/lib/auth";
import { getSavingCards } from "@/lib/data";

export default async function KanbanPage() {
  const user = await requireUser();
  const cards = await getSavingCards(user.organizationId);

  return (
    <div className="space-y-6">
      <SectionHeading title="Kanban Board" />
      <KanbanBoard initialCards={cards} />
    </div>
  );
}
