export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

import { AdminActivityList } from "@/components/admin/admin-activity-list";
import { WorkspaceSettingsForm } from "@/components/admin/workspace-settings-form";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireOrganization } from "@/lib/auth";
import {
  canManageOrganizationMembers,
  getOrganizationAdminAuditEvents,
  getOrganizationSettings,
} from "@/lib/organizations";

export default async function AdminSettingsPage() {
  const user = await requireOrganization();

  if (!canManageOrganizationMembers(user.activeOrganization.membershipRole)) {
    redirect("/dashboard");
  }

  const organizationId = user.activeOrganization.organizationId;
  const [organization, auditEvents] = await Promise.all([
    getOrganizationSettings(organizationId),
    getOrganizationAdminAuditEvents(organizationId),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <SectionHeading title="Workspace Settings" />
        <p className="max-w-3xl text-sm text-[var(--muted-foreground)]">
          Manage the active workspace identity and review recent admin actions without leaving the tenant boundary.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <WorkspaceSettingsForm organization={organization} />
        <AdminActivityList events={auditEvents} />
      </div>
    </div>
  );
}
