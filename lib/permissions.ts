import { Phase, Role } from "@prisma/client";

export function requiredRolesForPhase(phase: Phase): Role[] {
  switch (phase) {
    case "IDEA":
      return ["HEAD_OF_GLOBAL_PROCUREMENT"];
    case "VALIDATED":
      return ["HEAD_OF_GLOBAL_PROCUREMENT", "FINANCIAL_CONTROLLER"];
    case "REALISED":
      return ["FINANCIAL_CONTROLLER"];
    case "ACHIEVED":
      return ["FINANCIAL_CONTROLLER"];
    case "CANCELLED":
      return [];
    default:
      return [];
  }
}

export function canApprovePhase(role: Role, phase: Phase) {
  return requiredRolesForPhase(phase).includes(role);
}

export function canLockFinance(role: Role) {
  return role === "FINANCIAL_CONTROLLER";
}

export function isLockedField(field: string) {
  return [
    "baselinePrice",
    "newPrice",
    "annualVolume",
    "currency",
    "impactStartDate",
    "impactEndDate"
  ].includes(field);
}
