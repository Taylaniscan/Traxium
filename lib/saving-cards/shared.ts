import { Currency, Prisma } from "@prisma/client";
import { calculateSavings } from "@/lib/calculations";
import { buildTenantOwnedRelationWhere, buildTenantScopeWhere } from "@/lib/tenant-scope";
import { savingCardSchema } from "@/lib/validation";

export const savingCardDetailInclude = {
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

export function normalizeName(value?: string) {
  return value?.trim() || "";
}

export function normalizeOptionalName(value?: string) {
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

export function buildSavingCardPayload(
  input: Prisma.JsonObject | Record<string, unknown>
) {
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

type SavingCardPayload = ReturnType<typeof buildSavingCardPayload>;

export async function getLatestFxRate(
  tx: Prisma.TransactionClient,
  currency: Currency
) {
  if (currency === Currency.EUR) return 1;

  const rate = await tx.fxRate.findFirst({
    where: { currency },
    orderBy: { validFrom: "desc" },
  });

  return rate?.rateToEUR ?? 1;
}

export async function resolveOrCreateSupplier(
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

export async function resolveOrCreateMaterial(
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

export async function resolveMasterData(
  tx: Prisma.TransactionClient,
  actorId: string,
  organizationId: string,
  payload: SavingCardPayload
) {
  const supplier = await resolveOrCreateSupplier(tx, organizationId, payload.supplier);
  const material = await resolveOrCreateMaterial(tx, organizationId, payload.material);
  const alternativeSupplier = await resolveOptionalSupplier(
    tx,
    organizationId,
    payload.alternativeSupplier
  );
  const alternativeMaterial = await resolveOptionalMaterial(
    tx,
    organizationId,
    payload.alternativeMaterial
  );
  const category = await resolveOrCreateCategory(tx, organizationId, payload.category);
  const plant = await resolveOrCreatePlant(tx, organizationId, payload.plant);
  const businessUnit = await resolveOrCreateBusinessUnit(
    tx,
    organizationId,
    payload.businessUnit
  );
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

export async function getScopedSavingCard(
  tx: Prisma.TransactionClient,
  savingCardId: string,
  organizationId: string
) {
  const card = await tx.savingCard.findFirst({
    where: buildTenantScopeWhere(organizationId, {
      id: savingCardId,
    }),
  });

  if (!card) {
    throw new Error("Saving card not found.");
  }

  return card;
}

export async function getScopedAlternativeSupplier(
  tx: Prisma.TransactionClient,
  alternativeId: string,
  organizationId: string
) {
  const alternative = await tx.savingCardAlternativeSupplier.findFirst({
    where: {
      id: alternativeId,
      ...buildTenantOwnedRelationWhere("savingCard", organizationId),
    },
  });

  if (!alternative) {
    throw new Error("Alternative supplier not found.");
  }

  return alternative;
}

export async function getScopedAlternativeMaterial(
  tx: Prisma.TransactionClient,
  alternativeId: string,
  organizationId: string
) {
  const alternative = await tx.savingCardAlternativeMaterial.findFirst({
    where: {
      id: alternativeId,
      ...buildTenantOwnedRelationWhere("savingCard", organizationId),
    },
  });

  if (!alternative) {
    throw new Error("Alternative material not found.");
  }

  return alternative;
}
