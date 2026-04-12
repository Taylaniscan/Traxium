import type {
  BillingInterval,
  ForecastSource,
  InvitationStatus,
  MembershipStatus,
  OrganizationRole,
  PriceType,
  Prisma,
  Role,
  SubscriptionStatus,
  UsageFeature,
  UsageWindow,
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

export type AuthFailureCode =
  | "UNAUTHENTICATED"
  | "ORGANIZATION_REQUIRED"
  | "BILLING_REQUIRED"
  | "FORBIDDEN";

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

export type OrganizationInvitationSummary = {
  id: string;
  organizationId: string;
  email: string;
  role: OrganizationRole;
  token: string;
  status: InvitationStatus;
  expiresAt: Date;
  invitedByUserId: string;
  createdAt: Date;
  updatedAt: Date;
};

export const organizationInvitationSelect = {
  id: true,
  organizationId: true,
  email: true,
  role: true,
  token: true,
  status: true,
  expiresAt: true,
  invitedByUserId: true,
  createdAt: true,
  updatedAt: true,
  organization: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  invitedBy: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} satisfies Prisma.InvitationSelect;

export type OrganizationInvitationRecord = Prisma.InvitationGetPayload<{
  select: typeof organizationInvitationSelect;
}>;

export type ProductPlanSummary = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  stripeProductId: string | null;
  isActive: boolean;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
};

export const productPlanSelect = {
  id: true,
  code: true,
  name: true,
  description: true,
  stripeProductId: true,
  isActive: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProductPlanSelect;

export type ProductPlanRecord = Prisma.ProductPlanGetPayload<{
  select: typeof productPlanSelect;
}>;

export type PlanPriceSummary = {
  id: string;
  productPlanId: string;
  stripePriceId: string | null;
  type: PriceType;
  interval: BillingInterval;
  intervalCount: number;
  currencyCode: string;
  unitAmount: number;
  usageFeature: UsageFeature | null;
  isActive: boolean;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
};

export const planPriceSelect = {
  id: true,
  productPlanId: true,
  stripePriceId: true,
  type: true,
  interval: true,
  intervalCount: true,
  currencyCode: true,
  unitAmount: true,
  usageFeature: true,
  isActive: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PlanPriceSelect;

export type PlanPriceRecord = Prisma.PlanPriceGetPayload<{
  select: typeof planPriceSelect;
}>;

export type BillingCustomerSummary = {
  id: string;
  organizationId: string;
  stripeCustomerId: string;
  email: string | null;
  name: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
};

export const billingCustomerSelect = {
  id: true,
  organizationId: true,
  stripeCustomerId: true,
  email: true,
  name: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.BillingCustomerSelect;

export type BillingCustomerRecord = Prisma.BillingCustomerGetPayload<{
  select: typeof billingCustomerSelect;
}>;

export type OrganizationSubscriptionSummary = {
  id: string;
  organizationId: string;
  billingCustomerId: string;
  productPlanId: string | null;
  planPriceId: string | null;
  stripeSubscriptionId: string;
  status: SubscriptionStatus;
  currencyCode: string | null;
  quantity: number;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  trialStart: Date | null;
  trialEnd: Date | null;
  canceledAt: Date | null;
  endedAt: Date | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
};

export const organizationSubscriptionSelect = {
  id: true,
  organizationId: true,
  billingCustomerId: true,
  productPlanId: true,
  planPriceId: true,
  stripeSubscriptionId: true,
  status: true,
  currencyCode: true,
  quantity: true,
  cancelAtPeriodEnd: true,
  currentPeriodStart: true,
  currentPeriodEnd: true,
  trialStart: true,
  trialEnd: true,
  canceledAt: true,
  endedAt: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SubscriptionSelect;

export type OrganizationSubscriptionRecord = Prisma.SubscriptionGetPayload<{
  select: typeof organizationSubscriptionSelect;
}>;

export type WebhookEventSummary = {
  id: string;
  organizationId: string | null;
  stripeEventId: string;
  source: string;
  eventType: string;
  apiVersion: string | null;
  livemode: boolean;
  payload: Prisma.JsonValue;
  receivedAt: Date;
  processedAt: Date | null;
  processingError: string | null;
  updatedAt: Date;
};

export const webhookEventSelect = {
  id: true,
  organizationId: true,
  stripeEventId: true,
  source: true,
  eventType: true,
  apiVersion: true,
  livemode: true,
  payload: true,
  receivedAt: true,
  processedAt: true,
  processingError: true,
  updatedAt: true,
} satisfies Prisma.WebhookEventSelect;

export type WebhookEventRecord = Prisma.WebhookEventGetPayload<{
  select: typeof webhookEventSelect;
}>;

export type UsagePeriod = {
  window: UsageWindow;
  periodStart: Date;
  periodEnd: Date;
};

export type OrganizationUsageEventSummary = UsagePeriod & {
  id: string;
  organizationId: string;
  feature: UsageFeature;
  quantity: number;
  source: string;
  reason: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
};

export const organizationUsageEventSelect = {
  id: true,
  organizationId: true,
  feature: true,
  quantity: true,
  window: true,
  periodStart: true,
  periodEnd: true,
  source: true,
  reason: true,
  metadata: true,
  createdAt: true,
} satisfies Prisma.UsageEventSelect;

export type OrganizationUsageEventRecord = Prisma.UsageEventGetPayload<{
  select: typeof organizationUsageEventSelect;
}>;

export type OrganizationUsageCounterSummary = UsagePeriod & {
  id: string;
  organizationId: string;
  feature: UsageFeature;
  quantity: number;
  source: string;
  reason: string | null;
  metadata: Prisma.JsonValue | null;
  lastEventAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export const organizationUsageCounterSelect = {
  id: true,
  organizationId: true,
  feature: true,
  window: true,
  periodStart: true,
  periodEnd: true,
  quantity: true,
  source: true,
  reason: true,
  metadata: true,
  lastEventAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UsageCounterSelect;

export type OrganizationUsageCounterRecord = Prisma.UsageCounterGetPayload<{
  select: typeof organizationUsageCounterSelect;
}>;

export type OrganizationQuotaSnapshotSummary = UsagePeriod & {
  id: string;
  organizationId: string;
  feature: UsageFeature;
  limitQuantity: number | null;
  source: string;
  reason: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
};

export const organizationQuotaSnapshotSelect = {
  id: true,
  organizationId: true,
  feature: true,
  window: true,
  periodStart: true,
  periodEnd: true,
  limitQuantity: true,
  source: true,
  reason: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.QuotaSnapshotSelect;

export type OrganizationQuotaSnapshotRecord = Prisma.QuotaSnapshotGetPayload<{
  select: typeof organizationQuotaSnapshotSelect;
}>;

export type AuthGuardOptions = {
  redirectTo?: string | null;
  billingRedirectTo?: string | null;
  allowBillingBlocked?: boolean;
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

export type CommandCenterPendingApprovalItem = {
  requestId: string;
  savingCardId: string;
  savingCardTitle: string;
  currentPhase: string;
  requestedPhase: string;
  requestedByName: string;
  requestedByRole: string;
  createdAt: string;
  ageDays: number;
  isOverdue: boolean;
  pendingApproverCount: number;
  pendingApproverRoles: string[];
  savings: number;
  financeLocked: boolean;
};

export type CommandCenterAttentionItem = {
  savingCardId: string;
  title: string;
  phase: string;
  buyerName: string;
  categoryName: string;
  dateLabel: string;
  dateValue: string;
  ageDays: number;
  savings: number;
  financeLocked: boolean;
};

export type CommandCenterDecisionItem = {
  approvalId: string;
  savingCardId: string;
  savingCardTitle: string;
  phase: string;
  approverName: string;
  approverRole: string;
  status: string;
  approved: boolean;
  createdAt: string;
  comment: string | null;
};

export type CommandCenterActivityItem = {
  savingCardId: string;
  savingCardTitle: string;
  phase: string;
  buyerName: string;
  categoryName: string;
  updatedAt: string;
  financeLocked: boolean;
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
  pendingApprovalQueue?: CommandCenterPendingApprovalItem[];
  overdueItems?: CommandCenterAttentionItem[];
  financeLockedItems?: CommandCenterAttentionItem[];
  recentDecisions?: CommandCenterDecisionItem[];
  recentActivity?: CommandCenterActivityItem[];
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
