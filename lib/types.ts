import type { Prisma } from "@prisma/client";

export const savingCardPortfolioSelect = {
  id: true,
  title: true,
  savingType: true,
  phase: true,
  supplierId: true,
  materialId: true,
  categoryId: true,
  businessUnitId: true,
  buyerId: true,
  alternativeSupplierManualName: true,
  alternativeMaterialManualName: true,
  baselinePrice: true,
  newPrice: true,
  annualVolume: true,
  currency: true,
  calculatedSavings: true,
  calculatedSavingsUSD: true,
  savingDriver: true,
  implementationComplexity: true,
  qualificationStatus: true,
  startDate: true,
  endDate: true,
  impactStartDate: true,
  impactEndDate: true,
  financeLocked: true,
  supplier: {
    select: {
      id: true,
      name: true,
    },
  },
  material: {
    select: {
      id: true,
      name: true,
    },
  },
  alternativeSupplier: {
    select: {
      id: true,
      name: true,
    },
  },
  alternativeMaterial: {
    select: {
      id: true,
      name: true,
    },
  },
  category: {
    select: {
      id: true,
      name: true,
    },
  },
  buyer: {
    select: {
      id: true,
      name: true,
    },
  },
  businessUnit: {
    select: {
      id: true,
      name: true,
    },
  },
  phaseChangeRequests: {
    select: {
      id: true,
      approvalStatus: true,
      requestedPhase: true,
      requestedBy: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: "desc" as const },
  },
} satisfies Prisma.SavingCardSelect;

export type SavingCardPortfolio = Prisma.SavingCardGetPayload<{
  select: typeof savingCardPortfolioSelect;
}>;

export const dashboardCardSelect = {
  title: true,
  phase: true,
  categoryId: true,
  baselinePrice: true,
  newPrice: true,
  annualVolume: true,
  calculatedSavings: true,
  frequency: true,
  savingDriver: true,
  implementationComplexity: true,
  qualificationStatus: true,
  impactStartDate: true,
  category: {
    select: {
      name: true,
    },
  },
  buyer: {
    select: {
      name: true,
    },
  },
  businessUnit: {
    select: {
      name: true,
    },
  },
} satisfies Prisma.SavingCardSelect;

export type DashboardCardSummary = Prisma.SavingCardGetPayload<{
  select: typeof dashboardCardSelect;
}>;

export type DashboardData = {
  cards: DashboardCardSummary[];
};

export const commandCenterFilterKeys = [
  "categoryId",
  "businessUnitId",
  "buyerId",
  "plantId",
  "supplierId",
] as const;

export type CommandCenterFilterKey = (typeof commandCenterFilterKeys)[number];

export type CommandCenterFilters = Partial<Record<CommandCenterFilterKey, string>>;

export type CommandCenterResolvedFilters = Record<CommandCenterFilterKey, string>;

export const emptyCommandCenterFilters: CommandCenterResolvedFilters = {
  categoryId: "",
  businessUnitId: "",
  buyerId: "",
  plantId: "",
  supplierId: "",
};

export type CommandCenterFilterOption = {
  id: string;
  name: string;
};

export type CommandCenterFilterOptions = {
  categories: CommandCenterFilterOption[];
  businessUnits: CommandCenterFilterOption[];
  buyers: CommandCenterFilterOption[];
  plants: CommandCenterFilterOption[];
  suppliers: CommandCenterFilterOption[];
};

export type CommandCenterKpis = {
  totalPipelineSavings: number;
  realisedSavings: number;
  achievedSavings: number;
  savingsForecast: number;
  activeProjects: number;
  pendingApprovals: number;
};

export type CommandCenterPipelinePoint = {
  phase: string;
  label: string;
  savings: number;
};

export type CommandCenterForecastPoint = {
  month: string;
  savings: number;
  forecast: number;
};

export type CommandCenterTopSupplier = {
  supplier: string;
  savings: number;
};

export type CommandCenterBenchmarkOpportunity = {
  savingCardId: string;
  material: string;
  supplier: string;
  plant: string;
  currentPrice: number;
  benchmarkPrice: number;
  variancePercent: number;
  potentialSaving: number;
};

export type CommandCenterRiskPoint = {
  level: string;
  savings: number;
};

export type CommandCenterQualificationPoint = {
  status: string;
  savings: number;
};

export type CommandCenterData = {
  filters: CommandCenterFilters;
  kpis: CommandCenterKpis;
  pipelineByPhase: CommandCenterPipelinePoint[];
  forecastCurve: CommandCenterForecastPoint[];
  topSuppliers: CommandCenterTopSupplier[];
  benchmarkOpportunities: CommandCenterBenchmarkOpportunity[];
  savingsByRiskLevel: CommandCenterRiskPoint[];
  savingsByQualificationStatus: CommandCenterQualificationPoint[];
};

export type CommandCenterApiError = {
  error: string;
};

export type SavingCardWithRelations = Prisma.SavingCardGetPayload<{
  include: {
    supplier: true;
    material: true;
    alternativeSupplier: true;
    alternativeMaterial: true;
    category: true;
    plant: true;
    businessUnit: true;
    buyer: true;
    stakeholders: { include: { user: true } };
    evidence: true;
    alternativeSuppliers: { include: { supplier: true } };
    alternativeMaterials: { include: { material: true; supplier: true } };
    approvals: { include: { approver: true } };
    phaseChangeRequests: { include: { requestedBy: true; approvals: { include: { approver: true } } } };
    phaseHistory: { orderBy: { createdAt: "desc" } };
    comments: { include: { author: true } };
  };
}>;

export type MasterDataOption = {
  id?: string;
  name?: string;
};
