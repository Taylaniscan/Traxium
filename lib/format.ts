import { formatCurrency, formatDecimalNumber, formatNumber, formatPlainNumber } from "@/lib/utils/numberFormatter";

export function formatInteger(value: unknown) {
  return formatPlainNumber(value);
}

export function formatDecimal(value: unknown) {
  return formatDecimalNumber(value);
}

export function formatCurrencyValue(currency: string, value: unknown) {
  return formatCurrency(value, currency);
}

export { formatCurrency, formatNumber, formatPlainNumber, formatDecimalNumber };
