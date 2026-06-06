import { Phase, Prisma } from "@prisma/client";
import { auditEventTypes, writeAuditEvent } from "@/lib/audit";
import { calculateSavings } from "@/lib/calculations";
import { prisma } from "@/lib/prisma";
import {
  buildTenantOwnedRelationWhere,
  resolveTenantScope,
} from "@/lib/tenant-scope";
import type { TenantContextSource } from "@/lib/types";
import {
  alternativeMaterialSchema,
  alternativeSupplierSchema,
} from "@/lib/validation";
import {
  canFinanceLockWorkflowPhase,
  INITIAL_WORKFLOW_PHASE,
  isInitialWorkflowPhase,
} from "@/lib/workflow";
import { WorkflowError } from "@/lib/workflow/errors";
import {
  buildSavingCardPayload,
  getLatestFxRate,
  getScopedAlternativeMaterial,
  getScopedAlternativeSupplier,
  getScopedSavingCard,
  normalizeName,
  normalizeOptionalName,
  resolveMasterData,
  resolveOrCreateMaterial,
  resolveOrCreateSupplier,
  savingCardDetailInclude,
} from "@/lib/saving-cards/shared";
import { invalidatePortfolioSurfaceCaches } from "@/lib/workspace/portfolio-surface-cache";

function buildSavingCardPath(savingCardId: string) {
  return `/saving-cards/${savingCardId}`;
}

const SAVING_CARD_CREATE_TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 30_000,
} as const;

const SAVING_CARD_IMPORT_TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 120_000,
} as const;

function assertInitialSavingCardPhase(phase: Phase) {
  if (!isInitialWorkflowPhase(phase)) {
    throw new WorkflowError(
      `New saving cards must start in ${INITIAL_WORKFLOW_PHASE} phase.`,
      409
    );
  }
}

async function createSavingCardRecord(
  tx: Prisma.TransactionClient,
  payload: ReturnType<typeof buildSavingCardPayload>,
  actorId: string,
  organizationId: string
) {
  const resolved = await resolveMasterData(tx, actorId, organizationId, payload);

  return tx.savingCard.create({
    data: {
      organizationId,
      title: payload.title,
      description: payload.description,
      savingType: payload.savingType,
      impactType: payload.impactType,
      impactRecurrence: payload.impactRecurrence,
      budgetImpact: payload.budgetImpact,
      phase: INITIAL_WORKFLOW_PHASE,
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
      implementationComplexity: normalizeOptionalName(
        payload.implementationComplexity || undefined
      ),
      qualificationStatus: normalizeOptionalName(
        payload.qualificationStatus || undefined
      ),
      startDate: payload.startDate,
      endDate: payload.endDate,
      impactStartDate: payload.impactStartDate,
      impactEndDate: payload.impactEndDate,
      financeLocked: false,
      cancellationReason: null,
      stakeholders: {
        create: (payload.stakeholderIds ?? []).map((userId) => ({
          userId,
        })),
      },
      phaseHistory: {
        create: {
          fromPhase: null,
          toPhase: INITIAL_WORKFLOW_PHASE,
          changedById: actorId,
        },
      },
      auditLogs: {
        create: {
          userId: actorId,
          action: "saving_card.created",
          detail: `Saving card created in ${INITIAL_WORKFLOW_PHASE} phase`,
        },
      },
    },
    include: savingCardDetailInclude,
  });
}

export async function createSavingCard(
  input: Prisma.JsonObject | Record<string, unknown>,
  actorId: string,
  context: TenantContextSource,
  options?: {
    skipViewInvalidation?: boolean;
  }
) {
  const { organizationId } = resolveTenantScope(context);
  const payload = buildSavingCardPayload(input);

  assertInitialSavingCardPhase(payload.phase);

  const card = await prisma.$transaction(
    (tx) => createSavingCardRecord(tx, payload, actorId, organizationId),
    SAVING_CARD_CREATE_TRANSACTION_OPTIONS
  );

  if (!options?.skipViewInvalidation) {
    invalidatePortfolioSurfaceCaches(organizationId);
  }

  return card;
}

export async function updateSavingCard(
  id: string,
  input: Prisma.JsonObject | Record<string, unknown>,
  actorId: string,
  context: TenantContextSource
) {
  const { organizationId } = resolveTenantScope(context);
  const payload = buildSavingCardPayload(input);

  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.savingCard.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!existing) {
      throw new Error("Saving card not found.");
    }

    if (existing.phase !== payload.phase) {
      throw new WorkflowError(
        "Direct phase updates are disabled. Use /api/phase-change-request to request workflow approval.",
        409
      );
    }

    if (
      existing.financeLocked &&
      (
        existing.savingType !== payload.savingType ||
        existing.impactType !== payload.impactType ||
        existing.impactRecurrence !== payload.impactRecurrence ||
        existing.budgetImpact !== payload.budgetImpact
      )
    ) {
      throw new WorkflowError(
        "Finance-locked savings cannot change savings classification. Remove the finance lock before changing savings type, impact type, recurrence, or budget impact.",
        409
      );
    }

    const resolved = await resolveMasterData(tx, actorId, organizationId, payload);

    const nextCard = await tx.savingCard.update({
      where: { id },
      data: {
        title: payload.title,
        description: payload.description,
        savingType: existing.financeLocked ? existing.savingType : payload.savingType,
        impactType: existing.financeLocked ? existing.impactType : payload.impactType,
        impactRecurrence: existing.financeLocked
          ? existing.impactRecurrence
          : payload.impactRecurrence,
        budgetImpact: existing.financeLocked
          ? existing.budgetImpact
          : payload.budgetImpact,
        phase: existing.phase,
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
        baselinePrice: existing.financeLocked
          ? existing.baselinePrice
          : payload.baselinePrice,
        newPrice: existing.financeLocked ? existing.newPrice : payload.newPrice,
        annualVolume: existing.financeLocked
          ? existing.annualVolume
          : payload.annualVolume,
        currency: existing.financeLocked ? existing.currency : payload.currency,
        fxRate: existing.financeLocked ? existing.fxRate : payload.fxRate,
        calculatedSavings: existing.financeLocked
          ? existing.calculatedSavings
          : payload.calculatedSavings,
        calculatedSavingsUSD: existing.financeLocked
          ? existing.calculatedSavingsUSD
          : payload.calculatedSavingsUSD,
        frequency: payload.frequency,
        savingDriver: normalizeOptionalName(payload.savingDriver || undefined),
        implementationComplexity: normalizeOptionalName(
          payload.implementationComplexity || undefined
        ),
        qualificationStatus: normalizeOptionalName(
          payload.qualificationStatus || undefined
        ),
        startDate: payload.startDate,
        endDate: payload.endDate,
        impactStartDate: existing.financeLocked
          ? existing.impactStartDate
          : payload.impactStartDate,
        impactEndDate: existing.financeLocked
          ? existing.impactEndDate
          : payload.impactEndDate,
        cancellationReason: existing.cancellationReason,
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

    await tx.auditLog.create({
      data: {
        userId: actorId,
        savingCardId: id,
        action: "saving_card.updated",
        detail: `Saving card updated. Current phase: ${existing.phase}`,
      },
    });

    return nextCard;
  });

  invalidatePortfolioSurfaceCaches(organizationId);

  return updated;
}

export async function createAlternativeSupplier(
  savingCardId: string,
  input: Prisma.JsonObject | Record<string, unknown>,
  actorId: string,
  context: TenantContextSource
) {
  const { organizationId } = resolveTenantScope(context);
  const payload = alternativeSupplierSchema.parse(input);

  const alternative = await prisma.$transaction(async (tx) => {
    await getScopedSavingCard(tx, savingCardId, organizationId);

    const supplierId = payload.supplier
      ? (await resolveOrCreateSupplier(tx, organizationId, payload.supplier)).id
      : null;

    if (payload.isSelected) {
      await tx.savingCardAlternativeSupplier.updateMany({
        where: { savingCardId },
        data: { isSelected: false },
      });
    }

    const nextAlternative = await tx.savingCardAlternativeSupplier.create({
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
      await applySelectedAlternativeSupplier(
        tx,
        savingCardId,
        nextAlternative.id,
        actorId,
        organizationId
      );
    }

    return nextAlternative;
  });

  if (payload.isSelected) {
    invalidatePortfolioSurfaceCaches(organizationId);
  }

  return alternative;
}

export async function updateAlternativeSupplier(
  alternativeId: string,
  input: Prisma.JsonObject | Record<string, unknown>,
  actorId: string,
  context: TenantContextSource,
  expectedSavingCardId?: string
) {
  const { organizationId } = resolveTenantScope(context);
  const payload = alternativeSupplierSchema.parse(input);

  const alternative = await prisma.$transaction(async (tx) => {
    const existing = await getScopedAlternativeSupplier(
      tx,
      alternativeId,
      organizationId
    );

    if (expectedSavingCardId && existing.savingCardId !== expectedSavingCardId) {
      throw new Error("Alternative supplier not found.");
    }

    const supplierId = payload.supplier
      ? (await resolveOrCreateSupplier(tx, organizationId, payload.supplier)).id
      : null;

    if (payload.isSelected) {
      await tx.savingCardAlternativeSupplier.updateMany({
        where: { savingCardId: existing.savingCardId },
        data: { isSelected: false },
      });
    }

    const nextAlternative = await tx.savingCardAlternativeSupplier.update({
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
      await applySelectedAlternativeSupplier(
        tx,
        existing.savingCardId,
        nextAlternative.id,
        actorId,
        organizationId
      );
    }

    return nextAlternative;
  });

  if (payload.isSelected) {
    invalidatePortfolioSurfaceCaches(organizationId);
  }

  return alternative;
}

export async function deleteAlternativeSupplier(
  alternativeId: string,
  context: TenantContextSource,
  expectedSavingCardId?: string
) {
  const { organizationId } = resolveTenantScope(context);

  return prisma.$transaction(async (tx) => {
    const existing = await getScopedAlternativeSupplier(
      tx,
      alternativeId,
      organizationId
    );

    if (expectedSavingCardId && existing.savingCardId !== expectedSavingCardId) {
      throw new Error("Alternative supplier not found.");
    }

    return tx.savingCardAlternativeSupplier.delete({
      where: { id: existing.id },
    });
  });
}

export async function createAlternativeMaterial(
  savingCardId: string,
  input: Prisma.JsonObject | Record<string, unknown>,
  actorId: string,
  context: TenantContextSource
) {
  const { organizationId } = resolveTenantScope(context);
  const payload = alternativeMaterialSchema.parse(input);

  const alternative = await prisma.$transaction(async (tx) => {
    await getScopedSavingCard(tx, savingCardId, organizationId);

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

    const nextAlternative = await tx.savingCardAlternativeMaterial.create({
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
      await applySelectedAlternativeMaterial(
        tx,
        savingCardId,
        nextAlternative.id,
        actorId,
        organizationId
      );
    }

    return nextAlternative;
  });

  if (payload.isSelected) {
    invalidatePortfolioSurfaceCaches(organizationId);
  }

  return alternative;
}

export async function updateAlternativeMaterial(
  alternativeId: string,
  input: Prisma.JsonObject | Record<string, unknown>,
  actorId: string,
  context: TenantContextSource,
  expectedSavingCardId?: string
) {
  const { organizationId } = resolveTenantScope(context);
  const payload = alternativeMaterialSchema.parse(input);

  const alternative = await prisma.$transaction(async (tx) => {
    const existing = await getScopedAlternativeMaterial(
      tx,
      alternativeId,
      organizationId
    );

    if (expectedSavingCardId && existing.savingCardId !== expectedSavingCardId) {
      throw new Error("Alternative material not found.");
    }

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

    const nextAlternative = await tx.savingCardAlternativeMaterial.update({
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
      await applySelectedAlternativeMaterial(
        tx,
        existing.savingCardId,
        nextAlternative.id,
        actorId,
        organizationId
      );
    }

    return nextAlternative;
  });

  if (payload.isSelected) {
    invalidatePortfolioSurfaceCaches(organizationId);
  }

  return alternative;
}

export async function deleteAlternativeMaterial(
  alternativeId: string,
  context: TenantContextSource,
  expectedSavingCardId?: string
) {
  const { organizationId } = resolveTenantScope(context);

  return prisma.$transaction(async (tx) => {
    const existing = await getScopedAlternativeMaterial(
      tx,
      alternativeId,
      organizationId
    );

    if (expectedSavingCardId && existing.savingCardId !== expectedSavingCardId) {
      throw new Error("Alternative material not found.");
    }

    return tx.savingCardAlternativeMaterial.delete({
      where: { id: existing.id },
    });
  });
}

async function applySelectedAlternativeSupplier(
  tx: Prisma.TransactionClient,
  savingCardId: string,
  alternativeId: string,
  actorId: string,
  organizationId: string
) {
  const [card, alternative] = await Promise.all([
    getScopedSavingCard(tx, savingCardId, organizationId),
    tx.savingCardAlternativeSupplier.findFirst({
      where: {
        id: alternativeId,
        ...buildTenantOwnedRelationWhere("savingCard", organizationId, {
          id: savingCardId,
        }),
      },
    }),
  ]);

  if (!card || !alternative) {
    throw new Error("Unable to apply selected supplier scenario.");
  }

  if (card.financeLocked) {
    throw new WorkflowError(
      "Finance-locked savings cannot apply alternative supplier scenarios. Remove the finance lock before changing validated financial assumptions.",
      409
    );
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
      alternativeSupplierManualName: alternative.supplierId
        ? null
        : alternative.supplierNameManual,
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
  actorId: string,
  organizationId: string
) {
  const [card, alternative] = await Promise.all([
    getScopedSavingCard(tx, savingCardId, organizationId),
    tx.savingCardAlternativeMaterial.findFirst({
      where: {
        id: alternativeId,
        ...buildTenantOwnedRelationWhere("savingCard", organizationId, {
          id: savingCardId,
        }),
      },
    }),
  ]);

  if (!card || !alternative) {
    throw new Error("Unable to apply selected material scenario.");
  }

  if (card.financeLocked) {
    throw new WorkflowError(
      "Finance-locked savings cannot apply alternative material scenarios. Remove the finance lock before changing validated financial assumptions.",
      409
    );
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
      alternativeMaterialManualName: alternative.materialId
        ? null
        : alternative.materialNameManual,
      alternativeSupplierId: alternative.supplierId ?? card.alternativeSupplierId,
      alternativeSupplierManualName: alternative.supplierId
        ? null
        : alternative.supplierNameManual,
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

export async function setFinanceLock(
  savingCardId: string,
  actorId: string,
  locked: boolean,
  context: TenantContextSource
) {
  const { organizationId } = resolveTenantScope(context);

  const updatedCard = await prisma.$transaction(async (tx) => {
    const card = await tx.savingCard.findFirst({
      where: {
        id: savingCardId,
        organizationId,
      },
      include: {
        stakeholders: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!card) {
      throw new Error("Saving card not found.");
    }

    if (locked && !canFinanceLockWorkflowPhase(card.phase)) {
      throw new WorkflowError(
        "Finance lock can only be enabled for validated savings.",
        409
      );
    }

    const nextCard = await tx.savingCard.update({
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

    const recipientIds = [...new Set(card.stakeholders.map((stakeholder) => stakeholder.userId))]
      .filter((userId) => userId !== actorId);

    if (recipientIds.length) {
      await tx.notification.createMany({
        data: recipientIds.map((userId) => ({
          organizationId,
          userId,
          title: locked ? "Finance lock applied" : "Finance lock removed",
          message: locked
            ? `${card.title} was finance locked.`
            : `${card.title} finance lock was removed.`,
          href: buildSavingCardPath(savingCardId),
        })),
      });
    }

    return nextCard;
  });

  invalidatePortfolioSurfaceCaches(organizationId, {
    dashboard: false,
  });

  return updatedCard;
}

export async function importSavingCards(
  rows: Record<string, unknown>[],
  actorId: string,
  context: TenantContextSource
) {
  const { organizationId } = resolveTenantScope(context);
  const payloads = rows.map((row) => buildSavingCardPayload(row));

  payloads.forEach((payload) => assertInitialSavingCardPhase(payload.phase));

  await prisma.$transaction(
    async (tx) => {
      for (const payload of payloads) {
        await createSavingCardRecord(tx, payload, actorId, organizationId);
      }

      await writeAuditEvent(tx, {
        organizationId,
        actorUserId: actorId,
        eventType: auditEventTypes.SAVING_CARDS_IMPORTED,
        detail: `${payloads.length} saving card${payloads.length === 1 ? "" : "s"} imported in one transaction.`,
        payload: {
          importedCount: payloads.length,
          phase: INITIAL_WORKFLOW_PHASE,
          atomic: true,
        },
      });
    },
    SAVING_CARD_IMPORT_TRANSACTION_OPTIONS
  );

  invalidatePortfolioSurfaceCaches(organizationId);
}
