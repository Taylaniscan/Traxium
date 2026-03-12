import { SavingCardForm } from "@/components/saving-cards/saving-card-form";
import { SectionHeading } from "@/components/ui/section-heading";
import { getReferenceData } from "@/lib/data";

export default async function NewSavingCardPage() {
  const referenceData = await getReferenceData();

  return (
    <div className="space-y-6">
      <SectionHeading title="New Saving Card" />
      <SavingCardForm mode="create" referenceData={referenceData} />
    </div>
  );
}
