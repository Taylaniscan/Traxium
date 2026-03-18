import { SavingCardForm } from "@/components/saving-cards/saving-card-form";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireUser } from "@/lib/auth";
import { getReferenceData } from "@/lib/data";

export default async function NewSavingCardPage() {
  const user = await requireUser();
  const referenceData = await getReferenceData(user.organizationId);

  return (
    <div className="space-y-6">
      <SectionHeading title="New Saving Card" />
      <SavingCardForm mode="create" referenceData={referenceData} />
    </div>
  );
}