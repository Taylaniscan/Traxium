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
export const savingTypes = [
  "PRICE_REDUCTION",
  "SUPPLIER_SWITCH",
  "REBATE_CREDIT",
  "SPECIFICATION_CHANGE",
  "VOLUME_CONSOLIDATION",
  "FREIGHT_LOGISTICS",
  "PAYMENT_TERMS",
  "PROCESS_TOLLING",
  "COST_AVOIDANCE",
  "OTHER"
] as const;
export const savingsImpactTypes = [
  "HARD_SAVINGS",
  "COST_AVOIDANCE",
  "CASH_FLOW_IMPROVEMENT",
  "WORKING_CAPITAL_IMPACT",
  "RISK_CONTINUITY_BENEFIT"
] as const;
export const savingsImpactRecurrences = [
  "RECURRING",
  "ONE_TIME",
  "TEMPORARY",
  "UNKNOWN"
] as const;
export const savingsBudgetImpacts = [
  "BUDGET_IMPACT",
  "FORECAST_AVOIDANCE",
  "NON_BUDGET_OPERATIONAL_BENEFIT",
  "UNKNOWN"
] as const;
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
  IDEA: "Proposed",
  VALIDATED: "Finance Validated",
  REALISED: "Implemented",
  ACHIEVED: "Captured",
  CANCELLED: "Canceled"
};

export const phaseShortLabels: Record<(typeof phases)[number], string> = {
  IDEA: "Proposed",
  VALIDATED: "Validated",
  REALISED: "Implemented",
  ACHIEVED: "Captured",
  CANCELLED: "Canceled"
};

const phaseEnumPattern = new RegExp(`\\b(?:${phases.join("|")})\\b`, "gu");

export function formatPhaseReferencesForDisplay(value: string) {
  return value
    .replace(
      phaseEnumPattern,
      (phase) => phaseLabels[phase as (typeof phases)[number]]
    )
    .replace(/\brealised\b/giu, (match) =>
      match[0] === match[0]?.toUpperCase() ? "Implemented" : "implemented"
    )
    .replace(/\bcancelled\b/giu, (match) =>
      match[0] === match[0]?.toUpperCase() ? "Canceled" : "canceled"
    );
}

export const phaseDescriptions: Record<(typeof phases)[number], string> = {
  IDEA: "Savings initiative identified but not yet finance validated.",
  VALIDATED: "Assumptions and value reviewed for finance trust.",
  REALISED: "Commercial or operational change has been put in place.",
  ACHIEVED: "Savings impact has been confirmed and captured.",
  CANCELLED: "Initiative stopped with a recorded reason."
};

export const roleLabels: Record<(typeof roles)[number], string> = {
  HEAD_OF_GLOBAL_PROCUREMENT: "Procurement Lead",
  GLOBAL_CATEGORY_LEADER: "Category Owner",
  TACTICAL_BUYER: "Buyer",
  PROCUREMENT_ANALYST: "Procurement Analyst",
  FINANCIAL_CONTROLLER: "Finance Reviewer"
};

export const roleDescriptions: Record<(typeof roles)[number], string> = {
  HEAD_OF_GLOBAL_PROCUREMENT: "Owns procurement governance and validates progression to finance review.",
  GLOBAL_CATEGORY_LEADER: "Owns savings initiatives for a category or material group.",
  TACTICAL_BUYER: "Supports supplier follow-up, implementation, and evidence collection.",
  PROCUREMENT_ANALYST: "Supports data quality, reporting, and savings evidence.",
  FINANCIAL_CONTROLLER: "Reviews savings assumptions, evidence, and validation status."
};

export const savingTypeLabels: Record<(typeof savingTypes)[number], string> = {
  PRICE_REDUCTION: "Price Reduction",
  SUPPLIER_SWITCH: "Supplier Switch",
  REBATE_CREDIT: "Rebate / Credit",
  SPECIFICATION_CHANGE: "Specification Change",
  VOLUME_CONSOLIDATION: "Volume Consolidation",
  FREIGHT_LOGISTICS: "Freight / Logistics",
  PAYMENT_TERMS: "Payment Terms",
  PROCESS_TOLLING: "Process / Tolling",
  COST_AVOIDANCE: "Cost Avoidance",
  OTHER: "Other"
};

export const savingTypeDescriptions: Record<(typeof savingTypes)[number], string> = {
  PRICE_REDUCTION: "A lower unit price for the same purchased requirement.",
  SUPPLIER_SWITCH: "Value created by moving awarded demand to another supplier.",
  REBATE_CREDIT: "A rebate, credit, or retrospective commercial payment.",
  SPECIFICATION_CHANGE: "Value enabled by changing material, design, or specification.",
  VOLUME_CONSOLIDATION: "Value created by aggregating demand, sites, or suppliers.",
  FREIGHT_LOGISTICS: "Value from freight, routing, packaging, or logistics changes.",
  PAYMENT_TERMS: "Value from negotiated payment timing or commercial terms.",
  PROCESS_TOLLING: "Value from process, service, tolling, or subcontracting changes.",
  COST_AVOIDANCE: "A prevented future increase rather than a current-price reduction.",
  OTHER: "A procurement benefit not covered by the standard categories."
};

export const savingsImpactTypeLabels: Record<(typeof savingsImpactTypes)[number], string> = {
  HARD_SAVINGS: "Hard Savings",
  COST_AVOIDANCE: "Cost Avoidance",
  CASH_FLOW_IMPROVEMENT: "Cash Flow Improvement",
  WORKING_CAPITAL_IMPACT: "Working Capital Impact",
  RISK_CONTINUITY_BENEFIT: "Risk / Continuity Benefit"
};

export const savingsImpactTypeDescriptions: Record<(typeof savingsImpactTypes)[number], string> = {
  HARD_SAVINGS: "A measurable reduction against the approved baseline.",
  COST_AVOIDANCE: "A forecasted increase or future cost that was prevented.",
  CASH_FLOW_IMPROVEMENT: "A benefit that improves cash timing or cash requirements.",
  WORKING_CAPITAL_IMPACT: "A benefit that changes inventory, payables, or working capital.",
  RISK_CONTINUITY_BENEFIT: "A resilience or continuity benefit that may not reduce budget."
};

export const savingsImpactRecurrenceLabels: Record<(typeof savingsImpactRecurrences)[number], string> = {
  RECURRING: "Recurring",
  ONE_TIME: "One-Time",
  TEMPORARY: "Temporary",
  UNKNOWN: "Unknown"
};

export const savingsImpactRecurrenceDescriptions: Record<(typeof savingsImpactRecurrences)[number], string> = {
  RECURRING: "Expected to continue as an ongoing run-rate benefit.",
  ONE_TIME: "A single credit, event, or non-repeating benefit.",
  TEMPORARY: "Applies for a defined period and then expires.",
  UNKNOWN: "Recurrence has not yet been confirmed."
};

export const savingsBudgetImpactLabels: Record<(typeof savingsBudgetImpacts)[number], string> = {
  BUDGET_IMPACT: "Budget Impact",
  FORECAST_AVOIDANCE: "Forecast Avoidance",
  NON_BUDGET_OPERATIONAL_BENEFIT: "Non-Budget Operational Benefit",
  UNKNOWN: "Unknown"
};

export const savingsBudgetImpactDescriptions: Record<(typeof savingsBudgetImpacts)[number], string> = {
  BUDGET_IMPACT: "Expected to reduce an approved budget or cost baseline.",
  FORECAST_AVOIDANCE: "Prevents an expected future increase without reducing the current budget.",
  NON_BUDGET_OPERATIONAL_BENEFIT: "Creates operational, risk, cash, or continuity value outside budget savings.",
  UNKNOWN: "Budget treatment has not yet been confirmed."
};

function normalizeClassificationKey(value: unknown) {
  return typeof value === "string"
    ? value.trim().toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, "")
    : "";
}

function buildClassificationAliases<T extends string>(
  values: readonly T[],
  labels: Record<T, string>,
  aliases: Partial<Record<string, T>> = {}
) {
  const result = new Map<string, T>();

  for (const value of values) {
    result.set(normalizeClassificationKey(value), value);
    result.set(normalizeClassificationKey(labels[value]), value);
  }

  for (const [alias, value] of Object.entries(aliases)) {
    if (value) result.set(normalizeClassificationKey(alias), value);
  }

  return result;
}

const savingTypeAliases = buildClassificationAliases(savingTypes, savingTypeLabels, {
  "Price Negotiation": "PRICE_REDUCTION",
  "Commercial Negotiation": "PRICE_REDUCTION",
  "Supplier Change": "SUPPLIER_SWITCH",
  "Rebate": "REBATE_CREDIT",
  "Credit": "REBATE_CREDIT",
  "Specification": "SPECIFICATION_CHANGE",
  "Freight": "FREIGHT_LOGISTICS",
  "Logistics": "FREIGHT_LOGISTICS",
  "Tolling": "PROCESS_TOLLING"
});
const savingsImpactTypeAliases = buildClassificationAliases(
  savingsImpactTypes,
  savingsImpactTypeLabels,
  {
    "Hard Saving": "HARD_SAVINGS",
    "Risk Benefit": "RISK_CONTINUITY_BENEFIT",
    "Continuity Benefit": "RISK_CONTINUITY_BENEFIT"
  }
);
const savingsImpactRecurrenceAliases = buildClassificationAliases(
  savingsImpactRecurrences,
  savingsImpactRecurrenceLabels,
  {
    "One Time": "ONE_TIME",
    "Non Recurring": "ONE_TIME"
  }
);
const savingsBudgetImpactAliases = buildClassificationAliases(
  savingsBudgetImpacts,
  savingsBudgetImpactLabels,
  {
    "Non Budget Benefit": "NON_BUDGET_OPERATIONAL_BENEFIT",
    "Operational Benefit": "NON_BUDGET_OPERATIONAL_BENEFIT"
  }
);

function resolveClassificationValue<T extends string>(
  value: unknown,
  aliases: ReadonlyMap<string, T>
) {
  return aliases.get(normalizeClassificationKey(value)) ?? null;
}

export function parseSavingType(value: unknown) {
  return resolveClassificationValue(value, savingTypeAliases);
}

export function parseSavingsImpactType(value: unknown) {
  return resolveClassificationValue(value, savingsImpactTypeAliases);
}

export function parseSavingsImpactRecurrence(value: unknown) {
  return resolveClassificationValue(value, savingsImpactRecurrenceAliases);
}

export function parseSavingsBudgetImpact(value: unknown) {
  return resolveClassificationValue(value, savingsBudgetImpactAliases);
}
