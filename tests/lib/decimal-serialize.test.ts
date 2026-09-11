import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { serializeDecimals } from "@/lib/utils/decimal";

describe("serializeDecimals", () => {
  it("converts Prisma Decimal instances to plain numbers", () => {
    const result = serializeDecimals({ baselinePrice: new Prisma.Decimal("12.5") });
    expect(result.baselinePrice).toBe(12.5);
    expect(typeof result.baselinePrice).toBe("number");
  });

  it("preserves Date values rather than stringifying them", () => {
    const date = new Date("2026-03-01T00:00:00.000Z");
    const result = serializeDecimals({ impactStartDate: date });
    expect(result.impactStartDate).toBeInstanceOf(Date);
    expect(result.impactStartDate.getTime()).toBe(date.getTime());
  });

  it("recurses through nested objects and arrays", () => {
    const result = serializeDecimals({
      cards: [
        {
          newPrice: new Prisma.Decimal("10"),
          nested: { fxRate: new Prisma.Decimal("1.1") },
          when: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    });
    expect(result.cards[0].newPrice).toBe(10);
    expect(result.cards[0].nested.fxRate).toBeCloseTo(1.1, 6);
    expect(result.cards[0].when).toBeInstanceOf(Date);
  });

  it("leaves null, undefined, and primitives untouched", () => {
    expect(serializeDecimals(null)).toBeNull();
    expect(serializeDecimals(undefined)).toBeUndefined();
    expect(serializeDecimals("USD")).toBe("USD");
    expect(serializeDecimals(42)).toBe(42);
  });

  it("produces an object with no Decimal instances anywhere (client-safe)", () => {
    const serialized = serializeDecimals({
      a: new Prisma.Decimal("1"),
      b: [new Prisma.Decimal("2"), { c: new Prisma.Decimal("3") }],
    });
    const hasDecimal = JSON.stringify(serialized).includes("s\":");
    expect(Prisma.Decimal.isDecimal(serialized.a)).toBe(false);
    expect(Prisma.Decimal.isDecimal(serialized.b[0])).toBe(false);
    expect(hasDecimal).toBe(false);
  });
});
