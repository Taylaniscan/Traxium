import { ForecastSource } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildTenantOwnedRelationWhere,
  buildTenantScopeWhere,
} from "@/lib/tenant-scope";
import type {
  TenantContextSource,
  VolumeImportResult,
  VolumeTimelineResult,
  VolumeTimelineRow,
} from "@/lib/types";

export function normalizePeriod(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function periodKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function periodDisplay(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export function isFuture(period: Date): boolean {
  return normalizePeriod(period).getTime() >= getCurrentMonthStartUtc().getTime();
}

export function parsePeriodInput(value: string): Date {
  const normalized = value.trim();
  const match = normalized.match(/^(\d{4})-(\d{2})$/);

  if (!match) {
    throw new Error("Period must use YYYY-MM format.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Period must use a valid YYYY-MM value.");
  }

  return new Date(Date.UTC(year, month - 1, 1));
}

export type ForecastUpsertInput = {
  savingCardId: string;
  period: Date;
  forecastQty: number;
  unit: string;
  source?: ForecastSource;
  notes?: string | null;
  createdById: string;
  context: TenantContextSource;
};

export type ActualUpsertInput = {
  savingCardId: string;
  period: Date;
  actualQty: number;
  unit: string;
  source?: ForecastSource;
  invoiceRef?: string | null;
  confirmedById: string;
  context: TenantContextSource;
};

type CsvHeaderMap = {
  periodIndex: number;
  forecastIndex: number | null;
  actualIndex: number | null;
  unitIndex: number | null;
};

type TimelineAccumulator = {
  periodDate: Date;
  forecastQty: number;
  actualQty: number;
  unit: string;
  forecastSource: ForecastSource | null;
  actualSource: ForecastSource | null;
};

const PERIOD_ALIASES = new Set(["period", "month", "date", "ay", "donem"]);
const FORECAST_ALIASES = new Set(["forecast", "forecast_qty", "tahmin"]);
const ACTUAL_ALIASES = new Set(["actual", "actual_qty", "gerceklesen"]);
const UNIT_ALIASES = new Set(["unit", "uom", "birim"]);

const scopedVolumeCardSelect = {
  id: true,
  organizationId: true,
  materialId: true,
  supplierId: true,
  volumeUnit: true,
  baselinePrice: true,
  newPrice: true,
} satisfies Prisma.SavingCardSelect;

type ScopedVolumeCard = Prisma.SavingCardGetPayload<{
  select: typeof scopedVolumeCardSelect;
}>;

async function getScopedVolumeCard(
  savingCardId: string,
  context: TenantContextSource
): Promise<ScopedVolumeCard> {
  const card = await prisma.savingCard.findFirst({
    where: buildTenantScopeWhere(context, { id: savingCardId }),
    select: scopedVolumeCardSelect,
  });

  if (!card) {
    throw new Error("Saving card not found.");
  }

  return card;
}

async function upsertForecastForCard(
  card: ScopedVolumeCard,
  input: Omit<ForecastUpsertInput, "context">
) {
  const period = normalizePeriod(input.period);

  return prisma.materialConsumptionForecast.upsert({
    where: {
      savingCardId_materialId_period: {
        savingCardId: card.id,
        materialId: card.materialId,
        period,
      },
    },
    update: {
      supplierId: card.supplierId ?? null,
      forecastQty: input.forecastQty,
      unit: input.unit,
      source: input.source ?? ForecastSource.MANUAL_ENTRY,
      notes: normalizeNullableText(input.notes),
      createdById: input.createdById,
    },
    create: {
      savingCardId: card.id,
      materialId: card.materialId,
      supplierId: card.supplierId ?? null,
      period,
      forecastQty: input.forecastQty,
      unit: input.unit,
      source: input.source ?? ForecastSource.MANUAL_ENTRY,
      notes: normalizeNullableText(input.notes),
      createdById: input.createdById,
    },
  });
}

async function upsertActualForCard(
  card: ScopedVolumeCard,
  input: Omit<ActualUpsertInput, "context">
) {
  const period = normalizePeriod(input.period);

  if (period.getTime() >= getCurrentMonthStartUtc().getTime()) {
    throw new Error("Actuals can only be entered for past months.");
  }

  return prisma.materialConsumptionActual.upsert({
    where: {
      savingCardId_materialId_period: {
        savingCardId: card.id,
        materialId: card.materialId,
        period,
      },
    },
    update: {
      supplierId: card.supplierId ?? null,
      actualQty: input.actualQty,
      unit: input.unit,
      source: input.source ?? ForecastSource.MANUAL_ENTRY,
      invoiceRef: normalizeNullableText(input.invoiceRef),
      confirmedById: input.confirmedById,
    },
    create: {
      savingCardId: card.id,
      materialId: card.materialId,
      supplierId: card.supplierId ?? null,
      period,
      actualQty: input.actualQty,
      unit: input.unit,
      source: input.source ?? ForecastSource.MANUAL_ENTRY,
      invoiceRef: normalizeNullableText(input.invoiceRef),
      confirmedById: input.confirmedById,
    },
  });
}

export async function getVolumeTimeline(
  savingCardId: string,
  context: TenantContextSource
): Promise<VolumeTimelineResult> {
  const card = await getScopedVolumeCard(savingCardId, context);
  const priceDelta = card.baselinePrice - card.newPrice;
  const [forecasts, actuals] = await Promise.all([
    prisma.materialConsumptionForecast.findMany({
      where: buildTenantOwnedRelationWhere("savingCard", context, { id: savingCardId }),
      orderBy: { period: "asc" },
      select: {
        period: true,
        forecastQty: true,
        unit: true,
        source: true,
      },
    }),
    prisma.materialConsumptionActual.findMany({
      where: buildTenantOwnedRelationWhere("savingCard", context, { id: savingCardId }),
      orderBy: { period: "asc" },
      select: {
        period: true,
        actualQty: true,
        unit: true,
        source: true,
      },
    }),
  ]);

  const rows = new Map<string, TimelineAccumulator>();
  const defaultUnit = card?.volumeUnit ?? "units";

  for (const forecast of forecasts) {
    const normalizedPeriod = normalizePeriod(forecast.period);
    const key = periodKey(normalizedPeriod);
    const current = rows.get(key) ?? {
      periodDate: normalizedPeriod,
      forecastQty: 0,
      actualQty: 0,
      unit: forecast.unit || defaultUnit,
      forecastSource: null,
      actualSource: null,
    };

    current.forecastQty += forecast.forecastQty;
    current.unit = forecast.unit || current.unit || defaultUnit;
    current.forecastSource = forecast.source;
    rows.set(key, current);
  }

  for (const actual of actuals) {
    const normalizedPeriod = normalizePeriod(actual.period);
    const key = periodKey(normalizedPeriod);
    const current = rows.get(key) ?? {
      periodDate: normalizedPeriod,
      forecastQty: 0,
      actualQty: 0,
      unit: actual.unit || defaultUnit,
      forecastSource: null,
      actualSource: null,
    };

    current.actualQty += actual.actualQty;
    current.unit = actual.unit || current.unit || defaultUnit;
    current.actualSource = actual.source;
    rows.set(key, current);
  }

  const timeline = Array.from(rows.values())
    .sort((a, b) => a.periodDate.getTime() - b.periodDate.getTime())
    .map<VolumeTimelineRow>((row) => {
      const forecastSaving = priceDelta * row.forecastQty;
      const actualSaving = priceDelta * row.actualQty;
      const varianceQty = row.actualQty - row.forecastQty;
      const varianceSaving = actualSaving - forecastSaving;
      const variancePercent = row.forecastQty
        ? (varianceQty / row.forecastQty) * 100
        : null;

      return {
        period: periodDisplay(row.periodDate),
        periodKey: periodKey(row.periodDate),
        periodDate: row.periodDate.toISOString(),
        forecastQty: row.forecastQty,
        actualQty: row.actualQty,
        unit: row.unit || defaultUnit,
        forecastSaving,
        actualSaving,
        varianceQty,
        varianceSaving,
        variancePercent,
        isConfirmed: row.actualQty > 0,
        isFuture: isFuture(row.periodDate),
        forecastSource: row.forecastSource,
        actualSource: row.actualSource,
      };
    });

  const currentMonth = getCurrentMonthStartUtc();
  const currentYear = currentMonth.getUTCFullYear();
  const ytdRows = timeline.filter((row) => {
    const period = new Date(row.periodDate);
    return (
      period.getUTCFullYear() === currentYear &&
      period.getTime() <= currentMonth.getTime()
    );
  });

  const ytdForecastSaving = sumBy(ytdRows, (row) => row.forecastSaving);
  const ytdActualSaving = sumBy(ytdRows, (row) => row.actualSaving);
  const ytdForecastQty = sumBy(ytdRows, (row) => row.forecastQty);
  const ytdActualQty = sumBy(ytdRows, (row) => row.actualQty);
  const ytdVarianceSaving = ytdActualSaving - ytdForecastSaving;
  const ytdVarianceQty = ytdActualQty - ytdForecastQty;

  return {
    timeline,
    summary: {
      ytdForecastSaving,
      ytdActualSaving,
      ytdVarianceSaving,
      ytdVariancePercent: ytdForecastSaving
        ? (ytdVarianceSaving / ytdForecastSaving) * 100
        : null,
      ytdForecastQty,
      ytdActualQty,
      ytdVarianceQty,
      totalForecastMonths: timeline.filter((row) => row.forecastQty > 0).length,
      confirmedMonths: timeline.filter((row) => row.actualQty > 0).length,
      hasData: timeline.length > 0,
    },
  };
}

export async function upsertForecast(input: ForecastUpsertInput) {
  const card = await getScopedVolumeCard(input.savingCardId, input.context);

  return upsertForecastForCard(card, {
    savingCardId: input.savingCardId,
    period: input.period,
    forecastQty: input.forecastQty,
    unit: input.unit,
    source: input.source,
    notes: input.notes,
    createdById: input.createdById,
  });
}

export async function upsertActual(input: ActualUpsertInput) {
  const card = await getScopedVolumeCard(input.savingCardId, input.context);

  return upsertActualForCard(card, {
    savingCardId: input.savingCardId,
    period: input.period,
    actualQty: input.actualQty,
    unit: input.unit,
    source: input.source,
    invoiceRef: input.invoiceRef,
    confirmedById: input.confirmedById,
  });
}

export async function deleteForecast(
  savingCardId: string,
  period: Date,
  context: TenantContextSource
) {
  const card = await getScopedVolumeCard(savingCardId, context);

  return prisma.materialConsumptionForecast.deleteMany({
    where: {
      materialId: card.materialId,
      period: normalizePeriod(period),
      ...buildTenantOwnedRelationWhere("savingCard", context, { id: savingCardId }),
    },
  });
}

export async function deleteActual(
  savingCardId: string,
  period: Date,
  context: TenantContextSource
) {
  const card = await getScopedVolumeCard(savingCardId, context);

  return prisma.materialConsumptionActual.deleteMany({
    where: {
      materialId: card.materialId,
      period: normalizePeriod(period),
      ...buildTenantOwnedRelationWhere("savingCard", context, { id: savingCardId }),
    },
  });
}

export async function importFromCsv(
  savingCardId: string,
  csvContent: string,
  userId: string,
  context: TenantContextSource
): Promise<VolumeImportResult> {
  const card = await getScopedVolumeCard(savingCardId, context);

  const lines = csvContent
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    return {
      imported: 0,
      rejected: 0,
      errors: ["The file must include headers and at least one data row."],
    };
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delimiter);
  const headerMap = resolveCsvHeaderMap(headers);
  const result: VolumeImportResult = {
    imported: 0,
    rejected: 0,
    errors: [],
  };

  for (let index = 1; index < lines.length; index += 1) {
    const values = parseCsvLine(lines[index], delimiter);
    const rowNumber = index + 1;

    if (values.every((value) => !value.trim())) {
      continue;
    }

    try {
      const periodValue = values[headerMap.periodIndex] ?? "";
      const forecastValue =
        headerMap.forecastIndex === null ? "" : values[headerMap.forecastIndex] ?? "";
      const actualValue =
        headerMap.actualIndex === null ? "" : values[headerMap.actualIndex] ?? "";
      const unitValue =
        headerMap.unitIndex === null ? "" : values[headerMap.unitIndex] ?? "";

      if (!forecastValue.trim() && !actualValue.trim()) {
        throw new Error("Row does not include a forecast or actual quantity.");
      }

      const period = parseFlexiblePeriod(periodValue);
      const unit = unitValue.trim() || card.volumeUnit || "units";
      let wroteRow = false;

      if (forecastValue.trim()) {
        await upsertForecastForCard(card, {
          savingCardId: card.id,
          period,
          forecastQty: parseQuantity(forecastValue, "forecast quantity"),
          unit,
          source: ForecastSource.ERP_CSV_UPLOAD,
          createdById: userId,
        });
        wroteRow = true;
      }

      if (actualValue.trim() && normalizePeriod(period).getTime() < getCurrentMonthStartUtc().getTime()) {
        await upsertActualForCard(card, {
          savingCardId: card.id,
          period,
          actualQty: parseQuantity(actualValue, "actual quantity"),
          unit,
          source: ForecastSource.ERP_CSV_UPLOAD,
          confirmedById: userId,
        });
        wroteRow = true;
      }

      if (wroteRow) {
        result.imported += 1;
      }
    } catch (error) {
      result.rejected += 1;
      result.errors.push(
        `Row ${rowNumber}: ${
          error instanceof Error ? error.message : "Row could not be imported."
        }`
      );
    }
  }

  return result;
}

function getCurrentMonthStartUtc() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function sumBy<T>(items: T[], getter: (item: T) => number) {
  return items.reduce((total, item) => total + getter(item), 0);
}

function normalizeNullableText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeHeaderAlias(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_");
}

function resolveCsvHeaderMap(headers: string[]): CsvHeaderMap {
  let periodIndex = -1;
  let forecastIndex: number | null = null;
  let actualIndex: number | null = null;
  let unitIndex: number | null = null;

  headers.forEach((header, index) => {
    const normalized = normalizeHeaderAlias(header);

    if (PERIOD_ALIASES.has(normalized)) {
      periodIndex = index;
      return;
    }

    if (FORECAST_ALIASES.has(normalized)) {
      forecastIndex = index;
      return;
    }

    if (ACTUAL_ALIASES.has(normalized)) {
      actualIndex = index;
      return;
    }

    if (UNIT_ALIASES.has(normalized)) {
      unitIndex = index;
    }
  });

  if (periodIndex < 0) {
    throw new Error("CSV must include a Period column.");
  }

  if (forecastIndex === null && actualIndex === null) {
    throw new Error("CSV must include a Forecast or Actual column.");
  }

  return {
    periodIndex,
    forecastIndex,
    actualIndex,
    unitIndex,
  };
}

function detectDelimiter(headerLine: string) {
  const semicolonCount = (headerLine.match(/;/g) ?? []).length;
  const commaCount = (headerLine.match(/,/g) ?? []).length;
  return semicolonCount > commaCount ? ";" : ",";
}

function parseCsvLine(line: string, delimiter: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseQuantity(value: string, label: string) {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} is invalid.`);
  }

  return parsed;
}

function parseFlexiblePeriod(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error("Period is required.");
  }

  const isoMatch = normalized.match(/^(\d{4})-(\d{1,2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    return createPeriodDate(year, month);
  }

  const slashMatch = normalized.match(/^(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const month = Number(slashMatch[1]);
    const year = Number(slashMatch[2]);
    return createPeriodDate(year, month);
  }

  const namedMatch = normalized.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (namedMatch) {
    const parsed = new Date(`${namedMatch[1]} 1, ${namedMatch[2]} UTC`);

    if (Number.isNaN(parsed.getTime())) {
      throw new Error("Period is invalid.");
    }

    return normalizePeriod(parsed);
  }

  throw new Error("Period must use YYYY-MM, MM/YYYY, or Month YYYY.");
}

function createPeriodDate(year: number, month: number) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Period is invalid.");
  }

  return new Date(Date.UTC(year, month - 1, 1));
}
