export const dynamic = "force-dynamic";

import { TimelineBoard } from "@/components/timeline/timeline-board";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireUser } from "@/lib/auth";
import { getReferenceData, getSavingCards, getWorkspaceReadiness } from "@/lib/data";

type TimelineCards = Awaited<ReturnType<typeof getSavingCards>>;
type TimelineReferenceData = Awaited<ReturnType<typeof getReferenceData>>;
type WorkspaceReadiness = Awaited<ReturnType<typeof getWorkspaceReadiness>>;

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
  let workspaceReadiness: WorkspaceReadiness | null = null;

  const [cardsResult, referenceDataResult, readinessResult] = await Promise.allSettled([
    getSavingCards(user.organizationId),
    getReferenceData(user.organizationId),
    getWorkspaceReadiness(user.organizationId),
  ]);

  if (cardsResult.status === "fulfilled") {
    cards = cardsResult.value;
  } else {
    console.log("Timeline cards could not be loaded:", cardsResult.reason);
  }

  if (referenceDataResult.status === "fulfilled") {
    referenceData = referenceDataResult.value;
  } else {
    console.log("Timeline reference data could not be loaded:", referenceDataResult.reason);
  }

  if (readinessResult.status === "fulfilled") {
    workspaceReadiness = readinessResult.value;
  } else {
    console.log("Workspace readiness could not be loaded:", readinessResult.reason);
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
        readiness={workspaceReadiness}
      />
    </div>
  );
}
