import { ApprovalStatus, Phase, Prisma } from "@prisma/client";
import { getForecastMultiplier } from "@/lib/calculations";
import { phaseLabels } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { buildTenantScopeWhere } from "@/lib/tenant-scope";
import type {
  CommandCenterData,
  CommandCenterFilterOptions,
  CommandCenterFilters,
  TenantContextSource,
} from "@/lib/types";

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
  const [categories, businessUnits, buyers, plants, suppliers] = await Promise.all([
    prisma.category.findMany({
      where: buildTenantScopeWhere(context),
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.businessUnit.findMany({
      where: buildTenantScopeWhere(context),
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.buyer.findMany({
      where: buildTenantScopeWhere(context),
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.plant.findMany({
      where: buildTenantScopeWhere(context),
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.supplier.findMany({
      where: buildTenantScopeWhere(context),
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return { categories, businessUnits, buyers, plants, suppliers };
}

export async function getCommandCenterData(
  context: TenantContextSource,
  filters?: CommandCenterFilters
): Promise<CommandCenterData> {
  const where = buildCommandCenterWhere(context, filters);

  const [
    phaseSavings,
    forecastCards,
    supplierSavings,
    qualificationGroups,
    pendingApprovals,
    activeProjects,
    riskCards,
  ] = await Promise.all([
    prisma.savingCard.groupBy({
      by: ["phase"],
      where,
      _sum: { calculatedSavings: true },
    }),
    prisma.savingCard.findMany({
      where,
      select: {
        impactStartDate: true,
        calculatedSavings: true,
        frequency: true,
        phase: true,
      },
    }),
    prisma.savingCard.groupBy({
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
    }),
    prisma.savingCard.groupBy({
      by: ["qualificationStatus"],
      where,
      _sum: { calculatedSavings: true },
    }),
    prisma.phaseChangeRequest.count({
      where: {
        approvalStatus: ApprovalStatus.PENDING,
        savingCard: where,
      },
    }),
    prisma.savingCard.count({
      where: {
        ...where,
        phase: { not: Phase.CANCELLED },
      },
    }),
    prisma.savingCard.findMany({
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
    }),
  ]);

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

  const supplierIds = supplierSavings.map((item) => item.supplierId);
  const suppliers = supplierIds.length
    ? await prisma.supplier.findMany({
        where: buildTenantScopeWhere(context, {
          id: { in: supplierIds },
        }),
        select: { id: true, name: true },
      })
    : [];

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
