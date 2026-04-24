import { Role } from "@prisma/client";
import { getScopedCachedValue } from "@/lib/cache";
import { roleLabels } from "@/lib/constants";
import { buildOrganizationUserWhere } from "@/lib/organizations";
import { prisma } from "@/lib/prisma";
import { buildTenantScopeWhere, resolveTenantScope } from "@/lib/tenant-scope";
import type { TenantContextSource, WorkspaceReadiness } from "@/lib/types";
import {
  WORKSPACE_READINESS_CACHE_NAMESPACE,
  WORKSPACE_READINESS_CACHE_TTL_MS,
} from "@/lib/workspace/portfolio-surface-cache";

const WORKSPACE_READINESS_WORKFLOW_ROLES = [
  Role.HEAD_OF_GLOBAL_PROCUREMENT,
  Role.GLOBAL_CATEGORY_LEADER,
  Role.FINANCIAL_CONTROLLER,
] as const;

export async function getWorkspaceReadiness(
  context: TenantContextSource
): Promise<WorkspaceReadiness> {
  const scope = resolveTenantScope(context);
  const { organizationId } = scope;
  const tenantWhere = buildTenantScopeWhere(scope);
  const [
    organization,
    userCount,
    buyerCount,
    supplierCount,
    materialCount,
    categoryCount,
    plantCount,
    businessUnitCount,
    workflowRoleCounts,
    savingCardMetrics,
  ] = await getScopedCachedValue(
    {
      namespace: WORKSPACE_READINESS_CACHE_NAMESPACE,
      organizationId,
      ttlMs: WORKSPACE_READINESS_CACHE_TTL_MS,
    },
    () =>
      prisma.$transaction([
        prisma.organization.findUnique({
          where: { id: organizationId },
          select: {
            id: true,
            name: true,
            description: true,
            slug: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        prisma.user.count({ where: buildOrganizationUserWhere(scope) }),
        prisma.buyer.count({ where: tenantWhere }),
        prisma.supplier.count({ where: tenantWhere }),
        prisma.material.count({ where: tenantWhere }),
        prisma.category.count({ where: tenantWhere }),
        prisma.plant.count({ where: tenantWhere }),
        prisma.businessUnit.count({ where: tenantWhere }),
        prisma.user.groupBy({
          by: ["role"],
          where: buildOrganizationUserWhere(scope, {
            role: {
              in: [...WORKSPACE_READINESS_WORKFLOW_ROLES],
            },
          }),
          _count: {
            _all: true,
          },
        }),
        prisma.savingCard.aggregate({
          where: tenantWhere,
          _count: {
            _all: true,
          },
          _min: {
            createdAt: true,
          },
          _max: {
            updatedAt: true,
          },
        }),
      ])
  );

  if (!organization) {
    throw new Error("Organization not found.");
  }

  const workflowRoleCountsMap = new Map(
    workflowRoleCounts.map((record) => [record.role, record._count._all])
  );
  const savingCardCount = savingCardMetrics._count._all ?? 0;
  const headOfGlobalProcurementCount =
    workflowRoleCountsMap.get(Role.HEAD_OF_GLOBAL_PROCUREMENT) ?? 0;
  const globalCategoryLeaderCount =
    workflowRoleCountsMap.get(Role.GLOBAL_CATEGORY_LEADER) ?? 0;
  const financialControllerCount =
    workflowRoleCountsMap.get(Role.FINANCIAL_CONTROLLER) ?? 0;

  const masterData = [
    {
      key: "buyers",
      label: "Buyers",
      count: buyerCount,
      ready: buyerCount > 0,
      description: "Commercial ownership for saving cards.",
    },
    {
      key: "suppliers",
      label: "Suppliers",
      count: supplierCount,
      ready: supplierCount > 0,
      description: "Baseline and alternative sourcing counterparties.",
    },
    {
      key: "materials",
      label: "Materials",
      count: materialCount,
      ready: materialCount > 0,
      description: "Material or part master records for sourcing cases.",
    },
    {
      key: "categories",
      label: "Categories",
      count: categoryCount,
      ready: categoryCount > 0,
      description: "Category ownership and savings target structure.",
    },
    {
      key: "plants",
      label: "Plants",
      count: plantCount,
      ready: plantCount > 0,
      description: "Operational scope for plant-level initiatives.",
    },
    {
      key: "businessUnits",
      label: "Business Units",
      count: businessUnitCount,
      ready: businessUnitCount > 0,
      description: "Reporting and accountability structure.",
    },
  ] as const;

  const workflowCoverage = [
    {
      key: "HEAD_OF_GLOBAL_PROCUREMENT",
      label: roleLabels.HEAD_OF_GLOBAL_PROCUREMENT,
      count: headOfGlobalProcurementCount,
      ready: headOfGlobalProcurementCount > 0,
    },
    {
      key: "GLOBAL_CATEGORY_LEADER",
      label: roleLabels.GLOBAL_CATEGORY_LEADER,
      count: globalCategoryLeaderCount,
      ready: globalCategoryLeaderCount > 0,
    },
    {
      key: "FINANCIAL_CONTROLLER",
      label: roleLabels.FINANCIAL_CONTROLLER,
      count: financialControllerCount,
      ready: financialControllerCount > 0,
    },
  ] as const;

  const isMasterDataReady = masterData.every((item) => item.ready);
  const isWorkflowReady = workflowCoverage.every((item) => item.ready);
  const masterDataReadyCount = masterData.filter((item) => item.ready).length;
  const workflowReadyCount = workflowCoverage.filter((item) => item.ready).length;
  const totalChecks = masterData.length + workflowCoverage.length;
  const overallPercent = totalChecks
    ? Math.round(((masterDataReadyCount + workflowReadyCount) / totalChecks) * 100)
    : 100;

  return {
    workspace: organization,
    counts: {
      users: userCount,
      buyers: buyerCount,
      suppliers: supplierCount,
      materials: materialCount,
      categories: categoryCount,
      plants: plantCount,
      businessUnits: businessUnitCount,
      savingCards: savingCardCount,
    },
    masterData,
    workflowCoverage,
    coverage: {
      masterDataReadyCount,
      masterDataTotal: masterData.length,
      workflowReadyCount,
      workflowTotal: workflowCoverage.length,
      overallPercent,
    },
    activity: {
      firstSavingCardCreatedAt: savingCardMetrics._min.createdAt ?? null,
      lastPortfolioUpdateAt: savingCardMetrics._max.updatedAt ?? null,
    },
    isMasterDataReady,
    isWorkflowReady,
    isWorkspaceReady: isMasterDataReady && isWorkflowReady,
    missingCoreSetup: masterData.filter((item) => !item.ready).map((item) => item.label),
    missingWorkflowCoverage: workflowCoverage
      .filter((item) => !item.ready)
      .map((item) => item.label),
  };
}
