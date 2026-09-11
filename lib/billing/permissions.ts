import type { OrganizationRole, Role } from "@prisma/client";

import { canManageOrganizationMembers } from "@/lib/organizations";

type BillingPermissionInput = {
  appRole: Role;
  membershipRole: OrganizationRole;
};

export function canManageWorkspaceBilling({
  membershipRole,
}: BillingPermissionInput) {
  return canManageOrganizationMembers(membershipRole);
}
