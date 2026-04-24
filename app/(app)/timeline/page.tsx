export const dynamic = "force-dynamic";

import { TimelineBoard } from "@/components/timeline/timeline-board";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireUser } from "@/lib/auth";
import { getReferenceData, getSavingCards, getWorkspaceReadiness } from "@/lib/data";
import { captureException } from "@/lib/observability";
import type { WorkspaceReadiness } from "@/lib/types";

type TimelineCards = Awaited<ReturnType<typeof getSavingCards>>;
type TimelineReferenceData = Awaited<ReturnType<typeof getReferenceData>>;
type TimelineFilterOption = {
  id: string;
  name: string;
};

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
    captureException(cardsResult.reason, {
      event: "timeline.page.cards_load_failed",
      route: "/timeline",
      organizationId: user.organizationId,
      userId: user.id,
      payload: {
        resource: "saving_cards",
        degradedRender: true,
        fallback: "empty_timeline_cards",
      },
    });
  }

  if (referenceDataResult.status === "fulfilled") {
    referenceData = referenceDataResult.value;
  } else {
    captureException(referenceDataResult.reason, {
      event: "timeline.page.reference_data_load_failed",
      route: "/timeline",
      organizationId: user.organizationId,
      userId: user.id,
      payload: {
        resource: "reference_data",
        degradedRender: true,
        fallback: "empty_timeline_filters",
      },
    });
  }

  if (readinessResult.status === "fulfilled") {
    workspaceReadiness = readinessResult.value;
  } else {
    captureException(readinessResult.reason, {
      event: "timeline.page.readiness_load_failed",
      route: "/timeline",
      organizationId: user.organizationId,
      userId: user.id,
      payload: {
        resource: "workspace_readiness",
        degradedRender: true,
        fallback: "timeline_without_readiness",
      },
    });
  }

  const toFilterOption = (item: TimelineFilterOption) => ({
    id: item.id,
    name: item.name,
  });

  const filters = {
    categories: referenceData.categories.map(toFilterOption),
    buyers: referenceData.buyers.map(toFilterOption),
    suppliers: referenceData.suppliers.map(toFilterOption),
    businessUnits: referenceData.businessUnits.map(toFilterOption),
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
