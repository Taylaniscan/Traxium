import type {
  ForecastSource,
  MembershipStatus,
  OrganizationRole,
  Prisma,
  Role,
} from "@prisma/client";

export const appPermissions = [
  "viewWorkspace",
  "manageWorkspace",
  "viewReports",
  "exportWorkbook",
  "manageSavingCards",
  "approvePhaseChanges",
  "lockFinance",
] as const;

export type AppPermission = (typeof appPermissions)[number];

export type AuthFailureCode = "UNAUTHENTICATED" | "ORGANIZATION_REQUIRED" | "FORBIDDEN";

export type ActiveOrganizationContext = {
  membershipId: string;
  organizationId: string;
  membershipRole: OrganizationRole;
  membershipStatus: MembershipStatus;
};

export type TenantScope = {
  organizationId: string;
};

export type TenantContext = TenantScope;

export type ActiveTenantContext = TenantScope & {
  activeOrganizationId: string;
  activeOrganization: ActiveOrganizationContext;
};

export type AuthenticatedUser = ActiveTenantContext & {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export type TenantContextSource = string | TenantContext | ActiveTenantContext;

export type TenantScopedWhereInput<
  TWhere extends Record<string, unknown> = Record<string, never>,
> = TWhere & TenantScope;

export type TenantOwnershipRecord = {
  organizationId: string | null | undefined;
};

export type TenantOwnedRelationWhere<
  TRelationName extends string = string,
  TWhere extends Record<string, unknown> = Record<string, never>,
> = Record<TRelationName, { is: TenantScopedWhereInput<TWhere> }>;

export type OrganizationMembershipSummary = {
  id: string;
  userId: string;
  organizationId: string;
  role: OrganizationRole;
  status: MembershipStatus;
  createdAt: Date;
  updatedAt: Date;
};

export const organizationMembershipSelect = {
  id: true,
  userId: true,
  organizationId: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  organization: {
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.OrganizationMembershipSelect;

export type OrganizationMembershipRecord = Prisma.OrganizationMembershipGetPayload<{
  select: typeof organizationMembershipSelect;
}>;

export type AuthGuardOptions = {
  redirectTo?: string | null;
};

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

export type WorkspaceIdentity = {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
};

export type WorkspaceReadinessCounts = {
  users: number;
  buyers: number;
  suppliers: number;
  materials: number;
  categories: number;
  plants: number;
  businessUnits: number;
  savingCards: number;
};

export type WorkspaceMasterDataItem = {
  key: "buyers" | "suppliers" | "materials" | "categories" | "plants" | "businessUnits";
  label: string;
  count: number;
  ready: boolean;
  description: string;
};

export type WorkspaceWorkflowCoverageItem = {
  key: "HEAD_OF_GLOBAL_PROCUREMENT" | "GLOBAL_CATEGORY_LEADER" | "FINANCIAL_CONTROLLER";
  label: string;
  count: number;
  ready: boolean;
};

export type WorkspaceCoverageSummary = {
  masterDataReadyCount: number;
  masterDataTotal: number;
  workflowReadyCount: number;
  workflowTotal: number;
  overallPercent: number;
};

export type WorkspaceActivitySummary = {
  firstSavingCardCreatedAt: Date | null;
  lastPortfolioUpdateAt: Date | null;
};

export type WorkspaceReadiness = {
  workspace: WorkspaceIdentity;
  counts: WorkspaceReadinessCounts;
  masterData: readonly WorkspaceMasterDataItem[];
  workflowCoverage: readonly WorkspaceWorkflowCoverageItem[];
  coverage: WorkspaceCoverageSummary;
  activity: WorkspaceActivitySummary;
  isMasterDataReady: boolean;
  isWorkflowReady: boolean;
  isWorkspaceReady: boolean;
  missingCoreSetup: string[];
  missingWorkflowCoverage: string[];
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
  savingsByRiskLevel: CommandCenterRiskPoint[];
  savingsByQualificationStatus: CommandCenterQualificationPoint[];
};

export type CommandCenterApiError = {
  error: string;
};

export type VolumeTimelineRow = {
  period: string;
  periodKey: string;
  periodDate: string;
  forecastQty: number;
  actualQty: number;
  unit: string;
  forecastSaving: number;
  actualSaving: number;
  varianceQty: number;
  varianceSaving: number;
  variancePercent: number | null;
  isConfirmed: boolean;
  isFuture: boolean;
  forecastSource: ForecastSource | null;
  actualSource: ForecastSource | null;
};

export type VolumeTimelineSummary = {
  ytdForecastSaving: number;
  ytdActualSaving: number;
  ytdVarianceSaving: number;
  ytdVariancePercent: number | null;
  ytdForecastQty: number;
  ytdActualQty: number;
  ytdVarianceQty: number;
  totalForecastMonths: number;
  confirmedMonths: number;
  hasData: boolean;
};

export type VolumeTimelineResult = {
  timeline: VolumeTimelineRow[];
  summary: VolumeTimelineSummary;
};

export type VolumeImportResult = {
  imported: number;
  rejected: number;
  errors: string[];
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
