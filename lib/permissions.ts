import { Phase, Role } from "@prisma/client";

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

export function requiredRolesForPhase(phase: Phase): Role[] {
  return [...PHASE_APPROVER_ROLES[phase]];
}

export function hasAnyRole(role: Role, roles: readonly Role[]): boolean {
  return roles.includes(role);
}

export function canApprovePhase(role: Role, phase: Phase): boolean {
  return hasAnyRole(role, PHASE_APPROVER_ROLES[phase]);
}

export function canLockFinance(role: Role): boolean {
  return FINANCE_LOCK_ROLES.has(role);
}

export function isLockedField(field: string): boolean {
  return LOCKED_FINANCE_FIELDS.has(field);
}
