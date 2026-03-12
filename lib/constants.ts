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
  HEAD_OF_GLOBAL_PROCUREMENT: "Head of Global Procurement",
  GLOBAL_CATEGORY_LEADER: "Global Category Leader",
  TACTICAL_BUYER: "Tactical Buyer",
  PROCUREMENT_ANALYST: "Procurement Analyst",
  FINANCIAL_CONTROLLER: "Financial Controller"
};
