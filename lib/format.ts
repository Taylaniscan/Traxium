import { formatCurrency, formatDecimalNumber, formatNumber, formatPlainNumber } from "@/lib/utils/numberFormatter";

const usDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "2-digit",
  day: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

/** Render a date in US MM/DD/YYYY format. Returns "—" for missing/invalid input. */
export function formatDate(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const date = value instanceof Date ? value : new Date(value as string | number);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return usDateFormatter.format(date);
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
