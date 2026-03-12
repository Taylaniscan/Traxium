import { CommandCenterClient } from "@/components/command-center/command-center-client";
import { SectionHeading } from "@/components/ui/section-heading";
import { getCommandCenterData, getCommandCenterFilterOptions } from "@/lib/data";

export default async function CommandCenterPage() {
  const [initialData, filterOptions] = await Promise.all([getCommandCenterData(), getCommandCenterFilterOptions()]);

  return (
    <div className="space-y-6">
      <SectionHeading title="Command Center" />
      <CommandCenterClient initialData={initialData} filterOptions={filterOptions} />
    </div>
  );
}
