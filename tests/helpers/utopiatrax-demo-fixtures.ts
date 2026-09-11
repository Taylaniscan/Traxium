import { Phase } from "@prisma/client";

export function createUtopiaTraxPortfolioCards() {
  const phases = [
    Phase.IDEA,
    Phase.VALIDATED,
    Phase.REALISED,
    Phase.ACHIEVED,
    Phase.CANCELLED,
  ];
  const categories = [
    "Polymer Carriers",
    "TiO2 & White Pigments",
    "Organic Pigments & Dyes",
    "Additives & Stabilizers",
    "Packaging Materials",
    "Tolling & Subcontracted Processing",
  ];

  return Array.from({ length: 25 }, (_, index) => ({
    id: `utopia-card-${index + 1}`,
    title:
      index === 0
        ? "PP Carrier dual-source negotiation"
        : `UtopiaTrax initiative ${index + 1}`,
    phase: phases[index % phases.length],
    categoryId: `category-${index % categories.length}`,
    buyerId: `buyer-${index % 4}`,
    supplierId: `supplier-${index + 1}`,
    businessUnitId: `business-unit-${index % 5}`,
    startDate: new Date(`2026-${String((index % 9) + 1).padStart(2, "0")}-01T00:00:00.000Z`),
    endDate: new Date(`2026-${String((index % 9) + 3).padStart(2, "0")}-01T00:00:00.000Z`),
    impactStartDate: new Date("2026-01-01T00:00:00.000Z"),
    impactEndDate: new Date("2026-12-31T00:00:00.000Z"),
    calculatedSavings: 25000 + index * 2500,
    calculatedSavingsUSD: 27000 + index * 2500,
    financeLocked: index === 1,
    savingType: "PRICE_REDUCTION",
    impactType: "HARD_SAVINGS",
    impactRecurrence: "RECURRING",
    budgetImpact: "BUDGET_IMPACT",
    supplier: {
      name: index === 0 ? "Borealis Polymers" : `Supplier ${index + 1}`,
    },
    material: {
      name: index === 0 ? "PP Homopolymer Carrier" : `Material ${index + 1}`,
    },
    category: {
      name: categories[index % categories.length],
    },
    buyer: {
      name: ["Taylan Iscan", "Mert Dulger", "Aylin Demir", "Can Kaya"][
        index % 4
      ],
    },
    businessUnit: {
      name: `Business Unit ${(index % 5) + 1}`,
    },
    pendingPhaseChangeRequest:
      index < 5
        ? {
            id: `request-${index + 1}`,
            requestedPhase:
              phases[(index + 1) % phases.length] === Phase.CANCELLED
                ? Phase.ACHIEVED
                : phases[(index + 1) % phases.length],
          }
        : null,
  }));
}

export function createUtopiaTraxReadiness() {
  return {
    workspace: {
      id: "org-utopiatrax",
      name: "UtopiaTrax",
      slug: "utopiatrax",
      description: "Manufacturing savings governance demo.",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-06-05T00:00:00.000Z"),
    },
    counts: {
      users: 4,
      buyers: 4,
      suppliers: 25,
      materials: 28,
      categories: 6,
      plants: 4,
      businessUnits: 5,
      savingCards: 25,
    },
    masterData: [
      "Buyers",
      "Suppliers",
      "Materials",
      "Categories",
      "Plants",
      "Business Units",
    ].map((label) => ({
      key: label.toLowerCase().replaceAll(" ", ""),
      label,
      count: 1,
      ready: true,
      description: `${label} configured.`,
    })),
    workflowCoverage: [
      "Procurement Lead",
      "Category Owner",
      "Finance Reviewer",
    ].map((label) => ({
      key: label.toUpperCase().replaceAll(" ", "_"),
      label,
      count: 1,
      ready: true,
    })),
    coverage: {
      masterDataReadyCount: 6,
      masterDataTotal: 6,
      workflowReadyCount: 3,
      workflowTotal: 3,
      overallPercent: 100,
    },
    activity: {
      firstSavingCardCreatedAt: new Date("2026-01-01T00:00:00.000Z"),
      lastPortfolioUpdateAt: new Date("2026-06-05T00:00:00.000Z"),
    },
    isMasterDataReady: true,
    isWorkflowReady: true,
    isWorkspaceReady: true,
    missingCoreSetup: [],
    missingWorkflowCoverage: [],
  };
}

export function createUtopiaTraxCommandCenterData() {
  return {
    filters: {},
    kpis: {
      totalPipelineSavings: 1040000,
      realisedSavings: 352000,
      achievedSavings: 305000,
      savingsForecast: 1090000,
      activeProjects: 23,
      pendingApprovals: 5,
    },
    pipelineByPhase: [
      { phase: "IDEA", label: "Proposed", savings: 120000 },
      { phase: "VALIDATED", label: "Finance Validated", savings: 240000 },
      { phase: "REALISED", label: "Implemented", savings: 352000 },
      { phase: "ACHIEVED", label: "Captured", savings: 305000 },
      { phase: "CANCELLED", label: "Canceled", savings: 45000 },
    ],
    forecastCurve: [
      { month: "Jan 2026", savings: 100000, forecast: 120000 },
      { month: "Feb 2026", savings: 150000, forecast: 175000 },
    ],
    topSuppliers: [
      { supplier: "Borealis Polymers", savings: 93500 },
      { supplier: "Kronos Pigments", savings: 78000 },
    ],
    savingsByRiskLevel: [
      { level: "Low", savings: 600000 },
      { level: "Medium", savings: 300000 },
    ],
    savingsByQualificationStatus: [
      { status: "Approved", savings: 900000 },
      { status: "Plant Trial", savings: 140000 },
    ],
    pendingApprovalQueue: [
      {
        requestId: "request-1",
        savingCardId: "utopia-card-1",
        savingCardTitle: "PP Carrier dual-source negotiation",
        currentPhase: "Finance Validated",
        requestedPhase: "Implemented",
        requestedByName: "Aylin Demir",
        requestedByRole: "Category Owner",
        createdAt: "2026-04-01T00:00:00.000Z",
        ageDays: 10,
        isOverdue: true,
        pendingApproverCount: 1,
        pendingApproverRoles: ["Finance Reviewer"],
        savings: 93500,
        financeLocked: true,
      },
    ],
    overdueItems: [
      {
        savingCardId: "utopia-card-2",
        title: "PET carrier quarterly index reset",
        phase: "Finance Validated",
        buyerName: "Aylin Demir",
        categoryName: "Polymer Carriers",
        dateLabel: "Due date",
        dateValue: "2026-04-01T00:00:00.000Z",
        ageDays: 12,
        savings: 43000,
        financeLocked: true,
      },
    ],
    financeLockedItems: [
      {
        savingCardId: "utopia-card-2",
        title: "PET carrier quarterly index reset",
        phase: "Finance Validated",
        buyerName: "Aylin Demir",
        categoryName: "Polymer Carriers",
        dateLabel: "Last updated",
        dateValue: "2026-05-01T00:00:00.000Z",
        ageDays: 3,
        savings: 43000,
        financeLocked: true,
      },
    ],
    recentDecisions: [
      {
        approvalId: "approval-1",
        savingCardId: "utopia-card-1",
        savingCardTitle: "PP Carrier dual-source negotiation",
        phase: "Captured",
        approverName: "Mert Dulger",
        approverRole: "Finance Reviewer",
        status: "APPROVED",
        approved: true,
        createdAt: "2026-05-01T00:00:00.000Z",
        comment: "Captured savings confirmed.",
      },
    ],
    recentActivity: [
      {
        savingCardId: "utopia-card-1",
        savingCardTitle: "PP Carrier dual-source negotiation",
        phase: "Captured",
        buyerName: "Aylin Demir",
        categoryName: "Polymer Carriers",
        updatedAt: "2026-05-01T00:00:00.000Z",
        financeLocked: false,
        savings: 93500,
      },
    ],
  };
}

export function createUtopiaTraxReferenceData() {
  return {
    users: [],
    buyers: ["Taylan Iscan", "Aylin Demir", "Can Kaya", "Maya Yilmaz"].map(
      (name, index) => ({ id: `buyer-${index}`, name })
    ),
    suppliers: Array.from({ length: 25 }, (_, index) => ({
      id: `supplier-${index + 1}`,
      name: `Supplier ${index + 1}`,
    })),
    materials: [],
    categories: UTOPIATRAX_EXPECTED_CATEGORIES.map((name, index) => ({
      id: `category-${index}`,
      name,
    })),
    plants: [],
    businessUnits: Array.from({ length: 5 }, (_, index) => ({
      id: `business-unit-${index}`,
      name: `Business Unit ${index + 1}`,
    })),
    fxRates: [],
  };
}

const UTOPIATRAX_EXPECTED_CATEGORIES = [
  "Polymer Carriers",
  "TiO2 & White Pigments",
  "Organic Pigments & Dyes",
  "Additives & Stabilizers",
  "Packaging Materials",
  "Tolling & Subcontracted Processing",
] as const;
