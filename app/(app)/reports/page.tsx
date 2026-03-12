import { ImportExportPanel } from "@/components/reports/import-export-panel";
import { SectionHeading } from "@/components/ui/section-heading";

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <SectionHeading title="Reports" />
      <ImportExportPanel />
    </div>
  );
}
