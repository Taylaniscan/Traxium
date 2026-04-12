import { getScopedCachedValue } from "@/lib/cache";
import { prisma } from "@/lib/prisma";
import { buildTenantScopeWhere, resolveTenantScope } from "@/lib/tenant-scope";
import type { DashboardData, TenantContextSource } from "@/lib/types";
import { dashboardCardSelect } from "@/lib/types";
import {
  DASHBOARD_DATA_CACHE_NAMESPACE,
  DASHBOARD_DATA_CACHE_TTL_MS,
} from "@/lib/workspace/portfolio-surface-cache";

export async function getDashboardData(
  context: TenantContextSource
): Promise<DashboardData> {
  const scope = resolveTenantScope(context);
  const currentYear = new Date().getUTCFullYear();

  return getScopedCachedValue(
    {
      namespace: DASHBOARD_DATA_CACHE_NAMESPACE,
      organizationId: scope.organizationId,
      ttlMs: DASHBOARD_DATA_CACHE_TTL_MS,
    },
    async () => {
      const annualTargetAggregate =
        typeof prisma.annualTarget?.aggregate === "function"
          ? prisma.annualTarget.aggregate({
              where: {
                organizationId: scope.organizationId,
                year: currentYear,
              },
              _sum: {
                targetValue: true,
              },
            })
          : Promise.resolve({
              _sum: {
                targetValue: 0,
              },
            });

      const [cards, annualTargetSummary] = await Promise.all([
        prisma.savingCard.findMany({
          where: buildTenantScopeWhere(scope),
          select: dashboardCardSelect,
        }),
        annualTargetAggregate,
      ]);
      const annualTarget = annualTargetSummary._sum.targetValue ?? 0;

      return annualTarget > 0 ? { cards, annualTarget } : { cards };
    }
  );
}
