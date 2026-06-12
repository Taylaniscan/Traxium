import { ApprovalStatus, Phase } from "@prisma/client";

import {
  assembleMonthlyClose,
  monthStartUtc,
  type MonthlyCloseInputCard,
  type MonthlyCloseSummary,
} from "@/lib/monthly-close";
import { prisma } from "@/lib/prisma";
import {
  buildTenantOwnedRelationWhere,
  buildTenantScopeWhere,
} from "@/lib/tenant-scope";
import { toNumber } from "@/lib/utils/decimal";
import type { TenantContextSource } from "@/lib/types";

const monthlyCloseCardSelect = {
  id: true,
  title: true,
  phase: true,
  currency: true,
  impactType: true,
  baselinePrice: true,
  newPrice: true,
  referencePrice: true,
  fxRate: true,
  annualizedRunRate: true,
  annualizedRunRateUSD: true,
  impactStartDate: true,
  impactEndDate: true,
} as const;

/**
 * Load and assemble the monthly-close view for one organization and month.
 * Every query is tenant-scoped through the existing tenant-scope helpers.
 */
export async function getMonthlyCloseSummary(
  context: TenantContextSource,
  monthStartInput: Date
): Promise<MonthlyCloseSummary> {
  const monthStart = monthStartUtc(monthStartInput);
  const nextMonthStart = new Date(
    Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1)
  );

  // Cards whose impact window overlaps the month (and are not canceled).
  const cards = await prisma.savingCard.findMany({
    where: buildTenantScopeWhere(context, {
      phase: { not: Phase.CANCELLED },
      impactStartDate: { lt: nextMonthStart },
      impactEndDate: { gte: monthStart },
    }),
    select: monthlyCloseCardSelect,
    orderBy: [{ impactStartDate: "asc" }, { title: "asc" }],
  });

  if (cards.length === 0) {
    return assembleMonthlyClose({
      monthStart,
      cards: [],
      forecastsByCard: new Map(),
      actualsByCard: new Map(),
      pendingRequestCardIds: new Set(),
    });
  }

  const cardIds = cards.map((card) => card.id);

  const [forecasts, actuals, pendingRequests] = await Promise.all([
    prisma.materialConsumptionForecast.findMany({
      where: buildTenantOwnedRelationWhere("savingCard", context, {
        id: { in: cardIds },
      }),
      select: { savingCardId: true, forecastQty: true, period: true },
    }),
    prisma.materialConsumptionActual.findMany({
      where: buildTenantOwnedRelationWhere("savingCard", context, {
        id: { in: cardIds },
      }),
      select: { savingCardId: true, actualQty: true, period: true },
    }),
    prisma.phaseChangeRequest.findMany({
      where: {
        approvalStatus: ApprovalStatus.PENDING,
        ...buildTenantOwnedRelationWhere("savingCard", context, {
          id: { in: cardIds },
        }),
      },
      select: { savingCardId: true },
    }),
  ]);

  const monthTime = monthStart.getTime();
  const forecastsByCard = new Map<string, number>();
  for (const forecast of forecasts) {
    if (monthStartUtc(forecast.period).getTime() === monthTime) {
      forecastsByCard.set(forecast.savingCardId, toNumber(forecast.forecastQty));
    }
  }
  const actualsByCard = new Map<string, number>();
  for (const actual of actuals) {
    if (monthStartUtc(actual.period).getTime() === monthTime) {
      actualsByCard.set(actual.savingCardId, toNumber(actual.actualQty));
    }
  }
  const pendingRequestCardIds = new Set(
    pendingRequests.map((request) => request.savingCardId)
  );

  return assembleMonthlyClose({
    monthStart,
    cards: cards as unknown as MonthlyCloseInputCard[],
    forecastsByCard,
    actualsByCard,
    pendingRequestCardIds,
  });
}
