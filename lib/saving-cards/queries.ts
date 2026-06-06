import { buildOrganizationUserWhere } from "@/lib/organizations";
import {
  controllerSavingCardColumns,
  mapSavingCardsForControllerExport,
} from "@/lib/export/controller-workbook";
import { prisma } from "@/lib/prisma";
import { buildTenantScopeWhere, resolveTenantScope } from "@/lib/tenant-scope";
import {
  savingCardPortfolioSelect,
  type SavingCardPortfolio,
  type TenantContextSource,
} from "@/lib/types";
import { savingCardDetailInclude } from "@/lib/saving-cards/shared";

export async function getReferenceData(context: TenantContextSource) {
  const scope = resolveTenantScope(context);
  const [users, buyers, suppliers, materials, categories, plants, businessUnits, fxRates] =
    await prisma.$transaction([
      prisma.user.findMany({
        where: buildOrganizationUserWhere(scope),
        orderBy: { name: "asc" },
      }),
      prisma.buyer.findMany({
        where: buildTenantScopeWhere(scope),
        orderBy: { name: "asc" },
      }),
      prisma.supplier.findMany({
        where: buildTenantScopeWhere(scope),
        orderBy: { name: "asc" },
      }),
      prisma.material.findMany({
        where: buildTenantScopeWhere(scope),
        orderBy: { name: "asc" },
      }),
      prisma.category.findMany({
        where: buildTenantScopeWhere(scope),
        orderBy: { name: "asc" },
      }),
      prisma.plant.findMany({
        where: buildTenantScopeWhere(scope),
        orderBy: { name: "asc" },
      }),
      prisma.businessUnit.findMany({
        where: buildTenantScopeWhere(scope),
        orderBy: { name: "asc" },
      }),
      prisma.fxRate.findMany({
        orderBy: { createdAt: "desc" },
      }),
    ]);

  return {
    users,
    buyers,
    suppliers,
    materials,
    categories,
    plants,
    businessUnits,
    fxRates,
  };
}

export async function getSavingCardDetailReferenceData(context: TenantContextSource) {
  const scope = resolveTenantScope(context);
  const suppliers = await prisma.supplier.findMany({
    where: buildTenantScopeWhere(scope),
    orderBy: { name: "asc" },
  });
  const materials = await prisma.material.findMany({
    where: buildTenantScopeWhere(scope),
    orderBy: { name: "asc" },
  });

  return {
    suppliers,
    materials,
  };
}

export async function getSavingCards(
  context: TenantContextSource,
  filters?: {
    categoryId?: string;
    businessUnitId?: string;
    buyerId?: string;
    plantId?: string;
    supplierId?: string;
    stakeholderUserId?: string;
    ids?: string[];
  }
): Promise<SavingCardPortfolio[]> {
  if (filters?.ids && !filters.ids.length) {
    return [];
  }

  return prisma.savingCard.findMany({
    where: buildTenantScopeWhere(context, {
      ...(filters?.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters?.businessUnitId ? { businessUnitId: filters.businessUnitId } : {}),
      ...(filters?.buyerId ? { buyerId: filters.buyerId } : {}),
      ...(filters?.plantId ? { plantId: filters.plantId } : {}),
      ...(filters?.supplierId ? { supplierId: filters.supplierId } : {}),
      ...(filters?.stakeholderUserId
        ? {
            stakeholders: {
              some: {
                userId: filters.stakeholderUserId,
              },
            },
          }
        : {}),
      ...(filters?.ids ? { id: { in: filters.ids } } : {}),
    }),
    select: savingCardPortfolioSelect,
    orderBy: { updatedAt: "desc" },
  });
}

export async function getSavingCard(id: string, context: TenantContextSource) {
  return prisma.savingCard.findFirst({
    where: buildTenantScopeWhere(context, {
      id,
    }),
    include: savingCardDetailInclude,
  });
}

export async function getNotificationsForUser(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
}

export const savingCardExportColumns = controllerSavingCardColumns;

export function mapSavingCardsForExport(cards: SavingCardPortfolio[]) {
  return mapSavingCardsForControllerExport(cards);
}
