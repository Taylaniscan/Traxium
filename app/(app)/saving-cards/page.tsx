export const dynamic = "force-dynamic";

import Link from "next/link";
import { SavingCardTable } from "@/components/saving-cards/saving-card-table";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { getSavingCards } from "@/lib/data";

type SavingCards = Awaited<ReturnType<typeof getSavingCards>>;

export default async function SavingCardsPage() {
  let cards: SavingCards = [];

  try {
    cards = await getSavingCards();
  } catch (error) {
    console.log("Saving cards could not be loaded:", error);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <SectionHeading title="Saving Cards" />
        <Link href="/saving-cards/new">
          <Button>Create Saving Card</Button>
        </Link>
      </div>
      <SavingCardTable cards={cards as never} />
    </div>
  );
}