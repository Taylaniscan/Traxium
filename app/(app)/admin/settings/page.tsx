export const dynamic = "force-dynamic";

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
import { captureException } from "@/lib/observability";
import type { OrganizationAccessStateResult } from "@/lib/billing/types";

function createUnknownAccessState(
  organizationId: string
): OrganizationAccessStateResult {
  return {
    organizationId,
    subscriptionId: null,
    stripeSubscriptionId: null,
    rawSubscriptionStatus: null,
    accessState: "no_subscription",
    isBlocked: false,
    reasonCode: "unknown",
    currentPeriodEnd: null,
    trialEndsAt: null,
    trialSource: null,
    plan: null,
  };
}

async function loadAccessState(organizationId: string, userId: string) {
  return getOrganizationAccessState(organizationId).catch((error) => {
    captureException(error, {
      event: "admin.settings.billing_access_load_failed",
      route: "/admin/settings",
      organizationId,
      userId,
      payload: {
        resource: "billing_access_state",
        degradedRender: true,
        fallback: "unknown_billing_state",
      },
    });

    return createUnknownAccessState(organizationId);
  });
}

export default async function AdminSettingsPage() {
  const user = await requireOrganization({
    allowBillingBlocked: true,
    billingRedirectTo: null,
  });

  const canManageBilling = canManageWorkspaceBilling({
    appRole: user.role,
    membershipRole: user.activeOrganization.membershipRole,
  });

  const organizationId = user.activeOrganization.organizationId;
  const stripeBillingConfigured = isStripeBillingConfigured();
  const missingStripeBillingEnvKeys = stripeBillingConfigured
    ? []
    : getMissingStripeBillingEnvKeys();
  const [organization, accessState] = await Promise.all([
    getOrganizationSettings(organizationId),
    loadAccessState(organizationId, user.id),
  ]);
  const auditEvents = canManageBilling
    ? await getOrganizationAdminAuditEvents(organizationId)
    : [];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <SectionHeading title="Workspace Settings" />
        <p className="max-w-3xl text-sm text-[var(--muted-foreground)]">
          Manage workspace identity, billing, onboarding, and admin activity
          without leaving the tenant boundary.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          {canManageBilling ? (
            <WorkspaceSettingsForm organization={organization} />
          ) : null}
          <WorkspaceBillingSettingsCard
            workspaceName={organization.name}
            accessState={accessState}
            canManageBilling={canManageBilling}
            stripeBillingConfigured={stripeBillingConfigured}
            missingStripeBillingEnvKeys={missingStripeBillingEnvKeys}
            billingStatusUnavailable={accessState.reasonCode === "unknown"}
          />
        </div>
        {canManageBilling ? (
          <AdminActivityList events={auditEvents} />
        ) : null}
      </div>
    </div>
  );
}
