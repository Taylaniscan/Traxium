const integerFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0
});

const decimalFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2
});

function toSafeNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  if (Number.isNaN(num) || !Number.isFinite(num)) return null;
  return num;
}

export function formatNumber(value: unknown) {
  const num = toSafeNumber(value);
  if (num === null) return "—";
  const absolute = Math.abs(num);
  if (absolute >= 1_000_000) {
    return `${trimTrailingZeros((num / 1_000_000).toFixed(2))}M`;
  }
  if (absolute >= 1_000) {
    return `${trimTrailingZeros((num / 1_000).toFixed(2))}k`;
  }
  return integerFormatter.format(num);
}

export function formatCurrency(value: unknown, currency: string) {
  const num = toSafeNumber(value);
  if (num === null) return "—";
  const symbol =
    currency === "USD"
      ? "$"
      : currency === "EUR"
        ? "€"
        : new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: currency || "EUR",
            maximumFractionDigits: 0
          })
            .format(0)
            .replace(/0(?:\.00)?/, "");

  return `${symbol}${formatNumber(num)}`;
}

export function formatPlainNumber(value: unknown) {
  const num = toSafeNumber(value);
  if (num === null) return "—";
  return integerFormatter.format(num);
}

export function formatDecimalNumber(value: unknown) {
  const num = toSafeNumber(value);
  if (num === null) return "—";
  return decimalFormatter.format(num);
}

function trimTrailingZeros(value: string) {
  return value.replace(/\.?0+$/, "");
}
