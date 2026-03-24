import { Phase, Role } from "@prisma/client";
import type { AppPermission } from "@/lib/types";

export const globalAccessRoles = [
  Role.HEAD_OF_GLOBAL_PROCUREMENT,
  Role.GLOBAL_CATEGORY_LEADER,
  Role.FINANCIAL_CONTROLLER,
] as const;

const ROLE_PERMISSIONS: Record<Role, readonly AppPermission[]> = {
  [Role.HEAD_OF_GLOBAL_PROCUREMENT]: [
    "viewWorkspace",
    "manageWorkspace",
    "viewReports",
    "exportWorkbook",
    "manageSavingCards",
    "approvePhaseChanges",
  ],
  [Role.GLOBAL_CATEGORY_LEADER]: [
    "viewWorkspace",
    "manageWorkspace",
    "viewReports",
    "exportWorkbook",
    "manageSavingCards",
    "approvePhaseChanges",
  ],
  [Role.TACTICAL_BUYER]: [
    "viewWorkspace",
    "manageSavingCards",
  ],
  [Role.PROCUREMENT_ANALYST]: [
    "viewWorkspace",
    "viewReports",
    "manageSavingCards",
  ],
  [Role.FINANCIAL_CONTROLLER]: [
    "viewWorkspace",
    "manageWorkspace",
    "viewReports",
    "exportWorkbook",
    "manageSavingCards",
    "approvePhaseChanges",
    "lockFinance",
  ],
};

const PHASE_APPROVER_ROLES: Record<Phase, readonly Role[]> = {
  [Phase.IDEA]: [Role.HEAD_OF_GLOBAL_PROCUREMENT],
  [Phase.VALIDATED]: [Role.GLOBAL_CATEGORY_LEADER],
  [Phase.REALISED]: [Role.FINANCIAL_CONTROLLER],
  [Phase.ACHIEVED]: [Role.HEAD_OF_GLOBAL_PROCUREMENT],
  [Phase.CANCELLED]: [],
};

const FINANCE_LOCK_ROLES = new Set<Role>([Role.FINANCIAL_CONTROLLER]);

const LOCKED_FINANCE_FIELDS = new Set([
  "baselinePrice",
  "newPrice",
  "annualVolume",
  "currency",
  "impactStartDate",
  "impactEndDate",
]);

export function getPermissionsForRole(role: Role): readonly AppPermission[] {
  return ROLE_PERMISSIONS[role];
}

export function requiredRolesForPhase(phase: Phase): Role[] {
  return [...PHASE_APPROVER_ROLES[phase]];
}

export function hasAnyRole(role: Role, roles: readonly Role[]): boolean {
  return roles.includes(role);
}

export function hasPermission(role: Role, permission: AppPermission): boolean {
  return getPermissionsForRole(role).includes(permission);
}

export function hasAnyPermission(role: Role, permissions: readonly AppPermission[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

export function hasGlobalAccessRole(role: Role): boolean {
  return hasAnyRole(role, globalAccessRoles);
}

export function canApprovePhase(role: Role, phase: Phase): boolean {
  return hasPermission(role, "approvePhaseChanges") && hasAnyRole(role, PHASE_APPROVER_ROLES[phase]);
}

export function canLockFinance(role: Role): boolean {
  return FINANCE_LOCK_ROLES.has(role) && hasPermission(role, "lockFinance");
}

export function isLockedField(field: string): boolean {
  return LOCKED_FINANCE_FIELDS.has(field);
}
