export const supportedLocales = ["en-US", "en-GB", "de-DE", "fr-FR", "nl-NL"] as const;
export type SupportedLocale = string;
export type MeasurementSystem = "metric" | "us_customary";

export const defaultRegionalPreferences = {
  locale: "en-US" as SupportedLocale,
  timeZone: "UTC",
  measurementSystem: "metric" as MeasurementSystem,
};

export function normalizeLocale(value: unknown): SupportedLocale | null {
  if (typeof value !== "string" || value.length < 2 || value.length > 35) return null;
  try {
    const canonical = Intl.getCanonicalLocales(value)[0];
    return canonical && Intl.DateTimeFormat.supportedLocalesOf([canonical]).length ? canonical : null;
  } catch { return null; }
}

export function normalizeTimeZone(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 64) return null;
  try {
    return new Intl.DateTimeFormat("en", { timeZone: value }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

export function normalizeMeasurementSystem(value: unknown): MeasurementSystem | null {
  return value === "metric" || value === "us_customary" ? value : null;
}

export function formatRegionalNumber(value: number, locale: SupportedLocale = "en-US", options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatRegionalCurrency(value: number, currency: "USD" | "EUR", locale: SupportedLocale = "en-US") {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "code", minimumFractionDigits: 0, maximumFractionDigits: 8 }).format(value);
}

/** Date-only values represent a calendar date, not an instant in the viewer's zone. */
export function formatRegionalDateOnly(value: string | Date, locale: SupportedLocale = "en-US") {
  if (value instanceof Date && Number.isNaN(value.getTime())) return "—";
  const iso = value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "—";
  const date = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

export function formatRegionalTimestamp(value: string | Date, locale: SupportedLocale = "en-US", timeZone = "UTC") {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone, timeZoneName: "short" }).format(date);
}

export function formatRegionalMonth(value: string | Date, locale: SupportedLocale = "en-US") {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, { month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

/** Explicit decimal convention; grouping is rejected so 1,234 is never guessed. */
export function parseRegionalDecimal(input: string, convention: "dot" | "comma") {
  const value = input.trim();
  const pattern = convention === "dot" ? /^[+-]?\d+(?:\.\d+)?$/ : /^[+-]?\d+(?:,\d+)?$/;
  if (!pattern.test(value)) throw new Error(`Use ${convention === "dot" ? "." : ","} as the decimal separator without grouping marks.`);
  const parsed = Number(convention === "comma" ? value.replace(",", ".") : value);
  if (!Number.isFinite(parsed)) throw new Error("Enter a finite number.");
  return parsed;
}
