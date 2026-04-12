import { ApprovalStatus, Phase, Prisma } from "@prisma/client";
import { getForecastMultiplier } from "@/lib/calculations";
import { phaseLabels, roleLabels } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { buildTenantScopeWhere } from "@/lib/tenant-scope";
import type {
  CommandCenterActivityItem,
  CommandCenterAttentionItem,
  CommandCenterData,
  CommandCenterDecisionItem,
  CommandCenterFilterOptions,
  CommandCenterFilters,
  CommandCenterPendingApprovalItem,
  TenantContextSource,
} from "@/lib/types";

const COMMAND_CENTER_PENDING_OVERDUE_DAYS = 7;

export function resolveCommandCenterForecastBucket(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value ?? ""));

  if (Number.isNaN(date.getTime())) {
    return {
      month: "Unknown timing",
      sortValue: Number.MAX_SAFE_INTEGER,
    };
  }

  return {
    month: new Intl.DateTimeFormat("en-US", {
      month: "short",
      year: "numeric",
    }).format(date),
    sortValue: new Date(date.getFullYear(), date.getMonth(), 1).getTime(),
  };
}

function buildCommandCenterWhere(
  context: TenantContextSource,
  filters?: CommandCenterFilters
): Prisma.SavingCardWhereInput {
  return buildTenantScopeWhere(context, {
    categoryId: filters?.categoryId || undefined,
    businessUnitId: filters?.businessUnitId || undefined,
    buyerId: filters?.buyerId || undefined,
    plantId: filters?.plantId || undefined,
    supplierId: filters?.supplierId || undefined,
  });
}

export async function getCommandCenterFilterOptions(
  context: TenantContextSource
): Promise<CommandCenterFilterOptions> {
  const tenantWhere = buildTenantScopeWhere(context);
  const { categories, businessUnits, buyers, plants, suppliers } =
    await prisma.$transaction(async (tx) => {
      const categories = await tx.category.findMany({
        where: tenantWhere,
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
      const businessUnits = await tx.businessUnit.findMany({
        where: tenantWhere,
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
      const buyers = await tx.buyer.findMany({
        where: tenantWhere,
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
      const plants = await tx.plant.findMany({
        where: tenantWhere,
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
      const suppliers = await tx.supplier.findMany({
        where: tenantWhere,
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });

      return { categories, businessUnits, buyers, plants, suppliers };
    });

  return { categories, businessUnits, buyers, plants, suppliers };
}

export async function getCommandCenterData(
  context: TenantContextSource,
  filters?: CommandCenterFilters
): Promise<CommandCenterData> {
  const where = buildCommandCenterWhere(context, filters);
  const now = new Date();
  const {
    phaseSavings,
    forecastCards,
    supplierSavings,
    qualificationGroups,
    pendingApprovals,
    activeProjects,
    riskCards,
    pendingApprovalQueue,
    overdueItems,
    financeLockedItems,
    recentDecisions,
    recentActivity,
    suppliers,
  } = await prisma.$transaction(async (tx) => {
    const phaseSavings = await tx.savingCard.groupBy({
      by: ["phase"],
      where,
      _sum: { calculatedSavings: true },
    });
    const forecastCards = await tx.savingCard.findMany({
      where,
      select: {
        impactStartDate: true,
        calculatedSavings: true,
        frequency: true,
        phase: true,
      },
    });
    const supplierSavings = await tx.savingCard.groupBy({
      by: ["supplierId"],
      where: {
        ...where,
        phase: { not: Phase.CANCELLED },
      },
      _sum: { calculatedSavings: true },
      orderBy: {
        _sum: {
          calculatedSavings: "desc",
        },
      },
      take: 10,
    });
    const qualificationGroups = await tx.savingCard.groupBy({
      by: ["qualificationStatus"],
      where,
      _sum: { calculatedSavings: true },
    });
    const pendingApprovals = await tx.phaseChangeRequest.count({
      where: {
        approvalStatus: ApprovalStatus.PENDING,
        savingCard: where,
      },
    });
    const activeProjects = await tx.savingCard.count({
      where: {
        ...where,
        phase: { not: Phase.CANCELLED },
      },
    });
    const riskCards = await tx.savingCard.findMany({
      where,
      select: {
        calculatedSavings: true,
        alternativeSuppliers: {
          where: { isSelected: true },
          select: { riskLevel: true },
        },
        alternativeMaterials: {
          where: { isSelected: true },
          select: { riskLevel: true },
        },
      },
    });
    const pendingApprovalQueue = await tx.phaseChangeRequest.findMany({
      where: {
        approvalStatus: ApprovalStatus.PENDING,
        savingCard: where,
      },
      orderBy: { createdAt: "asc" },
      take: 8,
      select: {
        id: true,
        currentPhase: true,
        requestedPhase: true,
        createdAt: true,
        requestedBy: {
          select: {
            name: true,
            role: true,
          },
        },
        approvals: {
          where: { status: ApprovalStatus.PENDING },
          select: {
            role: true,
          },
        },
        savingCard: {
          select: {
            id: true,
            title: true,
            calculatedSavings: true,
            financeLocked: true,
          },
        },
      },
    });
    const overdueItems = await tx.savingCard.findMany({
      where: {
        ...where,
        phase: {
          notIn: [Phase.ACHIEVED, Phase.CANCELLED],
        },
        endDate: {
          lt: now,
        },
      },
      orderBy: { endDate: "asc" },
      take: 8,
      select: {
        id: true,
        title: true,
        phase: true,
        endDate: true,
        calculatedSavings: true,
        financeLocked: true,
        buyer: {
          select: {
            name: true,
          },
        },
        category: {
          select: {
            name: true,
          },
        },
      },
    });
    const financeLockedItems = await tx.savingCard.findMany({
      where: {
        ...where,
        financeLocked: true,
        phase: {
          not: Phase.CANCELLED,
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: {
        id: true,
        title: true,
        phase: true,
        updatedAt: true,
        calculatedSavings: true,
        financeLocked: true,
        buyer: {
          select: {
            name: true,
          },
        },
        category: {
          select: {
            name: true,
          },
        },
      },
    });
    const recentDecisions = await tx.approval.findMany({
      where: {
        status: {
          not: ApprovalStatus.PENDING,
        },
        savingCard: where,
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        phase: true,
        approved: true,
        status: true,
        comment: true,
        createdAt: true,
        approver: {
          select: {
            name: true,
            role: true,
          },
        },
        savingCard: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });
    const recentActivity = await tx.savingCard.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: {
        id: true,
        title: true,
        phase: true,
        updatedAt: true,
        calculatedSavings: true,
        financeLocked: true,
        buyer: {
          select: {
            name: true,
          },
        },
        category: {
          select: {
            name: true,
          },
        },
      },
    });
    const supplierIds = supplierSavings
      .map((item) => item.supplierId)
      .filter((value): value is string => Boolean(value));
    const suppliers = supplierIds.length
      ? await tx.supplier.findMany({
          where: buildTenantScopeWhere(context, {
            id: { in: supplierIds },
          }),
          select: { id: true, name: true },
        })
      : [];

    return {
      phaseSavings,
      forecastCards,
      supplierSavings,
      qualificationGroups,
      pendingApprovals,
      activeProjects,
      riskCards,
      pendingApprovalQueue,
      overdueItems,
      financeLockedItems,
      recentDecisions,
      recentActivity,
      suppliers,
    };
  });

  const phaseMap = new Map(
    phaseSavings.map((item) => [item.phase, item._sum.calculatedSavings ?? 0])
  );

  const pipelineByPhase = [
    "IDEA",
    "VALIDATED",
    "REALISED",
    "ACHIEVED",
    "CANCELLED",
  ].map((phase) => ({
    phase,
    label: phaseLabels[phase as Phase],
    savings: phaseMap.get(phase as Phase) ?? 0,
  }));

  const forecastCurve = Object.values(
    forecastCards.reduce<
      Record<
        string,
        { month: string; savings: number; forecast: number; sortValue: number }
      >
    >((acc, card) => {
      const monthBucket = resolveCommandCenterForecastBucket(card.impactStartDate);
      const monthKey = `${monthBucket.sortValue}:${monthBucket.month}`;

      acc[monthKey] ??= {
        month: monthBucket.month,
        savings: 0,
        forecast: 0,
        sortValue: monthBucket.sortValue,
      };

      acc[monthKey].savings += card.calculatedSavings;
      acc[monthKey].forecast +=
        card.calculatedSavings * getForecastMultiplier(card.frequency);
      return acc;
    }, {})
  ).sort((left, right) => left.sortValue - right.sortValue);

  const supplierNameMap = new Map(suppliers.map((item) => [item.id, item.name]));

  const topSuppliers = supplierSavings.map((item) => ({
    supplier: supplierNameMap.get(item.supplierId) ?? "Unknown supplier",
    savings: item._sum.calculatedSavings ?? 0,
  }));

  const riskOrder = ["Low", "Medium", "High", "Critical", "Unrated"];
  const riskAccumulator = riskCards.reduce<Record<string, number>>((acc, card) => {
    const supplierRisk = card.alternativeSuppliers[0]?.riskLevel;
    const materialRisk = card.alternativeMaterials[0]?.riskLevel;
    const level = normalizeRiskLevel(materialRisk ?? supplierRisk ?? "Unrated");
    acc[level] = (acc[level] ?? 0) + card.calculatedSavings;
    return acc;
  }, {});

  const savingsByRiskLevel = riskOrder
    .filter((level) => typeof riskAccumulator[level] === "number")
    .map((level) => ({ level, savings: riskAccumulator[level] ?? 0 }));

  const qualificationOrder = [
    "Not Started",
    "Lab Testing",
    "Plant Trial",
    "Approved",
    "Rejected",
    "Unspecified",
  ];
  const savingsByQualificationStatus = qualificationOrder
    .map((status) => ({
      status,
      savings:
        qualificationGroups.find(
          (item) => (item.qualificationStatus ?? "Unspecified") === status
        )?._sum.calculatedSavings ?? 0,
    }))
    .filter((item) => item.savings > 0 || item.status === "Unspecified");

  const totalPipelineSavings = pipelineByPhase
    .filter((item) => item.phase !== "CANCELLED")
    .reduce((sum, item) => sum + item.savings, 0);

  const realisedSavings = phaseMap.get(Phase.REALISED) ?? 0;
  const achievedSavings = phaseMap.get(Phase.ACHIEVED) ?? 0;
  const savingsForecast = forecastCurve.reduce((sum, item) => sum + item.forecast, 0);
  const normalizedPendingApprovalQueue: CommandCenterPendingApprovalItem[] =
    pendingApprovalQueue.map((item) => {
      const ageDays = getCommandCenterAgeDays(item.createdAt, now);
      const uniquePendingRoles = Array.from(
        new Set(item.approvals.map((approval) => formatCommandCenterRoleLabel(approval.role)))
      );

      return {
        requestId: item.id,
        savingCardId: item.savingCard.id,
        savingCardTitle: item.savingCard.title,
        currentPhase: phaseLabels[item.currentPhase],
        requestedPhase: phaseLabels[item.requestedPhase],
        requestedByName: item.requestedBy.name,
        requestedByRole: formatCommandCenterRoleLabel(item.requestedBy.role),
        createdAt: item.createdAt.toISOString(),
        ageDays,
        isOverdue: ageDays >= COMMAND_CENTER_PENDING_OVERDUE_DAYS,
        pendingApproverCount: item.approvals.length,
        pendingApproverRoles: uniquePendingRoles,
        savings: item.savingCard.calculatedSavings,
        financeLocked: item.savingCard.financeLocked,
      };
    });
  const normalizedOverdueItems: CommandCenterAttentionItem[] = overdueItems.map((item) => ({
    savingCardId: item.id,
    title: item.title,
    phase: phaseLabels[item.phase],
    buyerName: item.buyer.name,
    categoryName: item.category.name,
    dateLabel: "Due date",
    dateValue: item.endDate.toISOString(),
    ageDays: getCommandCenterAgeDays(item.endDate, now),
    savings: item.calculatedSavings,
    financeLocked: item.financeLocked,
  }));
  const normalizedFinanceLockedItems: CommandCenterAttentionItem[] = financeLockedItems.map((item) => ({
    savingCardId: item.id,
    title: item.title,
    phase: phaseLabels[item.phase],
    buyerName: item.buyer.name,
    categoryName: item.category.name,
    dateLabel: "Last updated",
    dateValue: item.updatedAt.toISOString(),
    ageDays: getCommandCenterAgeDays(item.updatedAt, now),
    savings: item.calculatedSavings,
    financeLocked: item.financeLocked,
  }));
  const normalizedRecentDecisions: CommandCenterDecisionItem[] = recentDecisions.map((item) => ({
    approvalId: item.id,
    savingCardId: item.savingCard.id,
    savingCardTitle: item.savingCard.title,
    phase: phaseLabels[item.phase],
    approverName: item.approver.name,
    approverRole: formatCommandCenterRoleLabel(item.approver.role),
    status: item.status,
    approved: item.approved,
    createdAt: item.createdAt.toISOString(),
    comment: item.comment,
  }));
  const normalizedRecentActivity: CommandCenterActivityItem[] = recentActivity.map((item) => ({
    savingCardId: item.id,
    savingCardTitle: item.title,
    phase: phaseLabels[item.phase],
    buyerName: item.buyer.name,
    categoryName: item.category.name,
    updatedAt: item.updatedAt.toISOString(),
    financeLocked: item.financeLocked,
    savings: item.calculatedSavings,
  }));

  return {
    filters: filters ?? {},
    kpis: {
      totalPipelineSavings,
      realisedSavings,
      achievedSavings,
      savingsForecast,
      activeProjects,
      pendingApprovals,
    },
    pipelineByPhase,
    forecastCurve: forecastCurve.map(({ sortValue, ...item }) => item),
    topSuppliers,
    savingsByRiskLevel,
    savingsByQualificationStatus,
    pendingApprovalQueue: normalizedPendingApprovalQueue,
    overdueItems: normalizedOverdueItems,
    financeLockedItems: normalizedFinanceLockedItems,
    recentDecisions: normalizedRecentDecisions,
    recentActivity: normalizedRecentActivity,
  };
}

function normalizeRiskLevel(value: string) {
  switch (value.trim().toLowerCase()) {
    case "low":
      return "Low";
    case "medium":
      return "Medium";
    case "high":
      return "High";
    case "critical":
      return "Critical";
    default:
      return "Unrated";
  }
}

function getCommandCenterAgeDays(value: Date, now: Date) {
  return Math.max(
    0,
    Math.floor((now.getTime() - value.getTime()) / (1000 * 60 * 60 * 24))
  );
}

function formatCommandCenterRoleLabel(role: string) {
  return roleLabels[role as keyof typeof roleLabels] ?? role;
}
