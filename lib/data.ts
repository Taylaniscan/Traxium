import { ApprovalStatus, Currency, Phase, Prisma, Role } from "@prisma/client";
import { calculateSavings, getForecastMultiplier } from "@/lib/calculations";
import { phaseLabels } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { requiredRolesForPhase } from "@/lib/permissions";
import { alternativeMaterialSchema, alternativeSupplierSchema, savingCardSchema } from "@/lib/validation";

const GLOBAL_ACCESS_ROLES = new Set<Role>([
  Role.HEAD_OF_GLOBAL_PROCUREMENT,
  Role.GLOBAL_CATEGORY_LEADER,
  Role.FINANCIAL_CONTROLLER,
]);

function hasGlobalAccess(role: Role) {
  return GLOBAL_ACCESS_ROLES.has(role);
}

export class WorkflowError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "WorkflowError";
  }
}

const phaseChangeRequestResultInclude = {
  savingCard: true,
  requestedBy: true,
  approvals: {
    include: {
      approver: true,
    },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.PhaseChangeRequestInclude;

const savingCardDetailInclude = {
  supplier: true,
  material: true,
  alternativeSupplier: true,
  alternativeMaterial: true,
  category: true,
  buyer: true,
  plant: true,
  businessUnit: true,
  evidence: true,
  stakeholders: {
    include: {
      user: true,
    },
  },
  comments: {
    include: {
      author: true,
    },
    orderBy: { createdAt: "desc" as const },
  },
  alternativeSuppliers: {
    include: {
      supplier: true,
    },
  },
  alternativeMaterials: {
    include: {
      material: true,
      supplier: true,
    },
  },
  approvals: {
    include: {
      approver: true,
    },
  },
  phaseHistory: {
    include: {
      changedBy: true,
    },
    orderBy: { createdAt: "desc" as const },
  },
  phaseChangeRequests: {
    include: {
      requestedBy: true,
      approvals: {
        include: {
          approver: true,
        },
      },
    },
    orderBy: { createdAt: "desc" as const },
  },
} satisfies Prisma.SavingCardInclude;

const savingCardListSelect = {
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

const dashboardCardSelect = {
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

function normalizeName(value?: string) {
  return value?.trim() || "";
}

function normalizeOptionalName(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeOptionalString(value: unknown) {
  if (typeof value === "string") {
    return normalizeOptionalName(value);
  }

  if (value && typeof value === "object" && "name" in value) {
    const name = (value as { name?: unknown }).name;
    if (typeof name === "string") {
      return normalizeOptionalName(name);
    }
  }

  return null;
}

function normalizeOptionalId(value: unknown) {
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    if (typeof id === "string") {
      return normalizeOptionalName(id);
    }
  }

  return null;
}

function buildSavingCardPayload(input: Prisma.JsonObject | Record<string, unknown>) {
  const parsed = savingCardSchema.parse(input);
  const totals = calculateSavings({
    baselinePrice: parsed.baselinePrice,
    newPrice: parsed.newPrice,
    annualVolume: parsed.annualVolume,
    fxRate: parsed.fxRate,
    currency: parsed.currency,
  });

  return {
    ...parsed,
    calculatedSavings: totals.savingsEUR,
    calculatedSavingsUSD: totals.savingsUSD,
  };
}

export async function getReferenceData(organizationId: string) {
  const [users, buyers, suppliers, materials, categories, plants, businessUnits, fxRates] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    }),
    prisma.buyer.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    }),
    prisma.supplier.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    }),
    prisma.material.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    }),
    prisma.plant.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    }),
    prisma.businessUnit.findMany({
      where: { organizationId },
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

export async function getWorkspaceReadiness(organizationId: string) {
  const [
    userCount,
    buyerCount,
    supplierCount,
    materialCount,
    categoryCount,
    plantCount,
    businessUnitCount,
    savingCardCount,
    headOfGlobalProcurementCount,
    globalCategoryLeaderCount,
    financialControllerCount,
  ] = await prisma.$transaction([
    prisma.user.count({ where: { organizationId } }),
    prisma.buyer.count({ where: { organizationId } }),
    prisma.supplier.count({ where: { organizationId } }),
    prisma.material.count({ where: { organizationId } }),
    prisma.category.count({ where: { organizationId } }),
    prisma.plant.count({ where: { organizationId } }),
    prisma.businessUnit.count({ where: { organizationId } }),
    prisma.savingCard.count({ where: { organizationId } }),
    prisma.user.count({
      where: {
        organizationId,
        role: Role.HEAD_OF_GLOBAL_PROCUREMENT,
      },
    }),
    prisma.user.count({
      where: {
        organizationId,
        role: Role.GLOBAL_CATEGORY_LEADER,
      },
    }),
    prisma.user.count({
      where: {
        organizationId,
        role: Role.FINANCIAL_CONTROLLER,
      },
    }),
  ]);

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
      label: "Head of Global Procurement",
      count: headOfGlobalProcurementCount,
      ready: headOfGlobalProcurementCount > 0,
    },
    {
      key: "GLOBAL_CATEGORY_LEADER",
      label: "Global Category Leader",
      count: globalCategoryLeaderCount,
      ready: globalCategoryLeaderCount > 0,
    },
    {
      key: "FINANCIAL_CONTROLLER",
      label: "Financial Controller",
      count: financialControllerCount,
      ready: financialControllerCount > 0,
    },
  ] as const;

  const isMasterDataReady = masterData.every((item) => item.ready);
  const isWorkflowReady = workflowCoverage.every((item) => item.ready);

  return {
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
    isMasterDataReady,
    isWorkflowReady,
    isWorkspaceReady: isMasterDataReady && isWorkflowReady,
    missingCoreSetup: masterData.filter((item) => !item.ready).map((item) => item.label),
    missingWorkflowCoverage: workflowCoverage.filter((item) => !item.ready).map((item) => item.label),
  };
}

export async function getSavingCards(
  organizationId: string,
  filters?: {
    categoryId?: string;
    businessUnitId?: string;
    buyerId?: string;
    plantId?: string;
    supplierId?: string;
  }
) {
  return prisma.savingCard.findMany({
    where: {
      organizationId,
      ...(filters?.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters?.businessUnitId ? { businessUnitId: filters.businessUnitId } : {}),
      ...(filters?.buyerId ? { buyerId: filters.buyerId } : {}),
      ...(filters?.plantId ? { plantId: filters.plantId } : {}),
      ...(filters?.supplierId ? { supplierId: filters.supplierId } : {}),
    },
    select: savingCardListSelect,
    orderBy: { updatedAt: "desc" },
  });
}

export async function getSavingCard(id: string, organizationId: string) {
  return prisma.savingCard.findFirst({
    where: {
      id,
      organizationId,
    },
    include: savingCardDetailInclude,
  });
}

async function getLatestFxRate(tx: Prisma.TransactionClient, currency: Currency) {
  if (currency === Currency.EUR) return 1;

  const rate = await tx.fxRate.findFirst({
    where: { currency },
    orderBy: { validFrom: "desc" },
  });

  return rate?.rateToEUR ?? 1;
}

async function resolveOrCreateSupplier(
  tx: Prisma.TransactionClient,
  organizationId: string,
  value: unknown
) {
  const name = normalizeOptionalString(value);
  if (!name) {
    throw new Error("Supplier is required.");
  }

  const existing = await tx.supplier.findUnique({
    where: {
      organizationId_name: {
        organizationId,
        name,
      },
    },
  });

  if (existing) return existing;

  return tx.supplier.create({
    data: {
      organizationId,
      name,
    },
  });
}

async function resolveOptionalSupplier(
  tx: Prisma.TransactionClient,
  organizationId: string,
  value?: { id?: string; name?: string } | null
) {
  const name = normalizeOptionalName(value?.name);
  if (!value?.id && !name) return null;
  return resolveOrCreateSupplier(tx, organizationId, { id: value?.id, name });
}

async function resolveOrCreateMaterial(
  tx: Prisma.TransactionClient,
  organizationId: string,
  value: unknown
) {
  const name = normalizeOptionalString(value);
  if (!name) {
    throw new Error("Material is required.");
  }

  const existing = await tx.material.findUnique({
    where: {
      organizationId_name: {
        organizationId,
        name,
      },
    },
  });

  if (existing) return existing;

  return tx.material.create({
    data: {
      organizationId,
      name,
    },
  });
}

async function resolveOptionalMaterial(
  tx: Prisma.TransactionClient,
  organizationId: string,
  value?: { id?: string; name?: string } | null
) {
  const name = normalizeOptionalName(value?.name);
  if (!value?.id && !name) return null;
  return resolveOrCreateMaterial(tx, organizationId, { id: value?.id, name });
}

async function resolveOrCreateBusinessUnit(
  tx: Prisma.TransactionClient,
  organizationId: string,
  value: unknown
) {
  const name = normalizeOptionalString(value);
  if (!name) {
    throw new Error("Business unit is required.");
  }

  const existing = await tx.businessUnit.findUnique({
    where: {
      organizationId_name: {
        organizationId,
        name,
      },
    },
  });

  if (existing) return existing;

  return tx.businessUnit.create({
    data: {
      organizationId,
      name,
    },
  });
}

async function resolveOrCreateCategory(
  tx: Prisma.TransactionClient,
  organizationId: string,
  value: unknown
) {
  const name = normalizeOptionalString(value);
  if (!name) {
    throw new Error("Category is required.");
  }

  const existing = await tx.category.findUnique({
    where: {
      organizationId_name: {
        organizationId,
        name,
      },
    },
  });

  if (existing) return existing;

  return tx.category.create({
    data: {
      organizationId,
      name,
      annualTarget: 0,
    },
  });
}

async function resolveOrCreatePlant(
  tx: Prisma.TransactionClient,
  organizationId: string,
  value: unknown
) {
  const name = normalizeOptionalString(value);
  if (!name) {
    throw new Error("Plant is required.");
  }

  const existing = await tx.plant.findUnique({
    where: {
      organizationId_name: {
        organizationId,
        name,
      },
    },
  });

  if (existing) return existing;

  return tx.plant.create({
    data: {
      organizationId,
      name,
      region: "Global",
    },
  });
}

async function resolveOrCreateBuyer(
  tx: Prisma.TransactionClient,
  organizationId: string,
  value: unknown
) {
  const id = normalizeOptionalId(value);
  if (id) {
    const existingById = await tx.buyer.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (existingById) return existingById;
  }

  const name = normalizeOptionalString(value);
  if (!name) {
    throw new Error("Buyer is required.");
  }

  const existing = await tx.buyer.findUnique({
    where: {
      organizationId_name: {
        organizationId,
        name,
      },
    },
  });

  if (existing) return existing;

  return tx.buyer.create({
    data: {
      organizationId,
      name,
      email: null,
    },
  });
}

async function resolveMasterData(
  tx: Prisma.TransactionClient,
  actorId: string,
  organizationId: string,
  payload: ReturnType<typeof buildSavingCardPayload>
) {
  const supplier = await resolveOrCreateSupplier(tx, organizationId, payload.supplier);
  const material = await resolveOrCreateMaterial(tx, organizationId, payload.material);
  const alternativeSupplier = await resolveOptionalSupplier(tx, organizationId, payload.alternativeSupplier);
  const alternativeMaterial = await resolveOptionalMaterial(tx, organizationId, payload.alternativeMaterial);
  const category = await resolveOrCreateCategory(tx, organizationId, payload.category);
  const plant = await resolveOrCreatePlant(tx, organizationId, payload.plant);
  const businessUnit = await resolveOrCreateBusinessUnit(tx, organizationId, payload.businessUnit);
  const buyer = await resolveOrCreateBuyer(tx, organizationId, payload.buyer);

  await tx.auditLog.create({
    data: {
      userId: actorId,
      action: "master_data.resolved",
      detail: `Resolved supplier ${supplier.id}, material ${material.id}, alternative supplier ${alternativeSupplier?.id ?? "none"}, alternative material ${alternativeMaterial?.id ?? "none"}, category ${category.id}, plant ${plant.id}, business unit ${businessUnit.id}, buyer ${buyer.id}`,
    },
  });

  return {
    supplierId: supplier.id,
    materialId: material.id,
    alternativeSupplierId: alternativeSupplier?.id ?? null,
    alternativeMaterialId: alternativeMaterial?.id ?? null,
    categoryId: category.id,
    plantId: plant.id,
    businessUnitId: businessUnit.id,
    buyerId: buyer.id,
  };
}

export async function createSavingCard(
  input: Prisma.JsonObject | Record<string, unknown>,
  actorId: string,
  organizationId: string
) {
  const payload = buildSavingCardPayload(input);

  return prisma.$transaction(async (tx) => {
    const resolved = await resolveMasterData(tx, actorId, organizationId, payload);

    const card = await tx.savingCard.create({
      data: {
        organizationId,
        title: payload.title,
        description: payload.description,
        savingType: payload.savingType,
        phase: payload.phase,
        supplierId: resolved.supplierId,
        materialId: resolved.materialId,
        alternativeSupplierId: resolved.alternativeSupplierId,
        alternativeSupplierManualName: resolved.alternativeSupplierId
          ? null
          : normalizeOptionalName(payload.alternativeSupplier?.name),
        alternativeMaterialId: resolved.alternativeMaterialId,
        alternativeMaterialManualName: resolved.alternativeMaterialId
          ? null
          : normalizeOptionalName(payload.alternativeMaterial?.name),
        categoryId: resolved.categoryId,
        plantId: resolved.plantId,
        businessUnitId: resolved.businessUnitId,
        buyerId: resolved.buyerId,
        baselinePrice: payload.baselinePrice,
        newPrice: payload.newPrice,
        annualVolume: payload.annualVolume,
        currency: payload.currency,
        fxRate: payload.fxRate,
        calculatedSavings: payload.calculatedSavings,
        calculatedSavingsUSD: payload.calculatedSavingsUSD,
        frequency: payload.frequency,
        savingDriver: normalizeOptionalName(payload.savingDriver || undefined),
        implementationComplexity: normalizeOptionalName(payload.implementationComplexity || undefined),
        qualificationStatus: normalizeOptionalName(payload.qualificationStatus || undefined),
        startDate: payload.startDate,
        endDate: payload.endDate,
        impactStartDate: payload.impactStartDate,
        impactEndDate: payload.impactEndDate,
        financeLocked: false,
        cancellationReason: payload.cancellationReason || null,
        stakeholders: {
          create: (payload.stakeholderIds ?? []).map((userId) => ({
            userId,
          })),
        },
        phaseHistory: {
          create: {
            fromPhase: null,
            toPhase: payload.phase,
            changedById: actorId,
          },
        },
        auditLogs: {
          create: {
            userId: actorId,
            action: "saving_card.created",
            detail: `Saving card created in ${payload.phase} phase`,
          },
        },
      },
      include: savingCardDetailInclude,
    });

    await createWorkflowNotifications(tx, card.id, payload.phase, organizationId);
    return card;
  });
}

export async function updateSavingCard(
  id: string,
  input: Prisma.JsonObject | Record<string, unknown>,
  actorId: string,
  organizationId: string
) {
  const payload = buildSavingCardPayload(input);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.savingCard.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!existing) {
      throw new Error("Saving card not found.");
    }

    const resolved = await resolveMasterData(tx, actorId, organizationId, payload);

    const updated = await tx.savingCard.update({
      where: { id },
      data: {
        title: payload.title,
        description: payload.description,
        savingType: payload.savingType,
        phase: payload.phase,
        supplierId: resolved.supplierId,
        materialId: resolved.materialId,
        alternativeSupplierId: resolved.alternativeSupplierId,
        alternativeSupplierManualName: resolved.alternativeSupplierId
          ? null
          : normalizeOptionalName(payload.alternativeSupplier?.name),
        alternativeMaterialId: resolved.alternativeMaterialId,
        alternativeMaterialManualName: resolved.alternativeMaterialId
          ? null
          : normalizeOptionalName(payload.alternativeMaterial?.name),
        categoryId: resolved.categoryId,
        plantId: resolved.plantId,
        businessUnitId: resolved.businessUnitId,
        buyerId: resolved.buyerId,
        baselinePrice: existing.financeLocked ? existing.baselinePrice : payload.baselinePrice,
        newPrice: existing.financeLocked ? existing.newPrice : payload.newPrice,
        annualVolume: existing.financeLocked ? existing.annualVolume : payload.annualVolume,
        currency: existing.financeLocked ? existing.currency : payload.currency,
        fxRate: payload.fxRate,
        calculatedSavings: payload.calculatedSavings,
        calculatedSavingsUSD: payload.calculatedSavingsUSD,
        frequency: payload.frequency,
        savingDriver: normalizeOptionalName(payload.savingDriver || undefined),
        implementationComplexity: normalizeOptionalName(payload.implementationComplexity || undefined),
        qualificationStatus: normalizeOptionalName(payload.qualificationStatus || undefined),
        startDate: payload.startDate,
        endDate: payload.endDate,
        impactStartDate: existing.financeLocked ? existing.impactStartDate : payload.impactStartDate,
        impactEndDate: existing.financeLocked ? existing.impactEndDate : payload.impactEndDate,
        cancellationReason: payload.cancellationReason || null,
      },
      include: savingCardDetailInclude,
    });

    await tx.savingCardStakeholder.deleteMany({
      where: { savingCardId: id },
    });

    await tx.savingCardStakeholder.createMany({
      data: (payload.stakeholderIds ?? []).map((userId) => ({
        savingCardId: id,
        userId,
      })),
    });

    if (existing.phase !== payload.phase) {
      await tx.phaseHistory.create({
        data: {
          savingCardId: id,
          fromPhase: existing.phase,
          toPhase: payload.phase,
          changedById: actorId,
        },
      });

      await createWorkflowNotifications(tx, id, payload.phase, organizationId);
    }

    await tx.auditLog.create({
      data: {
        userId: actorId,
        savingCardId: id,
        action: "saving_card.updated",
        detail: `Saving card updated. Current phase: ${payload.phase}`,
      },
    });

    return updated;
  });
}

async function getOrganizationIdForSavingCard(
  tx: Prisma.TransactionClient,
  savingCardId: string
) {
  const card = await tx.savingCard.findUnique({
    where: { id: savingCardId },
    select: { organizationId: true },
  });

  if (!card) {
    throw new Error("Saving card not found.");
  }

  return card.organizationId;
}

export async function createAlternativeSupplier(
  savingCardId: string,
  input: Prisma.JsonObject | Record<string, unknown>,
  actorId: string
) {
  const payload = alternativeSupplierSchema.parse(input);

  return prisma.$transaction(async (tx) => {
    const organizationId = await getOrganizationIdForSavingCard(tx, savingCardId);

    const supplierId = payload.supplier
      ? (await resolveOrCreateSupplier(tx, organizationId, payload.supplier)).id
      : null;

    if (payload.isSelected) {
      await tx.savingCardAlternativeSupplier.updateMany({
        where: { savingCardId },
        data: { isSelected: false },
      });
    }

    const alternative = await tx.savingCardAlternativeSupplier.create({
      data: {
        savingCardId,
        supplierId,
        supplierNameManual: supplierId ? null : normalizeName(payload.supplier?.name),
        country: payload.country,
        quotedPrice: payload.quotedPrice,
        currency: payload.currency,
        leadTimeDays: payload.leadTimeDays,
        moq: payload.moq,
        paymentTerms: payload.paymentTerms,
        qualityRating: payload.qualityRating,
        riskLevel: payload.riskLevel,
        notes: payload.notes || null,
        isSelected: payload.isSelected,
      },
      include: { supplier: true },
    });

    if (payload.isSelected) {
      await applySelectedAlternativeSupplier(tx, savingCardId, alternative.id, actorId);
    }

    return alternative;
  });
}

export async function updateAlternativeSupplier(
  alternativeId: string,
  input: Prisma.JsonObject | Record<string, unknown>,
  actorId: string
) {
  const payload = alternativeSupplierSchema.parse(input);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.savingCardAlternativeSupplier.findUnique({
      where: { id: alternativeId },
    });

    if (!existing) {
      throw new Error("Alternative supplier not found.");
    }

    const organizationId = await getOrganizationIdForSavingCard(tx, existing.savingCardId);

    const supplierId = payload.supplier
      ? (await resolveOrCreateSupplier(tx, organizationId, payload.supplier)).id
      : null;

    if (payload.isSelected) {
      await tx.savingCardAlternativeSupplier.updateMany({
        where: { savingCardId: existing.savingCardId },
        data: { isSelected: false },
      });
    }

    const alternative = await tx.savingCardAlternativeSupplier.update({
      where: { id: alternativeId },
      data: {
        supplierId,
        supplierNameManual: supplierId ? null : normalizeName(payload.supplier?.name),
        country: payload.country,
        quotedPrice: payload.quotedPrice,
        currency: payload.currency,
        leadTimeDays: payload.leadTimeDays,
        moq: payload.moq,
        paymentTerms: payload.paymentTerms,
        qualityRating: payload.qualityRating,
        riskLevel: payload.riskLevel,
        notes: payload.notes || null,
        isSelected: payload.isSelected,
      },
      include: { supplier: true },
    });

    if (payload.isSelected) {
      await applySelectedAlternativeSupplier(tx, existing.savingCardId, alternative.id, actorId);
    }

    return alternative;
  });
}

export async function deleteAlternativeSupplier(alternativeId: string) {
  return prisma.savingCardAlternativeSupplier.delete({
    where: { id: alternativeId },
  });
}

export async function createAlternativeMaterial(
  savingCardId: string,
  input: Prisma.JsonObject | Record<string, unknown>,
  actorId: string
) {
  const payload = alternativeMaterialSchema.parse(input);

  return prisma.$transaction(async (tx) => {
    const organizationId = await getOrganizationIdForSavingCard(tx, savingCardId);

    const materialId = payload.material
      ? (await resolveOrCreateMaterial(tx, organizationId, payload.material)).id
      : null;

    const supplierId = payload.supplier
      ? (await resolveOrCreateSupplier(tx, organizationId, payload.supplier)).id
      : null;

    if (payload.isSelected) {
      await tx.savingCardAlternativeMaterial.updateMany({
        where: { savingCardId },
        data: { isSelected: false },
      });
    }

    const alternative = await tx.savingCardAlternativeMaterial.create({
      data: {
        savingCardId,
        materialId,
        materialNameManual: materialId ? null : normalizeName(payload.material?.name),
        supplierId,
        supplierNameManual: supplierId ? null : normalizeName(payload.supplier?.name),
        specification: payload.specification,
        quotedPrice: payload.quotedPrice,
        currency: payload.currency,
        performanceImpact: payload.performanceImpact,
        qualificationStatus: payload.qualificationStatus,
        riskLevel: payload.riskLevel,
        notes: payload.notes || null,
        isSelected: payload.isSelected,
      },
      include: { material: true, supplier: true },
    });

    if (payload.isSelected) {
      await applySelectedAlternativeMaterial(tx, savingCardId, alternative.id, actorId);
    }

    return alternative;
  });
}

export async function updateAlternativeMaterial(
  alternativeId: string,
  input: Prisma.JsonObject | Record<string, unknown>,
  actorId: string
) {
  const payload = alternativeMaterialSchema.parse(input);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.savingCardAlternativeMaterial.findUnique({
      where: { id: alternativeId },
    });

    if (!existing) {
      throw new Error("Alternative material not found.");
    }

    const organizationId = await getOrganizationIdForSavingCard(tx, existing.savingCardId);

    const materialId = payload.material
      ? (await resolveOrCreateMaterial(tx, organizationId, payload.material)).id
      : null;

    const supplierId = payload.supplier
      ? (await resolveOrCreateSupplier(tx, organizationId, payload.supplier)).id
      : null;

    if (payload.isSelected) {
      await tx.savingCardAlternativeMaterial.updateMany({
        where: { savingCardId: existing.savingCardId },
        data: { isSelected: false },
      });
    }

    const alternative = await tx.savingCardAlternativeMaterial.update({
      where: { id: alternativeId },
      data: {
        materialId,
        materialNameManual: materialId ? null : normalizeName(payload.material?.name),
        supplierId,
        supplierNameManual: supplierId ? null : normalizeName(payload.supplier?.name),
        specification: payload.specification,
        quotedPrice: payload.quotedPrice,
        currency: payload.currency,
        performanceImpact: payload.performanceImpact,
        qualificationStatus: payload.qualificationStatus,
        riskLevel: payload.riskLevel,
        notes: payload.notes || null,
        isSelected: payload.isSelected,
      },
      include: { material: true, supplier: true },
    });

    if (payload.isSelected) {
      await applySelectedAlternativeMaterial(tx, existing.savingCardId, alternative.id, actorId);
    }

    return alternative;
  });
}

export async function deleteAlternativeMaterial(alternativeId: string) {
  return prisma.savingCardAlternativeMaterial.delete({
    where: { id: alternativeId },
  });
}

async function applySelectedAlternativeSupplier(
  tx: Prisma.TransactionClient,
  savingCardId: string,
  alternativeId: string,
  actorId: string
) {
  const [card, alternative] = await Promise.all([
    tx.savingCard.findUnique({ where: { id: savingCardId } }),
    tx.savingCardAlternativeSupplier.findUnique({ where: { id: alternativeId } }),
  ]);

  if (!card || !alternative) {
    throw new Error("Unable to apply selected supplier scenario.");
  }

  const fxRate = await getLatestFxRate(tx, alternative.currency);
  const totals = calculateSavings({
    baselinePrice: card.baselinePrice,
    newPrice: alternative.quotedPrice,
    annualVolume: card.annualVolume,
    fxRate,
    currency: alternative.currency,
  });

  await tx.savingCard.update({
    where: { id: savingCardId },
    data: {
      supplierId: alternative.supplierId ?? card.supplierId,
      alternativeSupplierId: alternative.supplierId ?? card.alternativeSupplierId,
      alternativeSupplierManualName: alternative.supplierId ? null : alternative.supplierNameManual,
      newPrice: alternative.quotedPrice,
      currency: alternative.currency,
      fxRate,
      calculatedSavings: totals.savingsEUR,
      calculatedSavingsUSD: totals.savingsUSD,
    },
  });

  await tx.auditLog.create({
    data: {
      userId: actorId,
      savingCardId,
      action: "alternative_supplier.selected",
      detail: `Alternative supplier ${alternativeId} applied to saving card`,
    },
  });
}

async function applySelectedAlternativeMaterial(
  tx: Prisma.TransactionClient,
  savingCardId: string,
  alternativeId: string,
  actorId: string
) {
  const [card, alternative] = await Promise.all([
    tx.savingCard.findUnique({ where: { id: savingCardId } }),
    tx.savingCardAlternativeMaterial.findUnique({ where: { id: alternativeId } }),
  ]);

  if (!card || !alternative) {
    throw new Error("Unable to apply selected material scenario.");
  }

  const fxRate = await getLatestFxRate(tx, alternative.currency);
  const totals = calculateSavings({
    baselinePrice: card.baselinePrice,
    newPrice: alternative.quotedPrice,
    annualVolume: card.annualVolume,
    fxRate,
    currency: alternative.currency,
  });

  await tx.savingCard.update({
    where: { id: savingCardId },
    data: {
      materialId: alternative.materialId ?? card.materialId,
      supplierId: alternative.supplierId ?? card.supplierId,
      alternativeMaterialId: alternative.materialId ?? card.alternativeMaterialId,
      alternativeMaterialManualName: alternative.materialId ? null : alternative.materialNameManual,
      alternativeSupplierId: alternative.supplierId ?? card.alternativeSupplierId,
      alternativeSupplierManualName: alternative.supplierId ? null : alternative.supplierNameManual,
      newPrice: alternative.quotedPrice,
      currency: alternative.currency,
      fxRate,
      calculatedSavings: totals.savingsEUR,
      calculatedSavingsUSD: totals.savingsUSD,
    },
  });

  await tx.auditLog.create({
    data: {
      userId: actorId,
      savingCardId,
      action: "alternative_material.selected",
      detail: `Alternative material ${alternativeId} applied to saving card`,
    },
  });
}

export async function addApproval(
  savingCardId: string,
  phase: Phase,
  approverId: string,
  approved: boolean,
  comment?: string
) {
  return prisma.$transaction(async (tx) => {
    const record = await tx.approval.create({
      data: {
        savingCardId,
        approverId,
        phase,
        approved,
        status: approved ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED,
        comment,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: approverId,
        savingCardId,
        action: "approval.recorded",
        detail: `${phase} approval ${approved ? "approved" : "rejected"}`,
      },
    });

    return record;
  });
}

async function lockSavingCardForWorkflow(
  tx: Prisma.TransactionClient,
  savingCardId: string,
  organizationId: string
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "SavingCard"
    WHERE "id" = ${savingCardId}
      AND "organizationId" = ${organizationId}
    FOR UPDATE
  `);

  if (!rows.length) {
    throw new WorkflowError("Saving card not found.", 404);
  }
}

async function lockPhaseChangeRequestForWorkflow(
  tx: Prisma.TransactionClient,
  requestId: string
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "PhaseChangeRequest"
    WHERE "id" = ${requestId}
    FOR UPDATE
  `);

  if (!rows.length) {
    throw new WorkflowError("Phase change request not found.", 404);
  }
}

async function getPhaseChangeRequestWithRelations(
  tx: Prisma.TransactionClient,
  requestId: string
) {
  return tx.phaseChangeRequest.findUnique({
    where: { id: requestId },
    include: phaseChangeRequestResultInclude,
  });
}

export async function createPhaseChangeRequest(
  savingCardId: string,
  requestedPhase: Phase,
  requestedById: string,
  organizationId: string,
  comment?: string,
  cancellationReason?: string
) {
  return prisma.$transaction(async (tx) => {
    await lockSavingCardForWorkflow(tx, savingCardId, organizationId);

    const card = await tx.savingCard.findFirst({
      where: {
        id: savingCardId,
        organizationId,
      },
      include: {
        phaseChangeRequests: {
          where: { approvalStatus: ApprovalStatus.PENDING },
          include: { approvals: true },
        },
      },
    });

    if (!card) throw new WorkflowError("Saving card not found.", 404);
    if (card.phase === requestedPhase) throw new WorkflowError("Saving card is already in that phase.");
    if (requestedPhase === "CANCELLED" && !cancellationReason?.trim()) {
      throw new WorkflowError("Cancellation reason is required.");
    }
    if (card.phaseChangeRequests.length) {
      throw new WorkflowError("There is already a pending phase change request for this saving card.", 409);
    }

    const requiredRoles = requestedPhase === "CANCELLED" ? [] : requiredRolesForPhase(requestedPhase);

    const approvers = requiredRoles.length
      ? await tx.user.findMany({
          where: {
            organizationId,
            role: { in: requiredRoles },
          },
          orderBy: { name: "asc" },
        })
      : [];

    if (requiredRoles.length && !approvers.length) {
      throw new WorkflowError("No approvers are configured for the requested phase.");
    }

    const request = await tx.phaseChangeRequest.create({
      data: {
        savingCardId,
        currentPhase: card.phase,
        requestedPhase,
        requestedById,
        comment: comment?.trim() || null,
        cancellationReason: cancellationReason?.trim() || null,
        approvalStatus: requiredRoles.length ? ApprovalStatus.PENDING : ApprovalStatus.APPROVED,
        approvals: {
          create: approvers.map((approver) => ({
            approverId: approver.id,
            role: approver.role,
          })),
        },
      },
      include: {
        requestedBy: true,
        approvals: { include: { approver: true } },
      },
    });

    if (approvers.length) {
      await tx.notification.createMany({
        data: approvers.map((approver) => ({
          userId: approver.id,
          title: "Phase change approval required",
          message: `${card.title} requests movement from ${card.phase} to ${requestedPhase}.`,
        })),
      });
    }

    await tx.auditLog.create({
      data: {
        userId: requestedById,
        savingCardId,
        action: "phase_change.requested",
        detail: `Requested phase change from ${card.phase} to ${requestedPhase}`,
      },
    });

    if (!requiredRoles.length) {
      await tx.auditLog.create({
        data: {
          userId: requestedById,
          savingCardId,
          action: "phase_change.approved",
          detail: `Phase change to ${requestedPhase} auto-approved`,
        },
      });

      await finalizePhaseChangeRequest(tx, request.id, requestedById);
      const finalizedRequest = await getPhaseChangeRequestWithRelations(tx, request.id);

      if (!finalizedRequest) {
        throw new WorkflowError("Phase change request not found.", 404);
      }

      return finalizedRequest;
    }

    const createdRequest = await getPhaseChangeRequestWithRelations(tx, request.id);

    if (!createdRequest) {
      throw new WorkflowError("Phase change request not found.", 404);
    }

    return createdRequest;
  });
}

export async function approvePhaseChangeRequest(
  requestId: string,
  approverId: string,
  organizationId: string,
  approved: boolean,
  comment?: string
) {
  return prisma.$transaction(async (tx) => {
    await lockPhaseChangeRequestForWorkflow(tx, requestId);

    const request = await getPhaseChangeRequestWithRelations(tx, requestId);

    if (!request) throw new WorkflowError("Phase change request not found.", 404);
    if (request.savingCard.organizationId !== organizationId) throw new WorkflowError("Phase change request not found.", 404);
    if (request.approvalStatus !== ApprovalStatus.PENDING) {
      throw new WorkflowError("This phase change request is already closed.", 409);
    }

    const approval = request.approvals.find((item) => item.approverId === approverId);
    if (!approval) throw new WorkflowError("You are not assigned to approve this request.", 403);

    const approvalUpdate = await tx.phaseChangeRequestApproval.updateMany({
      where: {
        id: approval.id,
        status: ApprovalStatus.PENDING,
      },
      data: {
        status: approved ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED,
        comment: comment?.trim() || null,
        decidedAt: new Date(),
      },
    });

    if (!approvalUpdate.count) {
      throw new WorkflowError("You already processed this request.", 409);
    }

    if (!approved) {
      const rejectedRequest = await tx.phaseChangeRequest.update({
        where: { id: requestId },
        data: { approvalStatus: ApprovalStatus.REJECTED },
      });

      await tx.notification.create({
        data: {
          userId: request.requestedById,
          title: "Phase change rejected",
          message: `${request.savingCard.title} phase change to ${request.requestedPhase} was rejected.`,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: approverId,
          savingCardId: request.savingCardId,
          action: "phase_change.rejected",
          detail: `Phase change to ${request.requestedPhase} rejected`,
        },
      });

      const result = await getPhaseChangeRequestWithRelations(tx, rejectedRequest.id);

      if (!result) {
        throw new WorkflowError("Phase change request not found.", 404);
      }

      return result;
    }

    const remaining = await tx.phaseChangeRequestApproval.count({
      where: {
        phaseChangeRequestId: requestId,
        status: ApprovalStatus.PENDING,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: approverId,
        savingCardId: request.savingCardId,
        action: "phase_change.approved",
        detail:
          remaining === 0
            ? `Final approval recorded for phase change to ${request.requestedPhase}`
            : `Approval recorded for phase change to ${request.requestedPhase}`,
      },
    });

    if (remaining === 0) {
      await tx.phaseChangeRequest.update({
        where: { id: requestId },
        data: { approvalStatus: ApprovalStatus.APPROVED },
      });

      await finalizePhaseChangeRequest(tx, requestId, approverId);
    }

    const result = await getPhaseChangeRequestWithRelations(tx, requestId);

    if (!result) {
      throw new WorkflowError("Phase change request not found.", 404);
    }

    return result;
  });
}

async function finalizePhaseChangeRequest(
  tx: Prisma.TransactionClient,
  requestId: string,
  actorId: string
) {
  const request = await tx.phaseChangeRequest.findUnique({
    where: { id: requestId },
    include: { savingCard: true },
  });

  if (!request) throw new Error("Phase change request not found.");

  await tx.savingCard.update({
    where: { id: request.savingCardId },
    data: {
      phase: request.requestedPhase,
      cancellationReason:
        request.requestedPhase === "CANCELLED"
          ? request.cancellationReason ?? request.savingCard.cancellationReason
          : null,
    },
  });

  await tx.phaseHistory.create({
    data: {
      savingCardId: request.savingCardId,
      fromPhase: request.currentPhase,
      toPhase: request.requestedPhase,
      changedById: actorId,
    },
  });

  await tx.notification.create({
    data: {
      userId: request.requestedById,
      title: "Phase change completed",
      message: `${request.savingCard.title} moved to ${request.requestedPhase}.`,
    },
  });

  await tx.auditLog.create({
    data: {
      userId: actorId,
      savingCardId: request.savingCardId,
      action: "phase_change.completed",
      detail: `Phase changed from ${request.currentPhase} to ${request.requestedPhase}`,
    },
  });
}

export async function getPendingApprovals(userId: string, organizationId?: string) {
  return prisma.phaseChangeRequestApproval.findMany({
    where: {
      approverId: userId,
      status: ApprovalStatus.PENDING,
      phaseChangeRequest: {
        approvalStatus: ApprovalStatus.PENDING,
        savingCard: organizationId
          ? {
              organizationId,
            }
          : undefined,
      },
    },
    include: {
      phaseChangeRequest: {
        include: {
          savingCard: true,
          requestedBy: true,
          approvals: { include: { approver: true } },
        },
      },
      approver: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function setFinanceLock(savingCardId: string, actorId: string, locked: boolean) {
  return prisma.$transaction(async (tx) => {
    const card = await tx.savingCard.update({
      where: { id: savingCardId },
      data: { financeLocked: locked },
    });

    await tx.auditLog.create({
      data: {
        userId: actorId,
        savingCardId,
        action: locked ? "finance.locked" : "finance.unlocked",
        detail: locked ? "Finance lock enabled" : "Finance lock removed",
      },
    });

    return card;
  });
}

async function createWorkflowNotifications(
  tx: Prisma.TransactionClient,
  savingCardId: string,
  phase: Phase,
  organizationId: string
) {
  const roles = requiredRolesForPhase(phase);
  if (!roles.length) return;

  const users = await tx.user.findMany({
    where: {
      organizationId,
      role: { in: roles },
    },
  });

  if (!users.length) return;

  await tx.notification.createMany({
    data: users.map((user) => ({
      userId: user.id,
      title: `Approval required for ${phase}`,
      message: `Saving card ${savingCardId} requires your approval.`,
    })),
  });
}

export async function getDashboardData(organizationId: string) {
  const [cards, targets] = await Promise.all([
    prisma.savingCard.findMany({
      where: { organizationId },
      select: dashboardCardSelect,
    }),
    prisma.annualTarget.findMany({
      where: { organizationId },
      include: { category: true },
    }),
  ]);

  const totalPipelineSavings = cards
    .filter((card) => card.phase !== "CANCELLED")
    .reduce((sum, card) => sum + card.calculatedSavings, 0);

  const totalRealisedSavings = cards
    .filter((card) => card.phase === "REALISED")
    .reduce((sum, card) => sum + card.calculatedSavings, 0);

  const totalAchievedSavings = cards
    .filter((card) => card.phase === "ACHIEVED")
    .reduce((sum, card) => sum + card.calculatedSavings, 0);

  const byCategory = Object.values(
    cards.reduce<Record<string, { category: string; savings: number }>>((acc, card) => {
      const key = card.category.name;
      acc[key] ??= { category: key, savings: 0 };
      acc[key].savings += card.calculatedSavings;
      return acc;
    }, {})
  );

  const byBuyer = Object.values(
    cards.reduce<Record<string, { buyer: string; savings: number }>>((acc, card) => {
      const key = card.buyer.name;
      acc[key] ??= { buyer: key, savings: 0 };
      acc[key].savings += card.calculatedSavings;
      return acc;
    }, {})
  );

  const byBusinessUnit = Object.values(
    cards.reduce<Record<string, { businessUnit: string; savings: number }>>((acc, card) => {
      const key = card.businessUnit.name;
      acc[key] ??= { businessUnit: key, savings: 0 };
      acc[key].savings += card.calculatedSavings;
      return acc;
    }, {})
  );

  const monthlyTrend = Object.values(
    cards.reduce<Record<string, { month: string; savings: number; forecast: number }>>((acc, card) => {
      const key = new Date(card.impactStartDate).toLocaleString("en-US", {
        month: "short",
        year: "numeric",
      });
      acc[key] ??= { month: key, savings: 0, forecast: 0 };
      acc[key].savings += card.calculatedSavings;
      acc[key].forecast += card.calculatedSavings * getForecastMultiplier(card.frequency);
      return acc;
    }, {})
  );

  const savingsVsTarget = targets.map((target) => {
    const current = cards
      .filter((card) => !target.categoryId || card.categoryId === target.categoryId)
      .reduce((sum, card) => sum + card.calculatedSavings, 0);

    return {
      label: target.category?.name ?? `${target.year} Global`,
      target: target.targetValue,
      actual: current,
    };
  });

  return {
    cards,
    totalPipelineSavings,
    totalRealisedSavings,
    totalAchievedSavings,
    byCategory,
    byBuyer,
    byBusinessUnit,
    monthlyTrend,
    savingsVsTarget,
  };
}

type CommandCenterFilters = {
  categoryId?: string;
  businessUnitId?: string;
  buyerId?: string;
  plantId?: string;
  supplierId?: string;
};

function buildCommandCenterWhere(
  organizationId: string,
  filters?: CommandCenterFilters
): Prisma.SavingCardWhereInput {
  return {
    organizationId,
    categoryId: filters?.categoryId || undefined,
    businessUnitId: filters?.businessUnitId || undefined,
    buyerId: filters?.buyerId || undefined,
    plantId: filters?.plantId || undefined,
    supplierId: filters?.supplierId || undefined,
  };
}

export async function getCommandCenterFilterOptions(organizationId: string) {
  const [categories, businessUnits, buyers, plants, suppliers] = await Promise.all([
    prisma.category.findMany({
      where: { organizationId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.businessUnit.findMany({
      where: { organizationId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.buyer.findMany({
      where: { organizationId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.plant.findMany({
      where: { organizationId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.supplier.findMany({
      where: { organizationId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return { categories, businessUnits, buyers, plants, suppliers };
}

export async function getCommandCenterData(
  organizationId: string,
  filters?: CommandCenterFilters
) {
  const where = buildCommandCenterWhere(organizationId, filters);

  const [
    phaseSavings,
    forecastCards,
    supplierSavings,
    qualificationGroups,
    pendingApprovals,
    activeProjects,
    benchmarkCards,
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
        id: true,
        material: { select: { name: true } },
        supplier: { select: { name: true } },
        plant: { select: { name: true } },
        baselinePrice: true,
        newPrice: true,
        annualVolume: true,
        calculatedSavings: true,
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

  const phaseMap = new Map(phaseSavings.map((item) => [item.phase, item._sum.calculatedSavings ?? 0]));

  const pipelineByPhase = ["IDEA", "VALIDATED", "REALISED", "ACHIEVED", "CANCELLED"].map((phase) => ({
    phase,
    label: phaseLabels[phase as Phase],
    savings: phaseMap.get(phase as Phase) ?? 0,
  }));

  const forecastCurve = Object.values(
    forecastCards.reduce<Record<string, { month: string; savings: number; forecast: number; sortValue: number }>>(
      (acc, card) => {
        const date = new Date(card.impactStartDate);
        const monthKey = new Intl.DateTimeFormat("en-US", {
          month: "short",
          year: "numeric",
        }).format(date);

        acc[monthKey] ??= {
          month: monthKey,
          savings: 0,
          forecast: 0,
          sortValue: new Date(date.getFullYear(), date.getMonth(), 1).getTime(),
        };

        acc[monthKey].savings += card.calculatedSavings;
        acc[monthKey].forecast += card.calculatedSavings * getForecastMultiplier(card.frequency);
        return acc;
      },
      {}
    )
  ).sort((a, b) => a.sortValue - b.sortValue);

  const supplierIds = supplierSavings.map((item) => item.supplierId);
  const suppliers = supplierIds.length
    ? await prisma.supplier.findMany({
        where: {
          organizationId,
          id: { in: supplierIds },
        },
        select: { id: true, name: true },
      })
    : [];

  const supplierNameMap = new Map(suppliers.map((item) => [item.id, item.name]));

  const topSuppliers = supplierSavings.map((item) => ({
    supplier: supplierNameMap.get(item.supplierId) ?? "Unknown supplier",
    savings: item._sum.calculatedSavings ?? 0,
  }));

  const benchmarkOpportunities = benchmarkCards
    .map((card) => {
      const variancePercent = card.baselinePrice
        ? ((card.baselinePrice - card.newPrice) / card.baselinePrice) * 100
        : 0;

      return {
        savingCardId: card.id,
        material: card.material.name,
        supplier: card.supplier.name,
        plant: card.plant.name,
        currentPrice: card.baselinePrice,
        benchmarkPrice: card.newPrice,
        variancePercent,
        potentialSaving: Math.max(card.calculatedSavings, 0),
      };
    })
    .filter((item) => item.potentialSaving > 0)
    .sort((a, b) => b.potentialSaving - a.potentialSaving)
    .slice(0, 10);

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

  const qualificationOrder = ["Not Started", "Lab Testing", "Plant Trial", "Approved", "Rejected", "Unspecified"];
  const savingsByQualificationStatus = qualificationOrder
    .map((status) => ({
      status,
      savings:
        qualificationGroups.find((item) => (item.qualificationStatus ?? "Unspecified") === status)?._sum
          .calculatedSavings ?? 0,
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
    benchmarkOpportunities,
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

export async function getApprovalStatus(cardId: string, phase: Phase) {
  const approvals = await prisma.approval.findMany({
    where: { savingCardId: cardId, phase },
    include: { approver: true },
  });

  const requiredRoles = requiredRolesForPhase(phase);

  return requiredRoles.map((role) => ({
    role,
    approved: approvals.some((approval) => approval.approved && approval.approver.role === role),
  }));
}

export async function getNotificationsForUser(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
}

export async function importSavingCards(
  rows: Record<string, unknown>[],
  actorId: string,
  organizationId: string
) {
  for (const row of rows) {
    await createSavingCard(row, actorId, organizationId);
  }
}

export function mapSavingCardsForExport(cards: Awaited<ReturnType<typeof getSavingCards>>) {
  return cards.map((card) => ({
    Title: card.title,
    Phase: card.phase,
    Supplier: card.supplier.name,
    Material: card.material.name,
    AlternativeSupplier: card.alternativeSupplier?.name ?? card.alternativeSupplierManualName ?? "",
    AlternativeMaterial: card.alternativeMaterial?.name ?? card.alternativeMaterialManualName ?? "",
    SavingDriver: card.savingDriver ?? "",
    ImplementationComplexity: card.implementationComplexity ?? "",
    QualificationStatus: card.qualificationStatus ?? "",
    Category: card.category.name,
    Buyer: card.buyer.name,
    BusinessUnit: card.businessUnit.name,
    BaselinePrice: card.baselinePrice,
    NewPrice: card.newPrice,
    AnnualVolume: card.annualVolume,
    Currency: card.currency,
    SavingsEUR: card.calculatedSavings,
    SavingsUSD: card.calculatedSavingsUSD,
    StartDate: card.startDate,
    EndDate: card.endDate,
    ImpactStartDate: card.impactStartDate,
    ImpactEndDate: card.impactEndDate,
    FinanceLocked: card.financeLocked,
  }));
}
