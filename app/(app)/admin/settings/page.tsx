export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

import { AdminActivityList } from "@/components/admin/admin-activity-list";
import { WorkspaceSettingsForm } from "@/components/admin/workspace-settings-form";
import { WorkspaceBillingSettingsCard } from "@/components/billing/workspace-billing-settings-card";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireOrganization } from "@/lib/auth";
import { getOrganizationAccessState } from "@/lib/billing/access";
import {
  getMissingStripeBillingEnvKeys,
  isStripeBillingConfigured,
} from "@/lib/billing/config";
import { canManageWorkspaceBilling } from "@/lib/billing/permissions";
import {
  getOrganizationAdminAuditEvents,
  getOrganizationSettings,
} from "@/lib/organizations";

export default async function AdminSettingsPage() {
  const user = await requireOrganization();

  const canManageBilling = canManageWorkspaceBilling({
    appRole: user.role,
    membershipRole: user.activeOrganization.membershipRole,
  });

  if (!canManageBilling) {
    redirect("/dashboard");
  }

  const organizationId = user.activeOrganization.organizationId;
  const stripeBillingConfigured = isStripeBillingConfigured();
  const missingStripeBillingEnvKeys = stripeBillingConfigured
    ? []
    : getMissingStripeBillingEnvKeys();
  const [organization, auditEvents, accessState] = await Promise.all([
    getOrganizationSettings(organizationId),
    getOrganizationAdminAuditEvents(organizationId),
    getOrganizationAccessState(organizationId),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <SectionHeading title="Workspace Settings" />
        <p className="max-w-3xl text-sm text-[var(--muted-foreground)]">
          Manage the active workspace identity, billing, and recent admin
          actions without leaving the tenant boundary.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          <WorkspaceSettingsForm organization={organization} />
          <WorkspaceBillingSettingsCard
            workspaceName={organization.name}
            accessState={accessState}
            canManageBilling={canManageBilling}
            stripeBillingConfigured={stripeBillingConfigured}
            missingStripeBillingEnvKeys={missingStripeBillingEnvKeys}
          />
        </div>
        <AdminActivityList events={auditEvents} />
      </div>
    </div>
  );
}
