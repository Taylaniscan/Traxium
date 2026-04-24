export const APP_NAME = "Traxium";

export const phases = ["IDEA", "VALIDATED", "REALISED", "ACHIEVED", "CANCELLED"] as const;
export const roles = [
  "HEAD_OF_GLOBAL_PROCUREMENT",
  "GLOBAL_CATEGORY_LEADER",
  "TACTICAL_BUYER",
  "PROCUREMENT_ANALYST",
  "FINANCIAL_CONTROLLER"
] as const;
export const frequencies = ["ONE_TIME", "RECURRING", "MULTI_YEAR"] as const;
export const currencies = ["EUR", "USD"] as const;
export const savingDrivers = [
  "Negotiation",
  "Supplier Change",
  "Material Substitution",
  "Specification Optimization",
  "Volume Consolidation",
  "Logistics Optimization",
  "Payment Term Improvement",
  "Demand Reduction",
  "Index Reduction",
  "Other"
] as const;
export const implementationComplexities = ["Low", "Medium", "High", "Strategic"] as const;
export const qualificationStatuses = ["Not Started", "Lab Testing", "Plant Trial", "Approved", "Rejected"] as const;

export const phaseLabels: Record<(typeof phases)[number], string> = {
  IDEA: "Idea",
  VALIDATED: "Validated",
  REALISED: "Realised",
  ACHIEVED: "Achieved",
  CANCELLED: "Cancelled"
};

export const roleLabels: Record<(typeof roles)[number], string> = {
  HEAD_OF_GLOBAL_PROCUREMENT: "Procurement Manager",
  GLOBAL_CATEGORY_LEADER: "Procurement Specialist",
  TACTICAL_BUYER: "Buyer",
  PROCUREMENT_ANALYST: "Procurement Analyst",
  FINANCIAL_CONTROLLER: "Finance Approver"
};
