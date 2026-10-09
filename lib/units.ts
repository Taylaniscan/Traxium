export type UnitDimension = "count" | "mass" | "volume" | "length" | "business";
export type UnitDefinition = { code: string; label: string; dimension: UnitDimension; toBase: number | null };

/** Factors use grams, millilitres, metres, or each as the base unit. */
export const units: readonly UnitDefinition[] = [
  { code: "each", label: "pieces / each", dimension: "count", toBase: 1 },
  { code: "g", label: "grams (g)", dimension: "mass", toBase: 1 },
  { code: "kg", label: "kilograms (kg)", dimension: "mass", toBase: 1000 },
  { code: "t", label: "metric tonnes (t)", dimension: "mass", toBase: 1000000 },
  { code: "lb", label: "pounds (lb)", dimension: "mass", toBase: 453.59237 },
  { code: "short_ton_us", label: "US short tons", dimension: "mass", toBase: 907184.74 },
  { code: "mL", label: "millilitres (mL)", dimension: "volume", toBase: 1 },
  { code: "L", label: "litres (L)", dimension: "volume", toBase: 1000 },
  { code: "gal_us", label: "US gallons", dimension: "volume", toBase: 3785.411784 },
  { code: "gal_imp", label: "imperial gallons", dimension: "volume", toBase: 4546.09 },
  { code: "m", label: "metres (m)", dimension: "length", toBase: 1 },
  { code: "ft", label: "feet (ft)", dimension: "length", toBase: 0.3048 },
  { code: "pack", label: "packs", dimension: "business", toBase: null },
  { code: "pallet", label: "pallets", dimension: "business", toBase: null },
  { code: "hour", label: "hours", dimension: "business", toBase: null },
  { code: "service", label: "services", dimension: "business", toBase: null },
];

const legacyAliases: Record<string, string> = { units: "each", unit: "each", pcs: "each", piece: "each", pieces: "each", kilograms: "kg", pounds: "lb", litres: "L", liters: "L", packs: "pack", pallets: "pallet", hours: "hour", services: "service" };
const ambiguousUnits = new Set(["ton", "tons", "gallon", "gallons"]);

export function resolveUnit(value: string): UnitDefinition | null {
  const trimmed = value.trim();
  const code = legacyAliases[trimmed.toLowerCase()] ?? trimmed;
  return units.find((unit) => unit.code === code) ?? null;
}

export function validateUnit(value: string): { valid: true; code: string; known: boolean } | { valid: false; error: string } {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 64) return { valid: false, error: "Enter a unit (64 characters or fewer)." };
  if (ambiguousUnits.has(trimmed.toLowerCase())) return { valid: false, error: `Specify which ${trimmed.toLowerCase().startsWith("ton") ? "tonne or ton" : "gallon"} you mean.` };
  const known = resolveUnit(trimmed);
  return { valid: true, code: known?.code ?? trimmed, known: Boolean(known) };
}

export function unitConversionFactor(from: string, to: string): number | null {
  const source = resolveUnit(from), target = resolveUnit(to);
  if (from.trim() === to.trim() || source?.code === target?.code && source) return 1;
  if (!source || !target || source.dimension !== target.dimension || source.toBase === null || target.toBase === null) return null;
  return source.toBase / target.toBase;
}

export function convertQuantityAndUnitPrice(quantity: number, pricePerUnit: number, from: string, to: string) {
  const factor = unitConversionFactor(from, to);
  if (factor === null || !Number.isFinite(quantity) || !Number.isFinite(pricePerUnit) || factor <= 0) throw new Error("Units are incompatible or have no defined conversion factor.");
  return { quantity: quantity * factor, pricePerUnit: pricePerUnit / factor };
}

export function preferredUnit(dimension: UnitDimension, system: "metric" | "us_customary") {
  const suggestions = system === "metric" ? { count: "each", mass: "kg", volume: "L", length: "m", business: "pack" } : { count: "each", mass: "lb", volume: "gal_us", length: "ft", business: "pack" };
  return suggestions[dimension];
}

export function unitsForPreference(system: "metric" | "us_customary") {
  const suggested = system === "metric" ? ["each", "kg", "t", "L", "m"] : ["each", "lb", "short_ton_us", "gal_us", "ft"];
  return [...units].sort((a, b) => {
    const aRank = suggested.indexOf(a.code), bRank = suggested.indexOf(b.code);
    return (aRank < 0 ? suggested.length : aRank) - (bRank < 0 ? suggested.length : bRank);
  });
}
