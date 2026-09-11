import { Prisma } from "@prisma/client";

type DecimalLike = Prisma.Decimal | number | string | null | undefined;

/**
 * Convert a Prisma Decimal (or number/string) to a plain JavaScript number at the
 * presentation/calculation boundary. Money and quantity columns are stored as Decimal
 * for precision; arithmetic and number-typed APIs operate on numbers. Invalid or empty
 * values normalize to 0.
 */
export function toNumber(value: DecimalLike): number {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Recursively convert Prisma Decimal instances in a value to plain numbers so the
 * result is safe to pass from a Server Component to a Client Component (React cannot
 * serialize Decimal objects across that boundary). Dates and other primitives are
 * preserved as-is; the nominal type is kept because downstream readers normalize
 * money/quantity fields through `toNumber`, which accepts numbers.
 */
export function serializeDecimals<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }

  if (Prisma.Decimal.isDecimal(value)) {
    return (value as Prisma.Decimal).toNumber() as unknown as T;
  }

  if (value instanceof Date) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeDecimals(item)) as unknown as T;
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      result[key] = serializeDecimals(item);
    }
    return result as T;
  }

  return value;
}
