export const dynamic = "force-dynamic";

import { TimelineBoard } from "@/components/timeline/timeline-board";
import { SectionHeading } from "@/components/ui/section-heading";
import { getReferenceData, getSavingCards } from "@/lib/data";

type TimelineCards = Awaited<ReturnType<typeof getSavingCards>>;
type TimelineReferenceData = Awaited<ReturnType<typeof getReferenceData>>;

export default async function TimelinePage() {
  let cards: TimelineCards = [];
  let referenceData: TimelineReferenceData = {
    users: [],
    suppliers: [],
    materials: [],
    categories: [],
    plants: [],
    businessUnits: [],
    fxRates: [],
  };

  try {
    [cards, referenceData] = await Promise.all([
      getSavingCards(),
      getReferenceData(),
    ]);
  } catch (error) {
    console.log("Timeline data could not be loaded:", error);
  }

  const filters = {
    categories: referenceData.categories.map((item) => ({
      id: item.id,
      name: item.name,
    })),
    buyers: referenceData.users.map((item) => ({
      id: item.id,
      name: item.name,
    })),
    suppliers: referenceData.suppliers.map((item) => ({
      id: item.id,
      name: item.name,
    })),
    businessUnits: referenceData.businessUnits.map((item) => ({
      id: item.id,
      name: item.name,
    })),
  };

  return (
    <div className="space-y-6">
      <SectionHeading title="Timeline" />
      <TimelineBoard
        cards={cards}
        nowIso={new Date().toISOString()}
        filters={filters}
      />
    </div>
  );
}