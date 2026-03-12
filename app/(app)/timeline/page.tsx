import { TimelineBoard } from "@/components/timeline/timeline-board";
import { SectionHeading } from "@/components/ui/section-heading";
import { getReferenceData, getSavingCards } from "@/lib/data";

export default async function TimelinePage() {
  const [cards, referenceData] = await Promise.all([getSavingCards(), getReferenceData()]);

  return (
    <div className="space-y-6">
      <SectionHeading title="Timeline" />
      <TimelineBoard
        cards={cards as never}
        nowIso={new Date().toISOString()}
        filters={{
          categories: referenceData.categories,
          buyers: referenceData.users,
          suppliers: referenceData.suppliers,
          businessUnits: referenceData.businessUnits
        }}
      />
    </div>
  );
}
