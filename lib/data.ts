import { ApprovalStatus, Prisma, Phase, Role } from "@prisma/client";
import { calculateSavings, getForecastMultiplier } from "@/lib/calculations";
import { phaseLabels } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { requiredRolesForPhase } from "@/lib/permissions";
import { alternativeMaterialSchema, alternativeSupplierSchema, savingCardSchema } from "@/lib/validation";

export async function getReferenceData() {
  const [users, suppliers, materials, categories, plants, businessUnits, fxRates] = await Promise.all([
    prisma.user.findMany({ orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
    prisma.material.findMany({ orderBy: { name: "asc" } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.plant.findMany({ orderBy: { name: "asc" } }),
    prisma.businessUnit.findMany({ orderBy: { name: "asc" } }),
    prisma.fxRate.findMany({ orderBy: { validFrom: "desc" } })
  ]);

  return { users, suppliers, materials, categories, plants, businessUnits, fxRates };
}

export async function getSavingCards(filters?: {
  phase?: string;
  categoryId?: string;
  buyerId?: string;
  supplierId?: string;
  businessUnitId?: string;
}) {
  return prisma.savingCard.findMany({
    where: {
      phase: filters?.phase ? (filters.phase as Phase) : undefined,
      categoryId: filters?.categoryId || undefined,
      buyerId: filters?.buyerId || undefined,
      supplierId: filters?.supplierId || undefined,
      businessUnitId: filters?.businessUnitId || undefined
    },
    include: {
      supplier: true,
      material: true,
      alternativeSupplier: true,
      alternativeMaterial: true,
      category: true,
      plant: true,
      businessUnit: true,
      buyer: true,
      stakeholders: { include: { user: true } },
      evidence: true,
      alternativeSuppliers: { include: { supplier: true } },
      alternativeMaterials: { include: { material: true, supplier: true } },
      approvals: { include: { approver: true } },
      phaseChangeRequests: {
        include: { requestedBy: true, approvals: { include: { approver: true } } },
        orderBy: { createdAt: "desc" }
      },
      comments: { include: { author: true }, orderBy: { createdAt: "desc" } },
      phaseHistory: { orderBy: { createdAt: "desc" } }
    },
    orderBy: { updatedAt: "desc" }
  });
}

export async function getSavingCard(id: string) {
  return prisma.savingCard.findUnique({
    where: { id },
    include: {
      supplier: true,
      material: true,
      alternativeSupplier: true,
      alternativeMaterial: true,
      category: true,
      plant: true,
      businessUnit: true,
      buyer: true,
      stakeholders: { include: { user: true } },
      evidence: true,
      alternativeSuppliers: { include: { supplier: true }, orderBy: { createdAt: "desc" } },
      alternativeMaterials: { include: { material: true, supplier: true }, orderBy: { createdAt: "desc" } },
      approvals: { include: { approver: true }, orderBy: { createdAt: "desc" } },
      phaseChangeRequests: {
        include: { requestedBy: true, approvals: { include: { approver: true } } },
        orderBy: { createdAt: "desc" }
      },
      comments: { include: { author: true }, orderBy: { createdAt: "desc" } },
      phaseHistory: { orderBy: { createdAt: "desc" } }
    }
  });
}

function buildSavingCardPayload(input: Prisma.JsonObject | Record<string, unknown>) {
  const parsed = savingCardSchema.parse(input);
  const totals = calculateSavings({
    baselinePrice: parsed.baselinePrice,
    newPrice: parsed.newPrice,
    annualVolume: parsed.annualVolume,
    fxRate: parsed.fxRate,
    currency: parsed.currency
  });

  return {
    ...parsed,
    calculatedSavings: totals.savingsEUR,
    calculatedSavingsUSD: totals.savingsUSD
  };
}

async function resolveMasterData(
  tx: Prisma.TransactionClient,
  actorId: string,
  payload: ReturnType<typeof buildSavingCardPayload>
) {
  const supplierId = await resolveOrCreateSupplier(tx, payload.supplier);
  const materialId = await resolveOrCreateMaterial(tx, payload.material);
  const alternativeSupplierId = await resolveOptionalSupplier(tx, payload.alternativeSupplier);
  const alternativeMaterialId = await resolveOptionalMaterial(tx, payload.alternativeMaterial);
  const categoryId = await resolveOrCreateCategory(tx, payload.category);
  const plantId = await resolveOrCreatePlant(tx, payload.plant);
  const businessUnitId = await resolveOrCreateBusinessUnit(tx, payload.businessUnit);
  const buyerId = await resolveOrCreateBuyer(tx, payload.buyer);

  await tx.auditLog.create({
    data: {
      userId: actorId,
      action: "master_data.resolved",
      detail: `Resolved supplier ${supplierId}, material ${materialId}, alternative supplier ${alternativeSupplierId ?? "none"}, alternative material ${alternativeMaterialId ?? "none"}, category ${categoryId}, plant ${plantId}, business unit ${businessUnitId}, buyer ${buyerId}`
    }
  });

  return { supplierId, materialId, alternativeSupplierId, alternativeMaterialId, categoryId, plantId, businessUnitId, buyerId };
}

async function getLatestFxRate(tx: Prisma.TransactionClient, currency: "EUR" | "USD") {
  if (currency === "EUR") return 1;
  const rate = await tx.fxRate.findFirst({
    where: { currency },
    orderBy: { validFrom: "desc" }
  });
  return rate?.rateToEUR ?? 1;
}

export async function createSavingCard(
  input: Prisma.JsonObject | Record<string, unknown>,
  actorId: string
) {
  const payload = buildSavingCardPayload(input);

  return prisma.$transaction(async (tx) => {
    const resolved = await resolveMasterData(tx, actorId, payload);
    const card = await tx.savingCard.create({
      data: {
        title: payload.title,
        description: payload.description,
        savingType: payload.savingType,
        phase: payload.phase,
        supplierId: resolved.supplierId,
        materialId: resolved.materialId,
        alternativeSupplierId: resolved.alternativeSupplierId,
        alternativeSupplierManualName: resolved.alternativeSupplierId ? null : normalizeOptionalName(payload.alternativeSupplier?.name),
        alternativeMaterialId: resolved.alternativeMaterialId,
        alternativeMaterialManualName: resolved.alternativeMaterialId ? null : normalizeOptionalName(payload.alternativeMaterial?.name),
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
        cancellationReason: payload.cancellationReason || null,
        stakeholders: {
          create: payload.stakeholderIds.map((userId) => ({ userId }))
        },
        phaseHistory: {
          create: {
            fromPhase: null,
            toPhase: payload.phase,
            changedById: actorId
          }
        },
        auditLogs: {
          create: {
            userId: actorId,
            action: "saving_card.created",
            detail: `Saving card created in ${payload.phase} phase`
          }
        }
      }
    });

    await createWorkflowNotifications(tx, card.id, payload.phase);
    return card;
  });
}

export async function updateSavingCard(
  id: string,
  input: Prisma.JsonObject | Record<string, unknown>,
  actorId: string
) {
  const existing = await prisma.savingCard.findUnique({ where: { id } });
  if (!existing) throw new Error("Saving card not found.");

  const payload = buildSavingCardPayload(input);

  return prisma.$transaction(async (tx) => {
    const resolved = await resolveMasterData(tx, actorId, payload);
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
        alternativeSupplierManualName: resolved.alternativeSupplierId ? null : normalizeOptionalName(payload.alternativeSupplier?.name),
        alternativeMaterialId: resolved.alternativeMaterialId,
        alternativeMaterialManualName: resolved.alternativeMaterialId ? null : normalizeOptionalName(payload.alternativeMaterial?.name),
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
        cancellationReason: payload.cancellationReason || null
      }
    });

    await tx.savingCardStakeholder.deleteMany({ where: { savingCardId: id } });
    await tx.savingCardStakeholder.createMany({
      data: payload.stakeholderIds.map((userId) => ({ savingCardId: id, userId }))
    });

    if (existing.phase !== payload.phase) {
      await tx.phaseHistory.create({
        data: {
          savingCardId: id,
          fromPhase: existing.phase,
          toPhase: payload.phase,
          changedById: actorId
        }
      });
      await createWorkflowNotifications(tx, id, payload.phase);
    }

    await tx.auditLog.create({
      data: {
        userId: actorId,
        savingCardId: id,
        action: "saving_card.updated",
        detail: `Saving card updated. Current phase: ${payload.phase}`
      }
    });

    return updated;
  });
}

export async function createAlternativeSupplier(
  savingCardId: string,
  input: Prisma.JsonObject | Record<string, unknown>,
  actorId: string
) {
  const payload = alternativeSupplierSchema.parse(input);

  return prisma.$transaction(async (tx) => {
    const supplierId = payload.supplier ? await resolveOrCreateSupplier(tx, payload.supplier) : null;
    if (payload.isSelected) {
      await tx.savingCardAlternativeSupplier.updateMany({
        where: { savingCardId },
        data: { isSelected: false }
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
        isSelected: payload.isSelected
      },
      include: { supplier: true }
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
    const existing = await tx.savingCardAlternativeSupplier.findUnique({ where: { id: alternativeId } });
    if (!existing) throw new Error("Alternative supplier not found.");

    const supplierId = payload.supplier ? await resolveOrCreateSupplier(tx, payload.supplier) : null;
    if (payload.isSelected) {
      await tx.savingCardAlternativeSupplier.updateMany({
        where: { savingCardId: existing.savingCardId },
        data: { isSelected: false }
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
        isSelected: payload.isSelected
      },
      include: { supplier: true }
    });

    if (payload.isSelected) {
      await applySelectedAlternativeSupplier(tx, existing.savingCardId, alternative.id, actorId);
    }

    return alternative;
  });
}

export async function deleteAlternativeSupplier(alternativeId: string) {
  return prisma.savingCardAlternativeSupplier.delete({
    where: { id: alternativeId }
  });
}

export async function createAlternativeMaterial(
  savingCardId: string,
  input: Prisma.JsonObject | Record<string, unknown>,
  actorId: string
) {
  const payload = alternativeMaterialSchema.parse(input);

  return prisma.$transaction(async (tx) => {
    const materialId = payload.material ? await resolveOrCreateMaterial(tx, payload.material) : null;
    const supplierId = payload.supplier ? await resolveOrCreateSupplier(tx, payload.supplier) : null;

    if (payload.isSelected) {
      await tx.savingCardAlternativeMaterial.updateMany({
        where: { savingCardId },
        data: { isSelected: false }
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
        isSelected: payload.isSelected
      },
      include: { material: true, supplier: true }
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
    const existing = await tx.savingCardAlternativeMaterial.findUnique({ where: { id: alternativeId } });
    if (!existing) throw new Error("Alternative material not found.");

    const materialId = payload.material ? await resolveOrCreateMaterial(tx, payload.material) : null;
    const supplierId = payload.supplier ? await resolveOrCreateSupplier(tx, payload.supplier) : null;

    if (payload.isSelected) {
      await tx.savingCardAlternativeMaterial.updateMany({
        where: { savingCardId: existing.savingCardId },
        data: { isSelected: false }
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
        isSelected: payload.isSelected
      },
      include: { material: true, supplier: true }
    });

    if (payload.isSelected) {
      await applySelectedAlternativeMaterial(tx, existing.savingCardId, alternative.id, actorId);
    }

    return alternative;
  });
}

export async function deleteAlternativeMaterial(alternativeId: string) {
  return prisma.savingCardAlternativeMaterial.delete({
    where: { id: alternativeId }
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
    tx.savingCardAlternativeSupplier.findUnique({ where: { id: alternativeId } })
  ]);

  if (!card || !alternative) throw new Error("Unable to apply selected supplier scenario.");
  const fxRate = await getLatestFxRate(tx, alternative.currency);
  const totals = calculateSavings({
    baselinePrice: card.baselinePrice,
    newPrice: alternative.quotedPrice,
    annualVolume: card.annualVolume,
    fxRate,
    currency: alternative.currency
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
      calculatedSavingsUSD: totals.savingsUSD
    }
  });

  await tx.auditLog.create({
    data: {
      userId: actorId,
      savingCardId,
      action: "alternative_supplier.selected",
      detail: `Alternative supplier ${alternativeId} applied to saving card`
    }
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
    tx.savingCardAlternativeMaterial.findUnique({ where: { id: alternativeId } })
  ]);

  if (!card || !alternative) throw new Error("Unable to apply selected material scenario.");
  const fxRate = await getLatestFxRate(tx, alternative.currency);
  const totals = calculateSavings({
    baselinePrice: card.baselinePrice,
    newPrice: alternative.quotedPrice,
    annualVolume: card.annualVolume,
    fxRate,
    currency: alternative.currency
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
      calculatedSavingsUSD: totals.savingsUSD
    }
  });

  await tx.auditLog.create({
    data: {
      userId: actorId,
      savingCardId,
      action: "alternative_material.selected",
      detail: `Alternative material ${alternativeId} applied to saving card`
    }
  });
}

function normalizeName(value?: string) {
  return value?.trim() || "";
}

function normalizeOptionalName(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

async function resolveOrCreateSupplier(tx: Prisma.TransactionClient, value: { id?: string; name?: string }) {
  if (value.id) {
    return value.id;
  }
  const name = normalizeName(value.name);
  const existing = await tx.supplier.findUnique({ where: { name } });
  if (existing) return existing.id;
  const created = await tx.supplier.create({ data: { name } });
  return created.id;
}

async function resolveOptionalSupplier(tx: Prisma.TransactionClient, value?: { id?: string; name?: string }) {
  const name = normalizeName(value?.name);
  if (!value?.id && !name) return null;
  return resolveOrCreateSupplier(tx, { id: value?.id, name });
}

async function resolveOrCreateMaterial(tx: Prisma.TransactionClient, value: { id?: string; name?: string }) {
  if (value.id) {
    return value.id;
  }
  const name = normalizeName(value.name);
  const existing = await tx.material.findUnique({ where: { name } });
  if (existing) return existing.id;
  const created = await tx.material.create({ data: { name } });
  return created.id;
}

async function resolveOptionalMaterial(tx: Prisma.TransactionClient, value?: { id?: string; name?: string }) {
  const name = normalizeName(value?.name);
  if (!value?.id && !name) return null;
  return resolveOrCreateMaterial(tx, { id: value?.id, name });
}

async function resolveOrCreateBusinessUnit(tx: Prisma.TransactionClient, value: { id?: string; name?: string }) {
  if (value.id) {
    return value.id;
  }
  const name = normalizeName(value.name);
  const existing = await tx.businessUnit.findUnique({ where: { name } });
  if (existing) return existing.id;
  const created = await tx.businessUnit.create({ data: { name } });
  return created.id;
}

async function resolveOrCreateCategory(tx: Prisma.TransactionClient, value: { id?: string; name?: string }) {
  if (value.id) return value.id;
  const name = normalizeName(value.name);
  const existing = await tx.category.findUnique({ where: { name } });
  if (existing) return existing.id;
  const created = await tx.category.create({ data: { name, annualTarget: 0 } });
  return created.id;
}

async function resolveOrCreatePlant(tx: Prisma.TransactionClient, value: { id?: string; name?: string }) {
  if (value.id) return value.id;
  const name = normalizeName(value.name);
  const existing = await tx.plant.findUnique({ where: { name } });
  if (existing) return existing.id;
  const created = await tx.plant.create({ data: { name, region: "Global" } });
  return created.id;
}

async function resolveOrCreateBuyer(tx: Prisma.TransactionClient, value: { id?: string; name?: string }) {
  if (value.id) return value.id;
  const name = normalizeName(value.name);
  const existing = await tx.user.findFirst({
    where: {
      name
    }
  });
  if (existing) return existing.id;

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/(^\.|\.$)/g, "");
  let email = `${slug || "buyer"}@traxium.local`;
  let suffix = 1;

  while (await tx.user.findUnique({ where: { email } })) {
    suffix += 1;
    email = `${slug || "buyer"}${suffix}@traxium.local`;
  }

  const created = await tx.user.create({
    data: {
      name,
      email,
      role: Role.TACTICAL_BUYER
    }
  });

  return created.id;
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
        comment
      }
    });

    await tx.auditLog.create({
      data: {
        userId: approverId,
        savingCardId,
        action: "approval.recorded",
        detail: `${phase} approval ${approved ? "approved" : "rejected"}`
      }
    });

    return record;
  });
}

export async function createPhaseChangeRequest(
  savingCardId: string,
  requestedPhase: Phase,
  requestedById: string,
  comment?: string,
  cancellationReason?: string
) {
  return prisma.$transaction(async (tx) => {
    const card = await tx.savingCard.findUnique({
      where: { id: savingCardId },
      include: {
        phaseChangeRequests: {
          where: { approvalStatus: ApprovalStatus.PENDING },
          include: { approvals: true }
        }
      }
    });

    if (!card) throw new Error("Saving card not found.");
    if (card.phase === requestedPhase) throw new Error("Saving card is already in that phase.");
    if (requestedPhase === "CANCELLED" && !cancellationReason?.trim()) {
      throw new Error("Cancellation reason is required.");
    }
    if (card.phaseChangeRequests.length) {
      throw new Error("There is already a pending phase change request for this saving card.");
    }

    const requiredRoles = requestedPhase === "CANCELLED" ? [] : requiredRolesForPhase(requestedPhase);
    const approvers = requiredRoles.length
      ? await tx.user.findMany({ where: { role: { in: requiredRoles } }, orderBy: { name: "asc" } })
      : [];

    if (requiredRoles.length && !approvers.length) {
      throw new Error("No approvers are configured for the requested phase.");
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
            role: approver.role
          }))
        }
      },
      include: {
        requestedBy: true,
        approvals: { include: { approver: true } }
      }
    });

    if (approvers.length) {
      await tx.notification.createMany({
        data: approvers.map((approver) => ({
          userId: approver.id,
          title: `Phase change approval required`,
          message: `${card.title} requests movement from ${card.phase} to ${requestedPhase}.`
        }))
      });
    }

    await tx.auditLog.create({
      data: {
        userId: requestedById,
        savingCardId,
        action: "phase_change.requested",
        detail: `Requested phase change from ${card.phase} to ${requestedPhase}`
      }
    });

    if (!requiredRoles.length) {
      await finalizePhaseChangeRequest(tx, request.id, requestedById);
      return tx.phaseChangeRequest.findUniqueOrThrow({
        where: { id: request.id },
        include: { requestedBy: true, approvals: { include: { approver: true } } }
      });
    }

    return request;
  });
}

export async function approvePhaseChangeRequest(
  requestId: string,
  approverId: string,
  approved: boolean,
  comment?: string
) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.phaseChangeRequest.findUnique({
      where: { id: requestId },
      include: {
        savingCard: true,
        requestedBy: true,
        approvals: { include: { approver: true } }
      }
    });

    if (!request) throw new Error("Phase change request not found.");
    if (request.approvalStatus !== ApprovalStatus.PENDING) {
      throw new Error("This phase change request is already closed.");
    }

    const approval = request.approvals.find((item) => item.approverId === approverId);
    if (!approval) throw new Error("You are not assigned to approve this request.");
    if (approval.status !== ApprovalStatus.PENDING) throw new Error("You already processed this request.");

    await tx.phaseChangeRequestApproval.update({
      where: { id: approval.id },
      data: {
        status: approved ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED,
        comment: comment?.trim() || null,
        decidedAt: new Date()
      }
    });

    if (!approved) {
      const rejectedRequest = await tx.phaseChangeRequest.update({
        where: { id: requestId },
        data: { approvalStatus: ApprovalStatus.REJECTED }
      });

      await tx.notification.create({
        data: {
          userId: request.requestedById,
          title: "Phase change rejected",
          message: `${request.savingCard.title} phase change to ${request.requestedPhase} was rejected.`
        }
      });

      await tx.auditLog.create({
        data: {
          userId: approverId,
          savingCardId: request.savingCardId,
          action: "phase_change.rejected",
          detail: `Phase change to ${request.requestedPhase} rejected`
        }
      });

      return rejectedRequest;
    }

    const remaining = await tx.phaseChangeRequestApproval.count({
      where: {
        phaseChangeRequestId: requestId,
        status: ApprovalStatus.PENDING
      }
    });

    if (remaining === 0) {
      await tx.phaseChangeRequest.update({
        where: { id: requestId },
        data: { approvalStatus: ApprovalStatus.APPROVED }
      });

      await finalizePhaseChangeRequest(tx, requestId, approverId);
    } else {
      await tx.auditLog.create({
        data: {
          userId: approverId,
          savingCardId: request.savingCardId,
          action: "phase_change.approved_partial",
          detail: `Partial approval recorded for ${request.requestedPhase}`
        }
      });
    }

    return tx.phaseChangeRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: {
        savingCard: true,
        requestedBy: true,
        approvals: { include: { approver: true } }
      }
    });
  });
}

async function finalizePhaseChangeRequest(
  tx: Prisma.TransactionClient,
  requestId: string,
  actorId: string
) {
  const request = await tx.phaseChangeRequest.findUnique({
    where: { id: requestId },
    include: { savingCard: true }
  });

  if (!request) throw new Error("Phase change request not found.");

  await tx.savingCard.update({
    where: { id: request.savingCardId },
    data: {
      phase: request.requestedPhase,
      cancellationReason:
        request.requestedPhase === "CANCELLED"
          ? request.cancellationReason ?? request.savingCard.cancellationReason
          : request.savingCard.cancellationReason
    }
  });

  await tx.phaseHistory.create({
    data: {
      savingCardId: request.savingCardId,
      fromPhase: request.currentPhase,
      toPhase: request.requestedPhase,
      changedById: actorId
    }
  });

  await tx.notification.create({
    data: {
      userId: request.requestedById,
      title: "Phase change completed",
      message: `${request.savingCard.title} moved to ${request.requestedPhase}.`
    }
  });

  await tx.auditLog.create({
    data: {
      userId: actorId,
      savingCardId: request.savingCardId,
      action: "phase_change.completed",
      detail: `Phase changed from ${request.currentPhase} to ${request.requestedPhase}`
    }
  });
}

export async function getPendingApprovals(userId: string) {
  return prisma.phaseChangeRequestApproval.findMany({
    where: {
      approverId: userId,
      status: ApprovalStatus.PENDING
    },
    include: {
      phaseChangeRequest: {
        include: {
          savingCard: true,
          requestedBy: true,
          approvals: { include: { approver: true } }
        }
      },
      approver: true
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function setFinanceLock(savingCardId: string, actorId: string, locked: boolean) {
  return prisma.$transaction(async (tx) => {
    const card = await tx.savingCard.update({
      where: { id: savingCardId },
      data: { financeLocked: locked }
    });

    await tx.auditLog.create({
      data: {
        userId: actorId,
        savingCardId,
        action: locked ? "finance.locked" : "finance.unlocked",
        detail: locked ? "Finance lock enabled" : "Finance lock removed"
      }
    });

    return card;
  });
}

async function createWorkflowNotifications(
  tx: Prisma.TransactionClient,
  savingCardId: string,
  phase: Phase
) {
  const roles = requiredRolesForPhase(phase);
  if (!roles.length) return;

  const users = await tx.user.findMany({
    where: { role: { in: roles } }
  });

  if (!users.length) return;

  await tx.notification.createMany({
    data: users.map((user) => ({
      userId: user.id,
      title: `Approval required for ${phase}`,
      message: `Saving card ${savingCardId} requires your approval.`
    }))
  });
}

export async function getDashboardData() {
  const [cards, targets] = await Promise.all([
    prisma.savingCard.findMany({
      include: {
        category: true,
        buyer: true,
        businessUnit: true
      }
    }),
    prisma.annualTarget.findMany({ include: { category: true } })
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
        year: "numeric"
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
      actual: current
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
    savingsVsTarget
  };
}

type CommandCenterFilters = {
  categoryId?: string;
  businessUnitId?: string;
  buyerId?: string;
  plantId?: string;
  supplierId?: string;
};

function buildCommandCenterWhere(filters?: CommandCenterFilters): Prisma.SavingCardWhereInput {
  return {
    categoryId: filters?.categoryId || undefined,
    businessUnitId: filters?.businessUnitId || undefined,
    buyerId: filters?.buyerId || undefined,
    plantId: filters?.plantId || undefined,
    supplierId: filters?.supplierId || undefined
  };
}

export async function getCommandCenterFilterOptions() {
  const [categories, businessUnits, buyers, plants, suppliers] = await Promise.all([
    prisma.category.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.businessUnit.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.plant.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
  ]);

  return { categories, businessUnits, buyers, plants, suppliers };
}

export async function getCommandCenterData(filters?: CommandCenterFilters) {
  const where = buildCommandCenterWhere(filters);

  const [
    phaseSavings,
    forecastCards,
    supplierSavings,
    qualificationGroups,
    pendingApprovals,
    activeProjects,
    benchmarkCards,
    riskCards
  ] = await Promise.all([
    prisma.savingCard.groupBy({
      by: ["phase"],
      where,
      _sum: { calculatedSavings: true }
    }),
    prisma.savingCard.findMany({
      where,
      select: {
        impactStartDate: true,
        calculatedSavings: true,
        frequency: true,
        phase: true
      }
    }),
    prisma.savingCard.groupBy({
      by: ["supplierId"],
      where: {
        ...where,
        phase: { not: Phase.CANCELLED }
      },
      _sum: { calculatedSavings: true },
      orderBy: {
        _sum: {
          calculatedSavings: "desc"
        }
      },
      take: 10
    }),
    prisma.savingCard.groupBy({
      by: ["qualificationStatus"],
      where,
      _sum: { calculatedSavings: true }
    }),
    prisma.phaseChangeRequest.count({
      where: {
        approvalStatus: ApprovalStatus.PENDING,
        savingCard: where
      }
    }),
    prisma.savingCard.count({
      where: {
        ...where,
        phase: { not: Phase.CANCELLED }
      }
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
        calculatedSavings: true
      }
    }),
    prisma.savingCard.findMany({
      where,
      select: {
        calculatedSavings: true,
        alternativeSuppliers: {
          where: { isSelected: true },
          select: { riskLevel: true }
        },
        alternativeMaterials: {
          where: { isSelected: true },
          select: { riskLevel: true }
        }
      }
    })
  ]);

  const phaseMap = new Map(phaseSavings.map((item) => [item.phase, item._sum.calculatedSavings ?? 0]));
  const pipelineByPhase = ["IDEA", "VALIDATED", "REALISED", "ACHIEVED", "CANCELLED"].map((phase) => ({
    phase,
    label: phaseLabels[phase as Phase],
    savings: phaseMap.get(phase as Phase) ?? 0
  }));

  const forecastCurve = Object.values(
    forecastCards.reduce<Record<string, { month: string; savings: number; forecast: number; sortValue: number }>>((acc, card) => {
      const date = new Date(card.impactStartDate);
      const monthKey = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(date);
      acc[monthKey] ??= { month: monthKey, savings: 0, forecast: 0, sortValue: new Date(date.getFullYear(), date.getMonth(), 1).getTime() };
      acc[monthKey].savings += card.calculatedSavings;
      acc[monthKey].forecast += card.calculatedSavings * getForecastMultiplier(card.frequency);
      return acc;
    }, {})
  ).sort((a, b) => a.sortValue - b.sortValue);

  const supplierIds = supplierSavings.map((item) => item.supplierId);
  const suppliers = supplierIds.length
    ? await prisma.supplier.findMany({
        where: { id: { in: supplierIds } },
        select: { id: true, name: true }
      })
    : [];
  const supplierNameMap = new Map(suppliers.map((item) => [item.id, item.name]));
  const topSuppliers = supplierSavings.map((item) => ({
    supplier: supplierNameMap.get(item.supplierId) ?? "Unknown supplier",
    savings: item._sum.calculatedSavings ?? 0
  }));

  const benchmarkOpportunities = benchmarkCards
    .map((card) => {
      const variancePercent = card.baselinePrice ? ((card.baselinePrice - card.newPrice) / card.baselinePrice) * 100 : 0;
      return {
        savingCardId: card.id,
        material: card.material.name,
        supplier: card.supplier.name,
        plant: card.plant.name,
        currentPrice: card.baselinePrice,
        benchmarkPrice: card.newPrice,
        variancePercent,
        potentialSaving: Math.max(card.calculatedSavings, 0)
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
        qualificationGroups.find((item) => (item.qualificationStatus ?? "Unspecified") === status)?._sum.calculatedSavings ?? 0
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
      pendingApprovals
    },
    pipelineByPhase,
    forecastCurve: forecastCurve.map(({ sortValue, ...item }) => item),
    topSuppliers,
    benchmarkOpportunities,
    savingsByRiskLevel,
    savingsByQualificationStatus
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
    where: { savingCardId: cardId, phase }
  });

  const requiredRoles = requiredRolesForPhase(phase);
  return requiredRoles.map((role) => ({
    role,
    approved: approvals.some((approval) => approval.approved && approval.approverId && approval)
  }));
}

export async function getNotificationsForUser(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 10
  });
}

export async function importSavingCards(rows: Record<string, unknown>[], actorId: string) {
  for (const row of rows) {
    await createSavingCard(row, actorId);
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
    FinanceLocked: card.financeLocked
  }));
}
