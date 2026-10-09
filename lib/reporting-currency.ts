import type { Currency, Prisma } from "@prisma/client";
import { toNumber } from "@/lib/utils/decimal";

export type ReportingBasis = { currency: Currency; eurToUsd: number; effectiveDate: string | null };

/** FX records define USD received for one EUR, effective from validFrom. */
export async function resolveReportingBasis(client: Pick<Prisma.TransactionClient, "fxRate">, currency: Currency, asOf: Date): Promise<ReportingBasis> {
  if (currency === "USD") return { currency, eurToUsd: 1, effectiveDate: null };
  const record = await client.fxRate.findFirst({ where: { currency: "EUR", validFrom: { lte: asOf } }, orderBy: { validFrom: "desc" } });
  const eurToUsd = record ? toNumber(record.rateToUSD) : NaN;
  if (!Number.isFinite(eurToUsd) || eurToUsd <= 0) throw new Error("EUR reporting needs a positive EUR-to-USD FX rate effective on or before the reporting date. Ask an admin to configure the rate.");
  return { currency, eurToUsd, effectiveDate: record!.validFrom.toISOString().slice(0, 10) };
}

export function usdToReporting(valueUsd: number, basis: ReportingBasis) {
  if (!Number.isFinite(valueUsd)) throw new Error("Reporting amount must be finite.");
  if (!Number.isFinite(basis.eurToUsd) || basis.eurToUsd <= 0) throw new Error("Reporting FX rate must be positive and finite.");
  return basis.currency === "USD" ? valueUsd : valueUsd / basis.eurToUsd;
}

export function localToUsd(value: number, currency: Currency, eurToUsd: number) {
  if (!Number.isFinite(value) || !Number.isFinite(eurToUsd) || eurToUsd <= 0) throw new Error("A positive, finite EUR-to-USD FX rate is required.");
  return currency === "USD" ? value : value * eurToUsd;
}
