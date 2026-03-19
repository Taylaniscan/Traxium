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
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <SectionHeading title="Reports" />
          {workspaceReadiness ? (
            <span className="inline-flex rounded-full bg-[var(--muted)] px-3 py-1 text-xs font-medium text-[var(--muted-foreground)]">
              {workspaceReadiness.workspace.name}
            </span>
          ) : null}
        </div>
        <p className="max-w-3xl text-sm text-[var(--muted-foreground)]">
          {workspaceReadiness
            ? `${workspaceReadiness.workspace.name} reporting operations cover workbook export, controlled bulk import, and portfolio coverage checks across ${workspaceReadiness.counts.savingCards} live organization-scoped saving card${workspaceReadiness.counts.savingCards === 1 ? "" : "s"}.`
            : "Reporting operations cover workbook export, controlled bulk import, and portfolio coverage checks for the current workspace."}
        </p>
      </div>
      <ImportExportPanel readiness={workspaceReadiness} />
    </div>
  );
}
