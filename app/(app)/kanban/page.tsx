import { KanbanBoard } from "@/components/kanban/kanban-board";
import { SectionHeading } from "@/components/ui/section-heading";
import { getSavingCards } from "@/lib/data";

export default async function KanbanPage() {
  const cards = await getSavingCards();

  return (
    <div className="space-y-6">
      <SectionHeading title="Kanban Board" />
      <KanbanBoard initialCards={cards as never} />
    </div>
  );
}
