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
      <SectionHeading
        title={card.title}
        subtitle="Update scope, commercial assumptions, dates, stakeholders, and evidence without changing the underlying workflow rules."
      />
      <SavingCardForm mode="edit" referenceData={referenceData} card={card} />
    </div>
  );
}
