import { requireUser } from "@/lib/auth";
import { getWorkspaceReadiness } from "@/lib/data";
import { ImportExportPanel } from "@/components/reports/import-export-panel";
import { SectionHeading } from "@/components/ui/section-heading";
import type { WorkspaceReadiness } from "@/lib/types";

export default async function ReportsPage() {
  const user = await requireUser();

  let workspaceReadiness: WorkspaceReadiness | null = null;

  try {
    workspaceReadiness = await getWorkspaceReadiness(user.organizationId);
  } catch (error) {
    console.log("Workspace readiness could not be loaded:", error);
  }

  return (
    <div className="space-y-6">
      <SectionHeading title="Reports" />
      <ImportExportPanel readiness={workspaceReadiness} />
    </div>
  );
}
