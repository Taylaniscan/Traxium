import type { Phase } from "@prisma/client";

import {
  currencies,
  phaseDescriptions,
  phaseLabels,
  phases,
  savingTypeLabels,
  savingTypes,
  savingsBudgetImpactLabels,
  savingsBudgetImpacts,
  savingsImpactRecurrenceLabels,
  savingsImpactRecurrences,
  savingsImpactTypeLabels,
  savingsImpactTypes,
} from "@/lib/constants";
import { getEvidenceStatus, isFinanceEvidenceReviewPhase } from "@/lib/evidence";
import { evidenceTypeLabels } from "@/lib/evidence-config";
import type { SavingCardPortfolio, WorkspaceReadiness } from "@/lib/types";

export type ControllerWorkbookCell = string | number | Date;
export type ControllerWorkbookRow = Record<string, ControllerWorkbookCell>;

export const controllerSavingCardColumns = [
  "Saving Card Title",
  "Phase",
  "Savings Type",
  "Impact Type",
  "Impact Recurrence",
  "Budget Impact",
  "Buyer / Owner",
  "Supplier",
  "Alternative Supplier",
  "Material",
  "Alternative Material",
  "Category",
  "Plant",
  "Business Unit",
  "Baseline Price",
  "New Price",
  "Annual Volume",
  "Volume Unit",
  "Currency",
  "Calculated Savings (Local)",
  "Savings EUR",
  "Savings USD",
  "Impact Start Date",
  "Impact End Date",
  "Finance Lock Status",
  "Evidence Count",
  "Evidence Status",
  "Evidence Types",
  "Last Evidence Upload Date",
  "Pending Approval Status",
  "Last Phase Change Date",
  "Last Updated",
  "Cancellation Reason",
  "Business Case / Notes",
] as const;

export const evidenceSummaryColumns = [
  "Saving Card Title",
  "Phase",
  "Evidence Count",
  "Evidence Status",
  "Evidence Types",
  "Last Evidence Upload Date",
  "Finance Lock Status",
] as const;

export const importTemplateColumns = [
  "Title",
  "Savings Type",
  "Impact Type",
  "Impact Recurrence",
  "Budget Impact",
  "Phase",
  "Buyer",
  "Supplier",
  "Material",
  "Category",
  "Plant",
  "Business Unit",
  "Baseline Price",
  "New Price",
  "Annual Volume",
  "Currency",
  "Start Date",
  "End Date",
  "Impact Start Date",
  "Impact End Date",
  "Business Case / Notes",
] as const;

export type ControllerWorkbookModel = {
  generatedAt: Date;
  reportingCurrency: "EUR";
  portfolioSummaryRows: ControllerWorkbookCell[][];
  savingCardRows: ControllerWorkbookRow[];
  dataDictionaryRows: ControllerWorkbookCell[][];
  importTemplateRows: ControllerWorkbookRow[];
  evidenceSummaryRows: ControllerWorkbookRow[];
  reconciliation: {
    activeCardCount: number;
    activeSavings: number;
    activeRowSavings: number;
    difference: number;
    phaseCounts: Record<Phase, number>;
    evidenceCoveragePercent: number;
    financeLockedSavings: number;
  };
};

const columnDefinitions: Record<
  (typeof controllerSavingCardColumns)[number],
  string
> = {
  "Saving Card Title": "Customer-facing initiative title.",
  Phase: "Current approved workflow phase.",
  "Savings Type": "Commercial or operational mechanism producing the benefit.",
  "Impact Type": "Finance-facing nature of the benefit.",
  "Impact Recurrence": "Whether the impact is recurring, one-time, temporary, or unknown.",
  "Budget Impact": "Budget or forecast treatment used for review.",
  "Buyer / Owner": "Procurement owner accountable for the saving card.",
  Supplier: "Current or baseline supplier.",
  "Alternative Supplier": "Selected or manually entered alternative supplier, when present.",
  Material: "Current or baseline material.",
  "Alternative Material": "Selected or manually entered alternative material, when present.",
  Category: "Procurement category.",
  Plant: "Plant or operating site in scope.",
  "Business Unit": "Business unit in scope.",
  "Baseline Price": "Approved baseline unit price used in the savings calculation.",
  "New Price": "Negotiated or implemented unit price.",
  "Annual Volume": "Annualized quantity used in the savings calculation.",
  "Volume Unit": "Unit of measure for annual volume.",
  Currency: "Commercial assumption currency.",
  "Calculated Savings (Local)": "Calculated savings in the card currency.",
  "Savings EUR": "Calculated savings in Traxium reporting currency.",
  "Savings USD": "Calculated savings translated to USD.",
  "Impact Start Date": "Date the financial or operational impact begins.",
  "Impact End Date": "Date the financial or operational impact ends.",
  "Finance Lock Status": "Whether finance-controlled assumptions are locked against normal edits.",
  "Evidence Count": "Number of private evidence records attached to the saving card.",
  "Evidence Status": "Evidence Attached, Missing Evidence, or Evidence Recommended based on phase and count.",
  "Evidence Types": "Distinct customer-facing evidence categories attached to the card.",
  "Last Evidence Upload Date": "Most recent evidence upload date.",
  "Pending Approval Status": "Current pending phase-change request, if any.",
  "Last Phase Change Date": "Most recent approved phase-history timestamp.",
  "Last Updated": "Most recent saving-card update timestamp.",
  "Cancellation Reason": "Recorded reason when a card is canceled.",
  "Business Case / Notes": "Saving-card description and business case.",
};

function normalizeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function sumSavings(cards: SavingCardPortfolio[]) {
  return cards.reduce(
    (sum, card) => sum + normalizeNumber(card.calculatedSavings),
    0
  );
}

function getLocalSavings(card: SavingCardPortfolio) {
  return card.currency === "USD"
    ? normalizeNumber(card.calculatedSavingsUSD)
    : normalizeNumber(card.calculatedSavings);
}

function getPendingApprovalStatus(card: SavingCardPortfolio) {
  const pendingRequest = card.phaseChangeRequests.find(
    (request) => request.approvalStatus === "PENDING"
  );

  return pendingRequest
    ? `Pending: ${phaseLabels[pendingRequest.requestedPhase]}`
    : "None";
}

function getEvidenceTypes(card: SavingCardPortfolio) {
  return [
    ...new Set(
      card.evidence.map(
        (item) => evidenceTypeLabels[item.evidenceType] ?? "Other"
      )
    ),
  ].join(", ");
}

export function mapSavingCardsForControllerExport(
  cards: SavingCardPortfolio[]
): ControllerWorkbookRow[] {
  return cards.map((card) => ({
    "Saving Card Title": card.title,
    Phase: phaseLabels[card.phase],
    "Savings Type": savingTypeLabels[card.savingType],
    "Impact Type": savingsImpactTypeLabels[card.impactType],
    "Impact Recurrence": savingsImpactRecurrenceLabels[card.impactRecurrence],
    "Budget Impact": savingsBudgetImpactLabels[card.budgetImpact],
    "Buyer / Owner": card.buyer?.name ?? "",
    Supplier: card.supplier?.name ?? "",
    "Alternative Supplier":
      card.alternativeSupplier?.name ??
      card.alternativeSupplierManualName ??
      "",
    Material: card.material?.name ?? "",
    "Alternative Material":
      card.alternativeMaterial?.name ??
      card.alternativeMaterialManualName ??
      "",
    Category: card.category?.name ?? "",
    Plant: card.plant?.name ?? "",
    "Business Unit": card.businessUnit?.name ?? "",
    "Baseline Price": normalizeNumber(card.baselinePrice),
    "New Price": normalizeNumber(card.newPrice),
    "Annual Volume": normalizeNumber(card.annualVolume),
    "Volume Unit": card.volumeUnit || "units",
    Currency: card.currency,
    "Calculated Savings (Local)": getLocalSavings(card),
    "Savings EUR": normalizeNumber(card.calculatedSavings),
    "Savings USD": normalizeNumber(card.calculatedSavingsUSD),
    "Impact Start Date": card.impactStartDate,
    "Impact End Date": card.impactEndDate,
    "Finance Lock Status": card.financeLocked ? "Locked" : "Not Locked",
    "Evidence Count": card.evidence.length,
    "Evidence Status": getEvidenceStatus(card.phase, card.evidence.length),
    "Evidence Types": getEvidenceTypes(card),
    "Last Evidence Upload Date": card.evidence[0]?.uploadedAt ?? "",
    "Pending Approval Status": getPendingApprovalStatus(card),
    "Last Phase Change Date": card.phaseHistory[0]?.createdAt ?? "",
    "Last Updated": card.updatedAt,
    "Cancellation Reason": card.cancellationReason ?? "",
    "Business Case / Notes": card.description,
  }));
}

function buildPortfolioSummaryRows(input: {
  cards: SavingCardPortfolio[];
  generatedAt: Date;
  workspaceReadiness: WorkspaceReadiness;
}) {
  const { cards, generatedAt, workspaceReadiness } = input;
  const activeCards = cards.filter((card) => card.phase !== "CANCELLED");
  const financeLockedCards = activeCards.filter((card) => card.financeLocked);
  const cardsWithEvidence = activeCards.filter((card) => card.evidence.length > 0);
  const cardsMissingEvidence = activeCards.filter((card) => card.evidence.length === 0);
  const financeReviewCardsMissingEvidence = activeCards.filter(
    (card) =>
      isFinanceEvidenceReviewPhase(card.phase) && card.evidence.length === 0
  );
  const evidenceCoveragePercent = activeCards.length
    ? Math.round((cardsWithEvidence.length / activeCards.length) * 100)
    : 0;
  const activeSavings = sumSavings(activeCards);
  const savingCardRows = mapSavingCardsForControllerExport(cards);
  const activeRowSavings = savingCardRows.reduce((sum, row, index) => {
    return cards[index]?.phase === "CANCELLED"
      ? sum
      : sum + normalizeNumber(row["Savings EUR"]);
  }, 0);
  const phaseCounts = Object.fromEntries(
    phases.map((phase) => [
      phase,
      cards.filter((card) => card.phase === phase).length,
    ])
  ) as Record<Phase, number>;
  const rows: ControllerWorkbookCell[][] = [
    ["Traxium Controller Review Workbook", "", ""],
    ["Metric", "Value", "Review Note"],
    ["Workspace", workspaceReadiness.workspace.name, "Active organization only"],
    ["Generated At (UTC)", generatedAt, "Point-in-time export"],
    ["Reporting Currency", "EUR", "Savings EUR is the controller reporting basis"],
    [
      "Reporting Basis",
      "Approved saving-card assumptions",
      "Canceled cards remain visible but are excluded from active savings",
    ],
    ["Portfolio Cards", cards.length, "Includes canceled cards for governance"],
    ["Active Cards", activeCards.length, "Excludes canceled cards"],
    ["Active Forecast / Pipeline Value (EUR)", activeSavings, "Sum of active saving-card rows"],
    [
      "Implemented Value (EUR)",
      sumSavings(cards.filter((card) => card.phase === "REALISED")),
      "Current approved phase is Implemented",
    ],
    [
      "Captured Value (EUR)",
      sumSavings(cards.filter((card) => card.phase === "ACHIEVED")),
      "Current approved phase is Captured",
    ],
    ["Finance-Locked Cards", financeLockedCards.length, "Active cards only"],
    ["Finance-Locked Value (EUR)", sumSavings(financeLockedCards), "Active cards only"],
    ["Cards With Evidence", cardsWithEvidence.length, "Active cards with at least one evidence record"],
    ["Cards Missing Evidence", cardsMissingEvidence.length, "Active cards without evidence"],
    ["Evidence Coverage", `${evidenceCoveragePercent}%`, "Cards with evidence / active cards"],
    [
      "Finance-Stage Cards Missing Evidence",
      financeReviewCardsMissingEvidence.length,
      "Finance Validated, Implemented, or Captured without evidence",
    ],
    [
      "Last Portfolio Update (UTC)",
      workspaceReadiness.activity.lastPortfolioUpdateAt ?? "Not available",
      "Most recent saving-card update",
    ],
    ["Saving Cards Active Row Total (EUR)", activeRowSavings, "Reconciliation source"],
    ["Reconciliation Difference (EUR)", activeSavings - activeRowSavings, "Expected to equal zero"],
    ["", "", ""],
    ["Phase Summary", "", ""],
    ["Phase", "Cards", "Savings EUR"],
  ];

  for (const phase of phases) {
    rows.push([
      phaseLabels[phase],
      phaseCounts[phase],
      sumSavings(cards.filter((card) => card.phase === phase)),
    ]);
  }

  rows.push(["", "", ""], ["Savings Type Summary", "", ""], ["Savings Type", "Cards", "Savings EUR"]);
  for (const savingType of savingTypes) {
    const matchingCards = activeCards.filter(
      (card) => card.savingType === savingType
    );
    rows.push([
      savingTypeLabels[savingType],
      matchingCards.length,
      sumSavings(matchingCards),
    ]);
  }

  rows.push(["", "", ""], ["Impact Type Summary", "", ""], ["Impact Type", "Cards", "Savings EUR"]);
  for (const impactType of savingsImpactTypes) {
    const matchingCards = activeCards.filter(
      (card) => card.impactType === impactType
    );
    rows.push([
      savingsImpactTypeLabels[impactType],
      matchingCards.length,
      sumSavings(matchingCards),
    ]);
  }

  rows.push(["", "", ""], ["Impact Recurrence Summary", "", ""], ["Impact Recurrence", "Cards", "Savings EUR"]);
  for (const recurrence of savingsImpactRecurrences) {
    const matchingCards = activeCards.filter(
      (card) => card.impactRecurrence === recurrence
    );
    rows.push([
      savingsImpactRecurrenceLabels[recurrence],
      matchingCards.length,
      sumSavings(matchingCards),
    ]);
  }

  rows.push(["", "", ""], ["Budget Impact Summary", "", ""], ["Budget Impact", "Cards", "Savings EUR"]);
  for (const budgetImpact of savingsBudgetImpacts) {
    const matchingCards = activeCards.filter(
      (card) => card.budgetImpact === budgetImpact
    );
    rows.push([
      savingsBudgetImpactLabels[budgetImpact],
      matchingCards.length,
      sumSavings(matchingCards),
    ]);
  }

  rows.push(["", "", ""], ["Category Summary", "", ""], ["Category", "Cards", "Savings EUR"]);
  const categoryNames = [
    ...new Set(activeCards.map((card) => card.category?.name ?? "Unassigned")),
  ].sort((left, right) => left.localeCompare(right));

  for (const categoryName of categoryNames) {
    const categoryCards = activeCards.filter(
      (card) => (card.category?.name ?? "Unassigned") === categoryName
    );
    rows.push([categoryName, categoryCards.length, sumSavings(categoryCards)]);
  }

  rows.push(["", "", ""], ["Buyer / Owner Summary", "", ""], ["Buyer / Owner", "Cards", "Savings EUR"]);
  const buyerNames = [
    ...new Set(activeCards.map((card) => card.buyer?.name ?? "Unassigned")),
  ].sort((left, right) => left.localeCompare(right));

  for (const buyerName of buyerNames) {
    const buyerCards = activeCards.filter(
      (card) => (card.buyer?.name ?? "Unassigned") === buyerName
    );
    rows.push([buyerName, buyerCards.length, sumSavings(buyerCards)]);
  }

  return {
    rows,
    reconciliation: {
      activeCardCount: activeCards.length,
      activeSavings,
      activeRowSavings,
      difference: activeSavings - activeRowSavings,
      phaseCounts,
      evidenceCoveragePercent,
      financeLockedSavings: sumSavings(financeLockedCards),
    },
  };
}

function buildDataDictionaryRows() {
  const rows: ControllerWorkbookCell[][] = [
    ["Column / Term", "Definition", "Accepted Values / Review Note"],
    [
      "Savings Formula",
      "(Baseline Price - New Price) × Annual Volume",
      "Traxium does not calculate accounting recognition.",
    ],
    [
      "Reporting Basis",
      "Canceled cards remain visible but are excluded from active savings.",
      "Workbook totals are point-in-time values from the active workspace.",
    ],
  ];

  for (const column of controllerSavingCardColumns) {
    rows.push([column, columnDefinitions[column], ""]);
  }

  rows.push(["", "", ""], ["Phase Labels", "Customer-facing workflow phases", ""]);

  for (const phase of phases) {
    rows.push([phaseLabels[phase], phaseDescriptions[phase], phase]);
  }

  rows.push(
    ["Savings Type", "Commercial mechanism classification", savingTypes.map((value) => savingTypeLabels[value]).join("; ")],
    ["Impact Type", "Finance impact classification", savingsImpactTypes.map((value) => savingsImpactTypeLabels[value]).join("; ")],
    ["Impact Recurrence", "Recurrence classification", savingsImpactRecurrences.map((value) => savingsImpactRecurrenceLabels[value]).join("; ")],
    ["Budget Impact", "Budget treatment classification", savingsBudgetImpacts.map((value) => savingsBudgetImpactLabels[value]).join("; ")],
    ["Currency", "Commercial assumption currency", currencies.join("; ")],
    ["Finance Lock", "Protects finance-controlled assumptions from normal edits.", "Locked / Not Locked"],
    ["Evidence Attached", "At least one private evidence record exists.", "No URLs or provider paths are exported."],
    ["Missing Evidence", "A Finance Validated, Implemented, or Captured card has no evidence.", "Review before relying on the savings claim."],
    ["Evidence Recommended", "A Proposed card has no evidence.", "Evidence does not block first-card creation."],
    [
      "Exclusions",
      "No ERP sync, accounting posting, audited financial recognition, custom BI feed, or deleted-record archive.",
      "Controller-review workbook only.",
    ]
  );

  return rows;
}

function buildImportTemplateRows(): ControllerWorkbookRow[] {
  return [
    {
      Title: "PP carrier annual price negotiation",
      "Savings Type": "Price Reduction",
      "Impact Type": "Hard Savings",
      "Impact Recurrence": "Recurring",
      "Budget Impact": "Budget Impact",
      Phase: "Proposed",
      Buyer: "Strategic Buyer",
      Supplier: "Current Polymer Supplier",
      Material: "PP Homopolymer Carrier",
      Category: "Polymer Carriers",
      Plant: "Ohio Compounding Site",
      "Business Unit": "Packaging Colorants",
      "Baseline Price": 1.42,
      "New Price": 1.31,
      "Annual Volume": 850000,
      Currency: "EUR",
      "Start Date": "2026-01-01",
      "End Date": "2026-12-31",
      "Impact Start Date": "2026-01-01",
      "Impact End Date": "2026-12-31",
      "Business Case / Notes":
        "Annual supplier negotiation using approved baseline and forecast volume.",
    },
  ];
}

function buildEvidenceSummaryRows(
  cards: SavingCardPortfolio[]
): ControllerWorkbookRow[] {
  return cards.map((card) => ({
    "Saving Card Title": card.title,
    Phase: phaseLabels[card.phase],
    "Evidence Count": card.evidence.length,
    "Evidence Status": getEvidenceStatus(card.phase, card.evidence.length),
    "Evidence Types": getEvidenceTypes(card),
    "Last Evidence Upload Date": card.evidence[0]?.uploadedAt ?? "",
    "Finance Lock Status": card.financeLocked ? "Locked" : "Not Locked",
  }));
}

export function buildControllerWorkbookModel(input: {
  cards: SavingCardPortfolio[];
  generatedAt: Date;
  workspaceReadiness: WorkspaceReadiness;
}): ControllerWorkbookModel {
  const summary = buildPortfolioSummaryRows(input);

  return {
    generatedAt: input.generatedAt,
    reportingCurrency: "EUR",
    portfolioSummaryRows: summary.rows,
    savingCardRows: mapSavingCardsForControllerExport(input.cards),
    dataDictionaryRows: buildDataDictionaryRows(),
    importTemplateRows: buildImportTemplateRows(),
    evidenceSummaryRows: buildEvidenceSummaryRows(input.cards),
    reconciliation: summary.reconciliation,
  };
}
