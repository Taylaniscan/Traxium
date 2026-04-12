import { notFound } from "next/navigation";
import { SavingCardForm } from "@/components/saving-cards/saving-card-form";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireUser } from "@/lib/auth";
import { getReferenceData, getSavingCard } from "@/lib/data";

export default async function EditSavingCardPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const [referenceData, card] = await Promise.all([
    getReferenceData(user.organizationId),
    getSavingCard(id, user.organizationId),
  ]);

  if (!card) notFound();

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <SectionHeading title={card.title} />
        <p className="max-w-3xl text-[15px] leading-7 text-[var(--muted-foreground)]">
          Update scope, commercial assumptions, dates, and stakeholders without changing the underlying workflow rules.
        </p>
      </div>
      <SavingCardForm mode="edit" referenceData={referenceData} card={card} />
    </div>
  );
}
