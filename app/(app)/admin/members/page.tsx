export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

import { MembersManagementPanel } from "@/components/admin/members-management";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireOrganization } from "@/lib/auth";
import {
  canManageOrganizationMembers,
  getOrganizationMembersDirectory,
} from "@/lib/organizations";

export default async function AdminMembersPage() {
  const user = await requireOrganization();

  if (!canManageOrganizationMembers(user.activeOrganization.membershipRole)) {
    redirect("/dashboard");
  }

  const directory = await getOrganizationMembersDirectory(
    user.activeOrganization.organizationId
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <SectionHeading title="Members" />
        <p className="max-w-3xl text-sm text-[var(--muted-foreground)]">
          Review active workspace access, membership posture, and pending invitations
          for the currently selected organization only.
        </p>
      </div>

      <MembersManagementPanel
        members={directory.members}
        pendingInvites={directory.pendingInvites}
        viewerMembershipId={user.activeOrganization.membershipId}
        viewerMembershipRole={user.activeOrganization.membershipRole}
      />
    </div>
  );
}
