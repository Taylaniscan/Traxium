export const dynamic = "force-dynamic";

import Link from "next/link";
import { SavingCardTable } from "@/components/saving-cards/saving-card-table";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireUser } from "@/lib/auth";
import { getSavingCards, getWorkspaceReadiness } from "@/lib/data";

type SavingCards = Awaited<ReturnType<typeof getSavingCards>>;
type WorkspaceReadiness = Awaited<ReturnType<typeof getWorkspaceReadiness>>;

export default async function SavingCardsPage() {
  const user = await requireUser();

  let cards: SavingCards = [];
  let workspaceReadiness: WorkspaceReadiness | null = null;

  const [cardsResult, readinessResult] = await Promise.allSettled([
    getSavingCards(user.organizationId),
    getWorkspaceReadiness(user.organizationId),
  ]);

  if (cardsResult.status === "fulfilled") {
    cards = cardsResult.value;
  } else {
    console.log("Saving cards could not be loaded:", cardsResult.reason);
  }

  if (readinessResult.status === "fulfilled") {
    workspaceReadiness = readinessResult.value;
  } else {
    console.log("Workspace readiness could not be loaded:", readinessResult.reason);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <SectionHeading title="Saving Cards" />
        <Link href="/saving-cards/new">
          <Button>Create Saving Card</Button>
        </Link>
      </div>
      <SavingCardTable cards={cards} readiness={workspaceReadiness} />
    </div>
  );
}
