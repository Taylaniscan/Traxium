export const dynamic = "force-dynamic";

import { TimelineBoard } from "@/components/timeline/timeline-board";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireUser } from "@/lib/auth";
import { getReferenceData, getSavingCards } from "@/lib/data";

type TimelineCards = Awaited<ReturnType<typeof getSavingCards>>;
type TimelineReferenceData = Awaited<ReturnType<typeof getReferenceData>>;

const EMPTY_REFERENCE_DATA: TimelineReferenceData = {
  users: [],
  buyers: [],
  suppliers: [],
  materials: [],
  categories: [],
  plants: [],
  businessUnits: [],
  fxRates: [],
};

export default async function TimelinePage() {
  const user = await requireUser();

  let cards: TimelineCards = [];
  let referenceData: TimelineReferenceData = EMPTY_REFERENCE_DATA;

  try {
    [cards, referenceData] = await Promise.all([
      getSavingCards(user.organizationId),
      getReferenceData(user.organizationId),
    ]);
  } catch (error) {
    console.log("Timeline data could not be loaded:", error);
  }

  const filters = {
    categories: referenceData.categories.map((item) => ({
      id: item.id,
      name: item.name,
    })),
    buyers: referenceData.buyers.map((item) => ({
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
