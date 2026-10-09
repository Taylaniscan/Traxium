"use client";

import { createContext, useContext, type ReactNode } from "react";
import { formatRegionalCurrency, formatRegionalDateOnly, formatRegionalNumber, formatRegionalTimestamp, type SupportedLocale } from "@/lib/regional";

export type RegionalDisplay = {
  locale: SupportedLocale;
  timeZone: string;
  reportingCurrency: "USD" | "EUR";
  eurToUsd: number | null;
  fxEffectiveDate: string | null;
  measurementSystem: "metric" | "us_customary";
};

const fallback: RegionalDisplay = { locale: "en-US", timeZone: "UTC", reportingCurrency: "USD", eurToUsd: 1, fxEffectiveDate: null, measurementSystem: "metric" };
const RegionalContext = createContext<RegionalDisplay>(fallback);

export function RegionalProvider({ value, children }: { value: RegionalDisplay; children: ReactNode }) {
  return <RegionalContext.Provider value={value}>{children}</RegionalContext.Provider>;
}

export function useRegionalDisplay() {
  const settings = useContext(RegionalContext);
  return {
    ...settings,
    formatUsd(value: unknown) {
      const amount = Number(value);
      if (!Number.isFinite(amount)) return "—";
      if (settings.reportingCurrency === "EUR" && (!settings.eurToUsd || settings.eurToUsd <= 0)) return "EUR rate unavailable";
      const displayed = settings.reportingCurrency === "USD" ? amount : amount / settings.eurToUsd!;
      return formatRegionalCurrency(displayed, settings.reportingCurrency, settings.locale);
    },
    formatMoney(value: unknown, currency: "USD" | "EUR") {
      const amount = Number(value);
      return Number.isFinite(amount) ? formatRegionalCurrency(amount, currency, settings.locale) : "—";
    },
    formatNumber(value: unknown) {
      const amount = Number(value);
      return Number.isFinite(amount) ? formatRegionalNumber(amount, settings.locale) : "—";
    },
    formatDateOnly(value: string | Date) { return formatRegionalDateOnly(value, settings.locale); },
    formatTimestamp(value: string | Date) { return formatRegionalTimestamp(value, settings.locale, settings.timeZone); },
  };
}
