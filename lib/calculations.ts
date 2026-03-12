import { Frequency, Phase } from "@prisma/client";

type SavingsArgs = {
  baselinePrice: number;
  newPrice: number;
  annualVolume: number;
  fxRate: number;
  currency: "EUR" | "USD";
};

export function calculateSavings({
  baselinePrice,
  newPrice,
  annualVolume,
  fxRate,
  currency
}: SavingsArgs) {
  const baseline = Number(baselinePrice || 0);
  const next = Number(newPrice || 0);
  const volume = Number(annualVolume || 0);
  const fx = Number(fxRate || 0);

  if ([baseline, next, volume, fx].some((value) => Number.isNaN(value) || !Number.isFinite(value))) {
    return {
      localSavings: 0,
      savingsEUR: 0,
      savingsUSD: 0
    };
  }

  const localSavings = (baseline - next) * volume;

  if (currency === "EUR") {
    return {
      localSavings,
      savingsEUR: localSavings,
      savingsUSD: localSavings * fx
    };
  }

  return {
    localSavings,
    savingsEUR: localSavings * fx,
    savingsUSD: localSavings
  };
}

export function getValueBadgeTone(phase: Phase) {
  if (phase === "ACHIEVED") return "emerald";
  if (phase === "REALISED") return "teal";
  if (phase === "VALIDATED") return "amber";
  if (phase === "CANCELLED") return "rose";
  return "slate";
}

export function getForecastMultiplier(frequency: Frequency) {
  switch (frequency) {
    case "ONE_TIME":
      return 1;
    case "RECURRING":
      return 1;
    case "MULTI_YEAR":
      return 3;
    default:
      return 1;
  }
}
