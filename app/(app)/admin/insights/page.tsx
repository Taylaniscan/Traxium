export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

import { AdminActivationSignals } from "@/components/admin/admin-activation-signals";
import { AdminActivityList } from "@/components/admin/admin-activity-list";
import { AdminHealthPanel } from "@/components/admin/admin-health-panel";
import { AdminInsightsMetricGrid } from "@/components/admin/admin-insights-metric-grid";
import { SectionHeading } from "@/components/ui/section-heading";
import { getOrganizationAdminInsights } from "@/lib/admin-insights";
import { requireOrganization } from "@/lib/auth";
import { canManageOrganizationMembers } from "@/lib/organizations";

export default async function AdminInsightsPage() {
  const user = await requireOrganization();

  if (!canManageOrganizationMembers(user.activeOrganization.membershipRole)) {
    redirect("/dashboard");
  }

  const insights = await getOrganizationAdminInsights(
    user.activeOrganization.organizationId
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <SectionHeading title="Admin Insights" />
        <p className="max-w-3xl text-sm text-[var(--muted-foreground)]">
          Activation, invitation velocity, and tenant-scoped health signals for the currently active workspace.
        </p>
      </div>

      <AdminInsightsMetricGrid insights={insights} />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <AdminActivationSignals insights={insights} />
        <AdminHealthPanel insights={insights} />
      </div>

      <AdminActivityList events={insights.recentAdminActions} />
    </div>
  );
}
