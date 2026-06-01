import type { OrganizationRole, Role } from "@prisma/client";

import { canManageOrganizationMembers } from "@/lib/organizations";
import { hasPermission } from "@/lib/permissions";

type BillingPermissionInput = {
  appRole: Role;
  membershipRole: OrganizationRole;
};

export function canManageWorkspaceBilling({
  appRole,
  membershipRole,
}: BillingPermissionInput) {
  return (
    canManageOrganizationMembers(membershipRole) ||
    hasPermission(appRole, "manageWorkspace")
  );
}
