import { formatRegionalCurrency, formatRegionalNumber, type SupportedLocale } from "@/lib/regional";

function toSafeNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function formatNumber(value: unknown, locale: SupportedLocale = "en-US") {
  const number = toSafeNumber(value);
  if (number === null) return "—";
  return formatRegionalNumber(number, locale, { notation: "compact", maximumFractionDigits: 2 });
}

export function formatCurrency(value: unknown, currency: string, locale: SupportedLocale = "en-US") {
  const number = toSafeNumber(value);
  if (number === null || (currency !== "USD" && currency !== "EUR")) return "—";
  return formatRegionalCurrency(number, currency, locale);
}

export function formatPlainNumber(value: unknown, locale: SupportedLocale = "en-US") {
  const number = toSafeNumber(value);
  return number === null ? "—" : formatRegionalNumber(number, locale, { maximumFractionDigits: 0 });
}

export function formatDecimalNumber(value: unknown, locale: SupportedLocale = "en-US") {
  const number = toSafeNumber(value);
  return number === null ? "—" : formatRegionalNumber(number, locale, { maximumFractionDigits: 2 });
}
