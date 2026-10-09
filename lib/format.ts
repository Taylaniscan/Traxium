import { formatCurrency, formatDecimalNumber, formatNumber, formatPlainNumber } from "@/lib/utils/numberFormatter";
import { formatRegionalDateOnly, type SupportedLocale } from "@/lib/regional";

/** Render date-only values without shifting their calendar day. */
export function formatDate(value: unknown, locale: SupportedLocale = "en-US") {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const date = value instanceof Date ? value : new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? "—" : formatRegionalDateOnly(date, locale);
}

export function formatInteger(value: unknown) {
  return formatPlainNumber(value);
}

export function formatDecimal(value: unknown) {
  return formatDecimalNumber(value);
}

export function formatCurrencyValue(currency: string, value: unknown) {
  return formatCurrency(value, currency);
}

export function formatDateValue(value: unknown) {
  return formatDate(value);
}

export { formatCurrency, formatNumber, formatPlainNumber, formatDecimalNumber };
