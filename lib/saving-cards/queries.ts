import { buildOrganizationUserWhere } from "@/lib/organizations";
import { phaseLabels } from "@/lib/constants";
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
    await Promise.all([
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

export const savingCardExportColumns = [
  "Card ID",
  "Saving Card Title",
  "Phase",
  "Saving Type",
  "Supplier",
  "Material",
  "Alternative Supplier",
  "Alternative Material",
  "Category",
  "Buyer",
  "Business Unit",
  "Saving Driver",
  "Implementation Complexity",
  "Qualification Status",
  "Baseline Price",
  "New Price",
  "Annual Volume",
  "Currency",
  "Savings EUR",
  "Savings USD",
  "Start Date",
  "End Date",
  "Impact Start Date",
  "Impact End Date",
  "Finance Locked",
] as const;

export function mapSavingCardsForExport(cards: SavingCardPortfolio[]) {
  return cards.map((card) => ({
    "Card ID": card.id,
    "Saving Card Title": card.title,
    Phase: phaseLabels[card.phase] ?? card.phase,
    "Saving Type": card.savingType,
    Supplier: card.supplier?.name ?? "",
    Material: card.material?.name ?? "",
    "Alternative Supplier":
      card.alternativeSupplier?.name ?? card.alternativeSupplierManualName ?? "",
    "Alternative Material":
      card.alternativeMaterial?.name ?? card.alternativeMaterialManualName ?? "",
    Category: card.category?.name ?? "",
    Buyer: card.buyer?.name ?? "",
    "Business Unit": card.businessUnit?.name ?? "",
    "Saving Driver": card.savingDriver ?? "",
    "Implementation Complexity": card.implementationComplexity ?? "",
    "Qualification Status": card.qualificationStatus ?? "",
    "Baseline Price": card.baselinePrice,
    "New Price": card.newPrice,
    "Annual Volume": card.annualVolume,
    Currency: card.currency,
    "Savings EUR": card.calculatedSavings,
    "Savings USD": card.calculatedSavingsUSD,
    "Start Date": card.startDate,
    "End Date": card.endDate,
    "Impact Start Date": card.impactStartDate,
    "Impact End Date": card.impactEndDate,
    "Finance Locked": card.financeLocked ? "Yes" : "No",
  }));
}
