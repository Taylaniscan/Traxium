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
