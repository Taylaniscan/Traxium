export const dynamic = "force-dynamic";

import Link from "next/link";
import { SavingCardTable } from "@/components/saving-cards/saving-card-table";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireUser } from "@/lib/auth";
import { getSavingCards, getWorkspaceReadiness } from "@/lib/data";
import type { WorkspaceReadiness } from "@/lib/types";

type SavingCards = Awaited<ReturnType<typeof getSavingCards>>;

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
      <div className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <SectionHeading title="Saving Cards" />
              {workspaceReadiness ? (
                <span className="inline-flex rounded-full bg-[var(--muted)] px-3 py-1 text-xs font-medium text-[var(--muted-foreground)]">
                  {workspaceReadiness.workspace.name}
                </span>
              ) : null}
            </div>
            <p className="max-w-3xl text-sm text-[var(--muted-foreground)]">
              {workspaceReadiness
                ? `${workspaceReadiness.workspace.name} portfolio reflects live organization-scoped initiatives, ownership, supplier exposure, and finance controls.`
                : "This portfolio reflects live organization-scoped initiatives, ownership, supplier exposure, and finance controls."}
            </p>
          </div>
          <Link href="/saving-cards/new">
            <Button>Create Saving Card</Button>
          </Link>
        </div>
      </div>
      <SavingCardTable cards={cards} readiness={workspaceReadiness} />
    </div>
  );
}
