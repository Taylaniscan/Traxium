import { Currency, Phase, Prisma, SavingsImpactType } from "@prisma/client";
import { auditEventTypes, writeAuditEvent } from "@/lib/audit";
import { calculateSavings, calculatePeriodizedSavings } from "@/lib/calculations";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils/decimal";
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
  DEFAULT_FISCAL_YEAR_START_MONTH,
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
import { unitConversionFactor, validateUnit } from "@/lib/units";

function buildSavingCardPath(savingCardId: string) {
  return `/saving-cards/${savingCardId}`;
}

function resolveQuoteUnit(input: string | undefined, fallback: string | null): string | null {
  const value = input ?? fallback ?? null;
  if (value === null) return null;
  const result = validateUnit(value);
  if (!result.valid) throw new WorkflowError(result.error, 422);
  return result.code;
}

function quotePriceInCardUnit(quotedPrice: number, quotedUnit: string | null, cardUnit: string) {
  if (!quotedUnit) throw new WorkflowError("The quote unit was not recorded. Select an explicit unit before applying this historical alternative.", 409);
  const factor = unitConversionFactor(quotedUnit, cardUnit);
  if (factor === null || factor <= 0) throw new WorkflowError(`Quote unit ${quotedUnit} is incompatible with card unit ${cardUnit}. Choose a compatible unit before applying the alternative.`, 409);
  return quotedPrice / factor;
}

type WorkspaceFinancialSettings = {
  fiscalYearStartMonth: number;
  defaultCurrency: Currency;
  multiCurrencyEnabled: boolean;
  defaultFxRate: number;
  defaultFxEffectiveDate: Date | null;
};

async function getWorkspaceFinancialSettings(
  organizationId: string
): Promise<WorkspaceFinancialSettings> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      fiscalYearStartMonth: true,
      defaultCurrency: true,
      multiCurrencyEnabled: true,
    },
  });
  let defaultFxRate = 1;
  let defaultFxEffectiveDate: Date | null = null;
  if (organization?.defaultCurrency === Currency.EUR && !organization.multiCurrencyEnabled) {
    const rate = await prisma.fxRate.findFirst({ where: { currency: Currency.EUR, validFrom: { lte: new Date() } }, orderBy: { validFrom: "desc" } });
    defaultFxRate = rate ? toNumber(rate.rateToUSD) : NaN;
    defaultFxEffectiveDate = rate?.validFrom ?? null;
    if (!Number.isFinite(defaultFxRate) || defaultFxRate <= 0) throw new Error("A positive EUR-to-USD FX rate is required to create EUR cards. Ask an admin to configure the rate.");
  }

  return {
    fiscalYearStartMonth:
      organization?.fiscalYearStartMonth ?? DEFAULT_FISCAL_YEAR_START_MONTH,
    defaultCurrency: organization?.defaultCurrency ?? Currency.USD,
    multiCurrencyEnabled: organization?.multiCurrencyEnabled ?? false,
    defaultFxRate,
    defaultFxEffectiveDate,
  };
}

/**
 * In a single-currency workspace the buyer never sees a currency or fx
 * field, so any client-supplied currency/fxRate is ignored: cards are forced to the
 * workspace default currency at a 1.0 rate regardless of payload.
 */
function applyWorkspaceCurrencyMode(
  input: Prisma.JsonObject | Record<string, unknown>,
  settings: WorkspaceFinancialSettings
) {
  if (settings.multiCurrencyEnabled) {
    return input;
  }

  return {
    ...input,
    currency: settings.defaultCurrency,
    fxRate: settings.defaultFxRate,
    fxRateEffectiveDate: settings.defaultFxEffectiveDate?.toISOString() ?? null,
  };
}

/**
 * Recompute the persisted savings figures (annual totals + periodized run-rate /
 * in-year value) when an applied scenario changes the card's new price, currency, or
 * fx rate. Keeps every write path consistent with buildSavingCardPayload.
 */
function computeCardScenarioFinancials(args: {
  baselinePrice: number;
  newPrice: number;
  annualVolume: number;
  fxRate: number;
  currency: Currency;
  impactType: SavingsImpactType;
  referencePrice: number | null;
  impactStartDate: Date;
  impactEndDate: Date;
  fiscalYearStartMonth: number;
}) {
  const totals = calculateSavings({
    baselinePrice: args.baselinePrice,
    newPrice: args.newPrice,
    annualVolume: args.annualVolume,
    fxRate: args.fxRate,
    currency: args.currency,
    impactType: args.impactType,
    referencePrice: args.referencePrice,
  });
  const periodized = calculatePeriodizedSavings({
    baselinePrice: args.baselinePrice,
    newPrice: args.newPrice,
    annualVolume: args.annualVolume,
    fxRate: args.fxRate,
    currency: args.currency,
    impactType: args.impactType,
    referencePrice: args.referencePrice,
    impactStartDate: args.impactStartDate,
    impactEndDate: args.impactEndDate,
    fiscalYear: { startMonth: args.fiscalYearStartMonth },
  });

  return {
    calculatedSavings: totals.localSavings,
    calculatedSavingsUSD: totals.savingsUSD,
    annualizedRunRate: periodized.annualizedRunRate,
    annualizedRunRateUSD: periodized.annualizedRunRateUSD,
    inYearValue: periodized.inYearValue,
    inYearValueUSD: periodized.inYearValueUSD,
  };
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
  organizationId: string,
  fxRateSource: "MANUAL" | "WORKSPACE_RATE"
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
      referencePrice: payload.referencePrice,
      annualVolume: payload.annualVolume,
      volumeUnit: payload.volumeUnit,
      currency: payload.currency,
      fxRate: payload.fxRate,
      fxRateEffectiveDate: payload.currency === Currency.EUR ? payload.fxRateEffectiveDate ?? null : null,
      fxRateSource: payload.currency === Currency.EUR ? fxRateSource : null,
      calculatedSavings: payload.calculatedSavings,
      calculatedSavingsUSD: payload.calculatedSavingsUSD,
      annualizedRunRate: payload.annualizedRunRate,
      annualizedRunRateUSD: payload.annualizedRunRateUSD,
      inYearValue: payload.inYearValue,
      inYearValueUSD: payload.inYearValueUSD,
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
  const settings = await getWorkspaceFinancialSettings(organizationId);
  const payload = buildSavingCardPayload(
    applyWorkspaceCurrencyMode(input, settings),
    { fiscalYearStartMonth: settings.fiscalYearStartMonth }
  );

  assertInitialSavingCardPhase(payload.phase);

  const card = await prisma.$transaction(
    (tx) => createSavingCardRecord(tx, payload, actorId, organizationId, settings.multiCurrencyEnabled ? "MANUAL" : "WORKSPACE_RATE"),
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
  const settings = await getWorkspaceFinancialSettings(organizationId);
  const payload = buildSavingCardPayload(
    applyWorkspaceCurrencyMode(input, settings),
    { fiscalYearStartMonth: settings.fiscalYearStartMonth }
  );

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
        referencePrice: existing.financeLocked
          ? existing.referencePrice
          : payload.referencePrice,
        annualVolume: existing.financeLocked
          ? existing.annualVolume
          : payload.annualVolume,
        volumeUnit: existing.financeLocked ? existing.volumeUnit : payload.volumeUnit,
        currency: existing.financeLocked ? existing.currency : payload.currency,
        fxRate: existing.financeLocked ? existing.fxRate : payload.fxRate,
        fxRateEffectiveDate: existing.financeLocked ? existing.fxRateEffectiveDate : payload.currency === Currency.EUR ? payload.fxRateEffectiveDate ?? existing.fxRateEffectiveDate : null,
        fxRateSource: existing.financeLocked ? existing.fxRateSource : payload.currency === Currency.EUR ? settings.multiCurrencyEnabled ? "MANUAL" : "WORKSPACE_RATE" : null,
        calculatedSavings: existing.financeLocked
          ? existing.calculatedSavings
          : payload.calculatedSavings,
        calculatedSavingsUSD: existing.financeLocked
          ? existing.calculatedSavingsUSD
          : payload.calculatedSavingsUSD,
        annualizedRunRate: existing.financeLocked
          ? existing.annualizedRunRate
          : payload.annualizedRunRate,
        annualizedRunRateUSD: existing.financeLocked
          ? existing.annualizedRunRateUSD
          : payload.annualizedRunRateUSD,
        inYearValue: existing.financeLocked
          ? existing.inYearValue
          : payload.inYearValue,
        inYearValueUSD: existing.financeLocked
          ? existing.inYearValueUSD
          : payload.inYearValueUSD,
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
    const card = await getScopedSavingCard(tx, savingCardId, organizationId);

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
        quotedUnit: resolveQuoteUnit(payload.quotedUnit, card.volumeUnit),
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
        quotedUnit: resolveQuoteUnit(payload.quotedUnit, existing.quotedUnit),
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
    const card = await getScopedSavingCard(tx, savingCardId, organizationId);

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
        quotedUnit: resolveQuoteUnit(payload.quotedUnit, card.volumeUnit),
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
        quotedUnit: resolveQuoteUnit(payload.quotedUnit, existing.quotedUnit),
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

  if (alternative.currency !== card.currency) throw new WorkflowError(`Quote currency ${alternative.currency} differs from card currency ${card.currency}. Convert the quote explicitly before applying it.`, 409);
  const scenarioPrice = quotePriceInCardUnit(toNumber(alternative.quotedPrice), alternative.quotedUnit, card.volumeUnit);

  const settings = await getWorkspaceFinancialSettings(organizationId);
  const scenarioCurrency = card.currency;
  const fxRate = toNumber(card.fxRate);
  if (!Number.isFinite(fxRate) || fxRate <= 0) throw new WorkflowError("The card FX rate is invalid. Review the financial assumptions before applying this quote.", 409);
  const financials = computeCardScenarioFinancials({
    baselinePrice: toNumber(card.baselinePrice),
    newPrice: scenarioPrice,
    annualVolume: toNumber(card.annualVolume),
    fxRate,
    currency: scenarioCurrency,
    impactType: card.impactType,
    referencePrice:
      card.referencePrice === null ? null : toNumber(card.referencePrice),
    impactStartDate: card.impactStartDate,
    impactEndDate: card.impactEndDate,
    fiscalYearStartMonth: settings.fiscalYearStartMonth,
  });

  await tx.savingCard.update({
    where: { id: savingCardId },
    data: {
      supplierId: alternative.supplierId ?? card.supplierId,
      alternativeSupplierId: alternative.supplierId ?? card.alternativeSupplierId,
      alternativeSupplierManualName: alternative.supplierId
        ? null
        : alternative.supplierNameManual,
      newPrice: scenarioPrice,
      currency: scenarioCurrency,
      fxRate,
      ...financials,
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

  if (alternative.currency !== card.currency) throw new WorkflowError(`Quote currency ${alternative.currency} differs from card currency ${card.currency}. Convert the quote explicitly before applying it.`, 409);
  const scenarioPrice = quotePriceInCardUnit(toNumber(alternative.quotedPrice), alternative.quotedUnit, card.volumeUnit);

  const settings = await getWorkspaceFinancialSettings(organizationId);
  const scenarioCurrency = card.currency;
  const fxRate = toNumber(card.fxRate);
  if (!Number.isFinite(fxRate) || fxRate <= 0) throw new WorkflowError("The card FX rate is invalid. Review the financial assumptions before applying this quote.", 409);
  const financials = computeCardScenarioFinancials({
    baselinePrice: toNumber(card.baselinePrice),
    newPrice: scenarioPrice,
    annualVolume: toNumber(card.annualVolume),
    fxRate,
    currency: scenarioCurrency,
    impactType: card.impactType,
    referencePrice:
      card.referencePrice === null ? null : toNumber(card.referencePrice),
    impactStartDate: card.impactStartDate,
    impactEndDate: card.impactEndDate,
    fiscalYearStartMonth: settings.fiscalYearStartMonth,
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
      newPrice: scenarioPrice,
      currency: scenarioCurrency,
      fxRate,
      ...financials,
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
  const settings = await getWorkspaceFinancialSettings(organizationId);
  const payloads = rows.map((row) =>
    buildSavingCardPayload(applyWorkspaceCurrencyMode(row, settings), {
      fiscalYearStartMonth: settings.fiscalYearStartMonth,
    })
  );

  payloads.forEach((payload) => assertInitialSavingCardPhase(payload.phase));

  await prisma.$transaction(
    async (tx) => {
      for (const payload of payloads) {
        await createSavingCardRecord(tx, payload, actorId, organizationId, settings.multiCurrencyEnabled ? "MANUAL" : "WORKSPACE_RATE");
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
