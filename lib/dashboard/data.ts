import { Phase } from "@prisma/client";

import { getScopedCachedValue } from "@/lib/cache";
import { computeActualizedSavings } from "@/lib/monthly-close";
import { prisma } from "@/lib/prisma";
import {
  buildTenantOwnedRelationWhere,
  buildTenantScopeWhere,
  resolveTenantScope,
} from "@/lib/tenant-scope";
import { toNumber } from "@/lib/utils/decimal";
import type { DashboardData, TenantContextSource } from "@/lib/types";
import { dashboardCardSelect } from "@/lib/types";
import {
  DASHBOARD_DATA_CACHE_NAMESPACE,
  DASHBOARD_DATA_CACHE_TTL_MS,
} from "@/lib/workspace/portfolio-surface-cache";

/**
 * Sum the actualized (actuals-based) USD value of Captured cards that have at least
 * one confirmed actual, so the dashboard can show realized value alongside the
 * estimated Captured total without replacing it. Reuses the already-loaded dashboard
 * cards to avoid a second saving-card query.
 */
async function getCapturedActualizedValue(
  organizationId: string,
  cards: DashboardData["cards"]
): Promise<{ actualizedUSD: number; cardsWithActuals: number }> {
  const captured = cards.filter((card) => card.phase === Phase.ACHIEVED);
  if (captured.length === 0) {
    return { actualizedUSD: 0, cardsWithActuals: 0 };
  }

  const actuals = await prisma.materialConsumptionActual.findMany({
    where: buildTenantOwnedRelationWhere("savingCard", organizationId, {
      id: { in: captured.map((card) => card.id) },
    }),
    select: { savingCardId: true, actualQty: true },
  });

  const actualsByCard = new Map<string, Array<{ actualQty: number }>>();
  for (const actual of actuals) {
    const list = actualsByCard.get(actual.savingCardId) ?? [];
    list.push({ actualQty: toNumber(actual.actualQty) });
    actualsByCard.set(actual.savingCardId, list);
  }

  let actualizedUSD = 0;
  let cardsWithActuals = 0;
  for (const card of captured) {
    const cardActuals = actualsByCard.get(card.id);
    if (!cardActuals || cardActuals.length === 0) {
      continue;
    }
    cardsWithActuals += 1;
    actualizedUSD += computeActualizedSavings({
      baselinePrice: card.baselinePrice,
      newPrice: card.newPrice,
      referencePrice: card.referencePrice,
      impactType: card.impactType,
      currency: card.currency,
      fxRate: card.fxRate,
      actuals: cardActuals,
    }).actualizedUSD;
  }

  return { actualizedUSD, cardsWithActuals };
}

export async function getDashboardData(
  context: TenantContextSource
): Promise<DashboardData> {
  const scope = resolveTenantScope(context);
  const reportingDate = new Date();
  const currentYear = reportingDate.getUTCFullYear();

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

      const [cards, annualTargetSummary, organization] = await Promise.all([
        prisma.savingCard.findMany({
          where: buildTenantScopeWhere(scope),
          select: dashboardCardSelect,
        }),
        annualTargetAggregate,
        prisma.organization.findUnique({
          where: {
            id: scope.organizationId,
          },
          select: {
            fiscalYearStartMonth: true,
          },
        }),
      ]);
      const annualTarget = toNumber(annualTargetSummary._sum.targetValue);
      const capturedActuals = await getCapturedActualizedValue(
        scope.organizationId,
        cards
      );

      const base = {
        cards,
        fiscalYearStartMonth: organization?.fiscalYearStartMonth ?? 1,
        reportingDate,
        ...(capturedActuals.cardsWithActuals > 0 ? { capturedActuals } : {}),
      };
      return annualTarget > 0 ? { ...base, annualTarget } : base;
    }
  );
}
