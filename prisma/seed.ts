import path from "node:path";
import {
  ApprovalStatus,
  Currency,
  Frequency,
  Phase,
  PrismaClient,
  Role,
} from "@prisma/client";
import { calculateSavings } from "../lib/calculations";

const prisma = new PrismaClient();

const fxRatesSeed = [
  {
    currency: Currency.USD,
    rateToEUR: 0.92,
    validFrom: new Date("2026-01-01T00:00:00.000Z"),
  },
];

const annualTargetsSeed = [
  {
    year: 2026,
    targetValue: 1500000,
    categoryKey: "rawMaterials",
  },
];

// Preserve legacy keys because seeded workflows reference them by key.
// These remain authenticated app users, not buyer master data.
const userSeeds = {
  sophie: {
    name: "Taylan Iscan Category Lead",
    email: "gcmtaylaniscan@gmail.com",
    role: Role.GLOBAL_CATEGORY_LEADER,
  },
  marco: {
    name: "Taylan Iscan Finance",
    email: "iscantaylan82@gmail.com",
    role: Role.FINANCIAL_CONTROLLER,
  },
  luca: {
    name: "Luca Buyer",
    email: "luca@traxium.local",
    role: Role.TACTICAL_BUYER,
  },
  helen: {
    name: "Taylan Iscan Procurement Head",
    email: "taylaniscan@gmail.com",
    role: Role.HEAD_OF_GLOBAL_PROCUREMENT,
  },
} as const;

const buyerSeeds = {
  luca: {
    name: "Luca Buyer",
  },
  packagingStrategic: {
    name: "Packaging Strategic Buyer",
  },
  additivesOps: {
    name: "Masterbatch Additives Buyer",
  },
} as const;

const supplierSeeds = {
  basf: { name: "BASF" },
  cabot: { name: "Cabot" },
  clariant: { name: "Clariant" },
  sabic: { name: "SABIC" },
  eastman: { name: "Eastman" },
  dow: { name: "Dow Chemical" },
  avient: { name: "Avient" },
  arkema: { name: "Arkema" },
  ampacet: { name: "Ampacet" },
  polyOne: { name: "PolyOne" },
  mane: { name: "Mane" },
  lyondell: { name: "LyondellBasell" },
} as const;

const materialSeeds = {
  tio2: { name: "Titanium Dioxide" },
  carbonBlack: { name: "Carbon Black" },
  peCarrier: { name: "PE Carrier" },
  whitePE: { name: "White PE Masterbatch" },
  blackPP: { name: "Black PP Masterbatch" },
  naturalPE: { name: "Natural PE Masterbatch" },
  antiUV: { name: "Anti-UV Polyolefin Masterbatch" },
  antiStatic: { name: "Anti-Static Masterbatch" },
  matteFinish: { name: "Matte Finish Masterbatch" },
  flameRetardant: { name: "Flame-Retardant ABS Masterbatch" },
  recycledBlend: { name: "Recycled Polyolefin Concentrate" },
  foodSafeBlack: { name: "Food-Safe Black Masterbatch" },
  translucentClear: { name: "Translucent Clear Masterbatch" },
  antiCorrosion: { name: "Anti-Corrosion Masterbatch" },
  highImpact: { name: "High-Impact PE Color Masterbatch" },
  functionalClear: { name: "Functional Clear Additive Masterbatch" },
} as const;

const categorySeeds = {
  rawMaterials: { name: "Raw Materials" },
  packaging: { name: "Packaging" },
  colorConcentrates: { name: "Color Concentrates" },
  additiveBlends: { name: "Additive Blends" },
  recycledContent: { name: "Recycled Content Solutions" },
} as const;

const plantSeeds = {
  almere: { name: "Almere Plant", region: "NL" },
  antwerp: { name: "Antwerp Plant", region: "BE" },
  rotterdam: { name: "Rotterdam Plant", region: "NL" },
  zeebrugge: { name: "Zeebrugge Plant", region: "BE" },
  leipzig: { name: "Leipzig Plant", region: "DE" },
} as const;

const businessUnitSeeds = {
  coatings: { name: "Coatings" },
  masterbatch: { name: "Masterbatch" },
  additives: { name: "Additives" },
} as const;

const DEFAULT_EVIDENCE_BUCKET = "evidence-private";

type UserKey = keyof typeof userSeeds;
type BuyerKey = keyof typeof buyerSeeds;
type SupplierKey = keyof typeof supplierSeeds;
type MaterialKey = keyof typeof materialSeeds;
type CategoryKey = keyof typeof categorySeeds;
type PlantKey = keyof typeof plantSeeds;
type BusinessUnitKey = keyof typeof businessUnitSeeds;

type IdLookup<T extends string> = Record<T, { id: string; name: string }>;

function getEvidenceStorageBucketName() {
  return process.env.SUPABASE_STORAGE_BUCKET?.trim() || DEFAULT_EVIDENCE_BUCKET;
}

function buildSeedEvidenceStoragePath(
  organizationId: string,
  savingCardId: string,
  fileName: string
) {
  return `organizations/${organizationId}/saving-cards/${savingCardId}/evidence/${path.basename(fileName)}`;
}

const savingCardsSeed: Array<{
  title: string;
  description: string;
  savingType: string;
  phase: Phase;
  supplierKey: SupplierKey;
  materialKey: MaterialKey;
  alternativeSupplierKey: SupplierKey | null;
  alternativeMaterialManualName: string | null;
  categoryKey: CategoryKey;
  plantKey: PlantKey;
  businessUnitKey: BusinessUnitKey;
  buyerKey: BuyerKey;
  stakeholderKeys: UserKey[];
  baselinePrice: number;
  newPrice: number;
  annualVolume: number;
  currency: Currency;
  fxRate: number;
  frequency: Frequency;
  savingDriver: string;
  implementationComplexity: string;
  qualificationStatus: string;
  startDate: Date;
  endDate: Date;
  impactStartDate: Date;
  impactEndDate: Date;
  evidenceFileName: string;
  evidenceType: string;
  cancellationReason: string | null;
}> = [
  {
    title: "BASF TiO2 renegotiation",
    description: "Renegotiate annual TiO2 pricing for coatings portfolio.",
    savingType: "Price renegotiation",
    phase: Phase.IDEA,
    supplierKey: "basf" as SupplierKey,
    materialKey: "tio2" as MaterialKey,
    alternativeSupplierKey: "clariant" as SupplierKey,
    alternativeMaterialManualName: null,
    categoryKey: "rawMaterials" as CategoryKey,
    plantKey: "almere" as PlantKey,
    businessUnitKey: "coatings" as BusinessUnitKey,
    buyerKey: "luca" as BuyerKey,
    stakeholderKeys: ["sophie", "marco"] as UserKey[],
    baselinePrice: 10,
    newPrice: 9.25,
    annualVolume: 100000,
    currency: Currency.EUR,
    fxRate: 1,
    frequency: Frequency.RECURRING,
    savingDriver: "Negotiation",
    implementationComplexity: "Medium",
    qualificationStatus: "Approved",
    startDate: new Date("2026-01-01T00:00:00.000Z"),
    endDate: new Date("2026-12-31T00:00:00.000Z"),
    impactStartDate: new Date("2026-04-01T00:00:00.000Z"),
    impactEndDate: new Date("2026-12-31T00:00:00.000Z"),
    evidenceFileName: "basf-tio2-proposal.pdf",
    evidenceType: "application/pdf",
    cancellationReason: null,
  },
  {
    title: "Cabot carbon black dual sourcing",
    description: "Evaluate second source to reduce cost and supply risk.",
    savingType: "Alternative supplier",
    phase: Phase.VALIDATED,
    supplierKey: "cabot" as SupplierKey,
    materialKey: "carbonBlack" as MaterialKey,
    alternativeSupplierKey: "clariant" as SupplierKey,
    alternativeMaterialManualName: null,
    categoryKey: "rawMaterials" as CategoryKey,
    plantKey: "antwerp" as PlantKey,
    businessUnitKey: "masterbatch" as BusinessUnitKey,
    buyerKey: "luca" as BuyerKey,
    stakeholderKeys: ["sophie"] as UserKey[],
    baselinePrice: 8.7,
    newPrice: 8.1,
    annualVolume: 85000,
    currency: Currency.EUR,
    fxRate: 1,
    frequency: Frequency.RECURRING,
    savingDriver: "Dual sourcing",
    implementationComplexity: "High",
    qualificationStatus: "Plant Trial",
    startDate: new Date("2026-01-01T00:00:00.000Z"),
    endDate: new Date("2026-12-31T00:00:00.000Z"),
    impactStartDate: new Date("2026-06-01T00:00:00.000Z"),
    impactEndDate: new Date("2026-12-31T00:00:00.000Z"),
    evidenceFileName: "carbon-black-trial.xlsx",
    evidenceType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    cancellationReason: null,
  },
  {
    title: "SABIC white PE masterbatch annual reset",
    description: "Renegotiate white PE masterbatch pricing to secure lower base charges and remove unindexed freight escalations over the next contract cycle.",
    savingType: "Price renegotiation",
    phase: Phase.VALIDATED,
    supplierKey: "sabic" as SupplierKey,
    materialKey: "whitePE" as MaterialKey,
    alternativeSupplierKey: "clariant" as SupplierKey,
    alternativeMaterialManualName: null,
    categoryKey: "colorConcentrates" as CategoryKey,
    plantKey: "rotterdam" as PlantKey,
    businessUnitKey: "masterbatch" as BusinessUnitKey,
    buyerKey: "luca" as BuyerKey,
    stakeholderKeys: ["sophie", "luca"] as UserKey[],
    baselinePrice: 4.2,
    newPrice: 3.95,
    annualVolume: 312000,
    currency: Currency.EUR,
    fxRate: 1,
    frequency: Frequency.MULTI_YEAR,
    savingDriver: "Negotiation",
    implementationComplexity: "Medium",
    qualificationStatus: "Approved",
    startDate: new Date("2026-01-05T00:00:00.000Z"),
    endDate: new Date("2026-12-31T00:00:00.000Z"),
    impactStartDate: new Date("2026-02-01T00:00:00.000Z"),
    impactEndDate: new Date("2026-12-31T00:00:00.000Z"),
    evidenceFileName: "sabic-white-pe-reset.pdf",
    evidenceType: "application/pdf",
    cancellationReason: null,
  },
  {
    title: "Avient recycled polyolefin concentration consolidation",
    description: "Shift black masterbatch demand from two high-cost SKUs into one recycled-polyolefin concentrate contract with better traceability clauses.",
    savingType: "Supplier consolidation",
    phase: Phase.REALISED,
    supplierKey: "avient" as SupplierKey,
    materialKey: "recycledBlend" as MaterialKey,
    alternativeSupplierKey: "mane" as SupplierKey,
    alternativeMaterialManualName: null,
    categoryKey: "recycledContent" as CategoryKey,
    plantKey: "leipzig" as PlantKey,
    businessUnitKey: "additives" as BusinessUnitKey,
    buyerKey: "additivesOps" as BuyerKey,
    stakeholderKeys: ["marco", "luca"] as UserKey[],
    baselinePrice: 3.75,
    newPrice: 3.28,
    annualVolume: 145000,
    currency: Currency.EUR,
    fxRate: 1,
    frequency: Frequency.RECURRING,
    savingDriver: "Volume Consolidation",
    implementationComplexity: "High",
    qualificationStatus: "Plant Trial",
    startDate: new Date("2026-02-10T00:00:00.000Z"),
    endDate: new Date("2026-12-31T00:00:00.000Z"),
    impactStartDate: new Date("2026-04-01T00:00:00.000Z"),
    impactEndDate: new Date("2026-12-31T00:00:00.000Z"),
    evidenceFileName: "avient-recycled-consolidation.xlsx",
    evidenceType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    cancellationReason: null,
  },
  {
    title: "Eastman anti-UV masterbatch optimization",
    description: "Run a pilot with anti-UV masterbatch alternative to reduce outdoor degradation claims without changing spec tolerances.",
    savingType: "Specification change",
    phase: Phase.IDEA,
    supplierKey: "eastman" as SupplierKey,
    materialKey: "antiUV" as MaterialKey,
    alternativeSupplierKey: "polyOne" as SupplierKey,
    alternativeMaterialManualName: null,
    categoryKey: "additiveBlends" as CategoryKey,
    plantKey: "antwerp" as PlantKey,
    businessUnitKey: "additives" as BusinessUnitKey,
    buyerKey: "packagingStrategic" as BuyerKey,
    stakeholderKeys: ["sophie"] as UserKey[],
    baselinePrice: 6.1,
    newPrice: 5.72,
    annualVolume: 96000,
    currency: Currency.EUR,
    fxRate: 1,
    frequency: Frequency.ONE_TIME,
    savingDriver: "Specification Optimization",
    implementationComplexity: "Strategic",
    qualificationStatus: "Lab Testing",
    startDate: new Date("2026-03-01T00:00:00.000Z"),
    endDate: new Date("2027-02-28T00:00:00.000Z"),
    impactStartDate: new Date("2026-05-01T00:00:00.000Z"),
    impactEndDate: new Date("2027-02-28T00:00:00.000Z"),
    evidenceFileName: "eastman-anti-uv-eval.pdf",
    evidenceType: "application/pdf",
    cancellationReason: null,
  },
  {
    title: "Dow natural tone masterbatch process redesign",
    description: "Replace a blended natural-tone masterbatch with a higher yield alternative to reduce over-application and reduce scrap-related waste.",
    savingType: "Material Substitution",
    phase: Phase.VALIDATED,
    supplierKey: "dow" as SupplierKey,
    materialKey: "naturalPE" as MaterialKey,
    alternativeSupplierKey: "clariant" as SupplierKey,
    alternativeMaterialManualName: null,
    categoryKey: "colorConcentrates" as CategoryKey,
    plantKey: "rotterdam" as PlantKey,
    businessUnitKey: "masterbatch" as BusinessUnitKey,
    buyerKey: "luca" as BuyerKey,
    stakeholderKeys: ["helen", "luca"] as UserKey[],
    baselinePrice: 4.85,
    newPrice: 4.3,
    annualVolume: 188000,
    currency: Currency.EUR,
    fxRate: 1,
    frequency: Frequency.RECURRING,
    savingDriver: "Material Substitution",
    implementationComplexity: "High",
    qualificationStatus: "Plant Trial",
    startDate: new Date("2026-01-20T00:00:00.000Z"),
    endDate: new Date("2026-12-31T00:00:00.000Z"),
    impactStartDate: new Date("2026-03-15T00:00:00.000Z"),
    impactEndDate: new Date("2026-12-31T00:00:00.000Z"),
    evidenceFileName: "dow-natural-tone-process.docx",
    evidenceType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    cancellationReason: null,
  },
  {
    title: "Clariant anti-static masterbatch production launch",
    description: "Migrate line 3 to anti-static masterbatch to cut handling losses and line rejects while keeping packaging quality unchanged.",
    savingType: "Specification change",
    phase: Phase.ACHIEVED,
    supplierKey: "clariant" as SupplierKey,
    materialKey: "antiStatic" as MaterialKey,
    alternativeSupplierKey: null,
    alternativeMaterialManualName: "In-house anti-static additive blend",
    categoryKey: "additiveBlends" as CategoryKey,
    plantKey: "leipzig" as PlantKey,
    businessUnitKey: "additives" as BusinessUnitKey,
    buyerKey: "additivesOps" as BuyerKey,
    stakeholderKeys: ["sophie", "marco"] as UserKey[],
    baselinePrice: 2.15,
    newPrice: 1.68,
    annualVolume: 42000,
    currency: Currency.EUR,
    fxRate: 1,
    frequency: Frequency.RECURRING,
    savingDriver: "Specification Optimization",
    implementationComplexity: "Medium",
    qualificationStatus: "Approved",
    startDate: new Date("2026-01-01T00:00:00.000Z"),
    endDate: new Date("2026-08-31T00:00:00.000Z"),
    impactStartDate: new Date("2026-02-01T00:00:00.000Z"),
    impactEndDate: new Date("2026-08-31T00:00:00.000Z"),
    evidenceFileName: "clariant-anti-static-achieved.pdf",
    evidenceType: "application/pdf",
    cancellationReason: null,
  },
  {
    title: "BASF black masterbatch logistics optimization",
    description: "Switch from split monthly deliveries to full truckload calls for black masterbatch and remove peak-load freight premiums.",
    savingType: "Logistics optimization",
    phase: Phase.REALISED,
    supplierKey: "basf" as SupplierKey,
    materialKey: "blackPP" as MaterialKey,
    alternativeSupplierKey: "sabic" as SupplierKey,
    alternativeMaterialManualName: null,
    categoryKey: "packaging" as CategoryKey,
    plantKey: "almere" as PlantKey,
    businessUnitKey: "masterbatch" as BusinessUnitKey,
    buyerKey: "luca" as BuyerKey,
    stakeholderKeys: ["helen", "marco"] as UserKey[],
    baselinePrice: 2.95,
    newPrice: 2.61,
    annualVolume: 220000,
    currency: Currency.EUR,
    fxRate: 1,
    frequency: Frequency.RECURRING,
    savingDriver: "Logistics Optimization",
    implementationComplexity: "Low",
    qualificationStatus: "Approved",
    startDate: new Date("2026-01-10T00:00:00.000Z"),
    endDate: new Date("2026-12-31T00:00:00.000Z"),
    impactStartDate: new Date("2026-02-01T00:00:00.000Z"),
    impactEndDate: new Date("2026-12-31T00:00:00.000Z"),
    evidenceFileName: "basf-black-logistics.xlsx",
    evidenceType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    cancellationReason: null,
  },
  {
    title: "Ampacet matte finish masterbatch trial",
    description: "Run comparative trials on matte finish PE masterbatch to remove solvent-intensive glossing and simplify packaging line operations.",
    savingType: "Alternative supplier",
    phase: Phase.IDEA,
    supplierKey: "ampacet" as SupplierKey,
    materialKey: "matteFinish" as MaterialKey,
    alternativeSupplierKey: "avient" as SupplierKey,
    alternativeMaterialManualName: null,
    categoryKey: "colorConcentrates" as CategoryKey,
    plantKey: "zeebrugge" as PlantKey,
    businessUnitKey: "masterbatch" as BusinessUnitKey,
    buyerKey: "packagingStrategic" as BuyerKey,
    stakeholderKeys: ["luca"] as UserKey[],
    baselinePrice: 3.62,
    newPrice: 3.31,
    annualVolume: 76000,
    currency: Currency.EUR,
    fxRate: 1,
    frequency: Frequency.ONE_TIME,
    savingDriver: "Material Substitution",
    implementationComplexity: "High",
    qualificationStatus: "Lab Testing",
    startDate: new Date("2026-05-01T00:00:00.000Z"),
    endDate: new Date("2026-10-31T00:00:00.000Z"),
    impactStartDate: new Date("2026-06-01T00:00:00.000Z"),
    impactEndDate: new Date("2026-10-31T00:00:00.000Z"),
    evidenceFileName: "ampacet-matte-finish-trial.pdf",
    evidenceType: "application/pdf",
    cancellationReason: null,
  },
  {
    title: "PolyOne flame-retardant masterbatch switch",
    description: "Attempt a switch to an alternative supplier for flame-retardant ABS masterbatch, then retire the current incumbent contract.",
    savingType: "Supplier Change",
    phase: Phase.CANCELLED,
    supplierKey: "polyOne" as SupplierKey,
    materialKey: "flameRetardant" as MaterialKey,
    alternativeSupplierKey: "dow" as SupplierKey,
    alternativeMaterialManualName: null,
    categoryKey: "additiveBlends" as CategoryKey,
    plantKey: "antwerp" as PlantKey,
    businessUnitKey: "additives" as BusinessUnitKey,
    buyerKey: "additivesOps" as BuyerKey,
    stakeholderKeys: ["sophie", "helen"] as UserKey[],
    baselinePrice: 7.5,
    newPrice: 7.1,
    annualVolume: 58000,
    currency: Currency.EUR,
    fxRate: 1,
    frequency: Frequency.ONE_TIME,
    savingDriver: "Supplier Change",
    implementationComplexity: "Strategic",
    qualificationStatus: "Rejected",
    startDate: new Date("2026-01-15T00:00:00.000Z"),
    endDate: new Date("2026-06-30T00:00:00.000Z"),
    impactStartDate: new Date("2026-04-01T00:00:00.000Z"),
    impactEndDate: new Date("2026-06-30T00:00:00.000Z"),
    evidenceFileName: "polyone-flame-retardant-cancelled.docx",
    evidenceType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    cancellationReason: "Prototype test showed unacceptable odor and migration risk; project paused.",
  },
  {
    title: "Arkema food-safe black masterbatch qualification",
    description: "Introduce a food-safe black masterbatch with reduced pigment loading while preserving thermal stability in hot-fill applications.",
    savingType: "Quality improvement",
    phase: Phase.REALISED,
    supplierKey: "arkema" as SupplierKey,
    materialKey: "foodSafeBlack" as MaterialKey,
    alternativeSupplierKey: null,
    alternativeMaterialManualName: "Food-safe replacement concentrate",
    categoryKey: "recycledContent" as CategoryKey,
    plantKey: "leipzig" as PlantKey,
    businessUnitKey: "additives" as BusinessUnitKey,
    buyerKey: "packagingStrategic" as BuyerKey,
    stakeholderKeys: ["marco", "sophie"] as UserKey[],
    baselinePrice: 5.05,
    newPrice: 4.63,
    annualVolume: 52000,
    currency: Currency.EUR,
    fxRate: 1,
    frequency: Frequency.RECURRING,
    savingDriver: "Qualification",
    implementationComplexity: "Strategic",
    qualificationStatus: "Approved",
    startDate: new Date("2026-02-01T00:00:00.000Z"),
    endDate: new Date("2026-11-30T00:00:00.000Z"),
    impactStartDate: new Date("2026-04-01T00:00:00.000Z"),
    impactEndDate: new Date("2026-11-30T00:00:00.000Z"),
    evidenceFileName: "arkema-food-safe-qualification.pdf",
    evidenceType: "application/pdf",
    cancellationReason: null,
  },
  {
    title: "Mane recycled-content masterbatch transition",
    description: "Qualify recycled-content masterbatch at two plants to meet sustainability targets while maintaining current mechanical performance envelope.",
    savingType: "Material Substitution",
    phase: Phase.VALIDATED,
    supplierKey: "mane" as SupplierKey,
    materialKey: "recycledBlend" as MaterialKey,
    alternativeSupplierKey: "avient" as SupplierKey,
    alternativeMaterialManualName: null,
    categoryKey: "recycledContent" as CategoryKey,
    plantKey: "almere" as PlantKey,
    businessUnitKey: "masterbatch" as BusinessUnitKey,
    buyerKey: "luca" as BuyerKey,
    stakeholderKeys: ["sophie", "marco", "luca"] as UserKey[],
    baselinePrice: 2.98,
    newPrice: 2.59,
    annualVolume: 128000,
    currency: Currency.EUR,
    fxRate: 1,
    frequency: Frequency.RECURRING,
    savingDriver: "Qualification",
    implementationComplexity: "Medium",
    qualificationStatus: "Plant Trial",
    startDate: new Date("2026-03-15T00:00:00.000Z"),
    endDate: new Date("2027-03-14T00:00:00.000Z"),
    impactStartDate: new Date("2026-06-01T00:00:00.000Z"),
    impactEndDate: new Date("2027-03-14T00:00:00.000Z"),
    evidenceFileName: "mane-recycled-transition.xlsx",
    evidenceType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    cancellationReason: null,
  },
  {
    title: "LyondellBasell high-impact masterbatch hedge",
    description: "Introduce high-impact PE color masterbatch on a hedged three-year contract with indexed freight terms to smooth annual budget variance.",
    savingType: "Contract index optimization",
    phase: Phase.IDEA,
    supplierKey: "lyondell" as SupplierKey,
    materialKey: "highImpact" as MaterialKey,
    alternativeSupplierKey: "clariant" as SupplierKey,
    alternativeMaterialManualName: null,
    categoryKey: "rawMaterials" as CategoryKey,
    plantKey: "zeebrugge" as PlantKey,
    businessUnitKey: "masterbatch" as BusinessUnitKey,
    buyerKey: "additivesOps" as BuyerKey,
    stakeholderKeys: ["helen"] as UserKey[],
    baselinePrice: 4.4,
    newPrice: 4.14,
    annualVolume: 104000,
    currency: Currency.EUR,
    fxRate: 1,
    frequency: Frequency.MULTI_YEAR,
    savingDriver: "Negotiation",
    implementationComplexity: "Low",
    qualificationStatus: "Not Started",
    startDate: new Date("2026-08-01T00:00:00.000Z"),
    endDate: new Date("2028-07-31T00:00:00.000Z"),
    impactStartDate: new Date("2027-01-01T00:00:00.000Z"),
    impactEndDate: new Date("2028-07-31T00:00:00.000Z"),
    evidenceFileName: "lyondell-high-impact-hedge.pdf",
    evidenceType: "application/pdf",
    cancellationReason: null,
  },
  {
    title: "SABIC translucent clear masterbatch streamlining",
    description: "Consolidate three translucent clear masterbatch feed lines into a single qualified SABIC offering while preserving approved film optics.",
    savingType: "Supplier consolidation",
    phase: Phase.ACHIEVED,
    supplierKey: "sabic" as SupplierKey,
    materialKey: "translucentClear" as MaterialKey,
    alternativeSupplierKey: null,
    alternativeMaterialManualName: "Translucent clear alternative blend",
    categoryKey: "colorConcentrates" as CategoryKey,
    plantKey: "rotterdam" as PlantKey,
    businessUnitKey: "masterbatch" as BusinessUnitKey,
    buyerKey: "luca" as BuyerKey,
    stakeholderKeys: ["sophie", "luca"] as UserKey[],
    baselinePrice: 3.95,
    newPrice: 3.67,
    annualVolume: 93000,
    currency: Currency.EUR,
    fxRate: 1,
    frequency: Frequency.RECURRING,
    savingDriver: "Supplier Change",
    implementationComplexity: "Medium",
    qualificationStatus: "Approved",
    startDate: new Date("2026-01-01T00:00:00.000Z"),
    endDate: new Date("2026-12-31T00:00:00.000Z"),
    impactStartDate: new Date("2026-02-15T00:00:00.000Z"),
    impactEndDate: new Date("2026-12-31T00:00:00.000Z"),
    evidenceFileName: "sabic-translucent-achieved.pdf",
    evidenceType: "application/pdf",
    cancellationReason: null,
  },
  {
    title: "Eastman UV-stable transparent masterbatch dual source",
    description: "Create a validated secondary UV-stable transparent masterbatch source to reduce exposure risk and improve continuity.",
    savingType: "Risk mitigation",
    phase: Phase.IDEA,
    supplierKey: "eastman" as SupplierKey,
    materialKey: "antiUV" as MaterialKey,
    alternativeSupplierKey: "lyondell" as SupplierKey,
    alternativeMaterialManualName: null,
    categoryKey: "additiveBlends" as CategoryKey,
    plantKey: "antwerp" as PlantKey,
    businessUnitKey: "additives" as BusinessUnitKey,
    buyerKey: "additivesOps" as BuyerKey,
    stakeholderKeys: ["marco"] as UserKey[],
    baselinePrice: 5.9,
    newPrice: 5.48,
    annualVolume: 86000,
    currency: Currency.EUR,
    fxRate: 1,
    frequency: Frequency.ONE_TIME,
    savingDriver: "Risk Reduction",
    implementationComplexity: "High",
    qualificationStatus: "Lab Testing",
    startDate: new Date("2026-06-01T00:00:00.000Z"),
    endDate: new Date("2026-12-31T00:00:00.000Z"),
    impactStartDate: new Date("2026-09-01T00:00:00.000Z"),
    impactEndDate: new Date("2026-12-31T00:00:00.000Z"),
    evidenceFileName: "eastman-uv-transparent-sourcing.pdf",
    evidenceType: "application/pdf",
    cancellationReason: null,
  },
  {
    title: "Dow anti-corrosion clear additive masterbatch",
    description: "Pilot an anti-corrosion additive masterbatch with reduced dosage and better long-term shelf stability for high-humidity packaging lines.",
    savingType: "Demand reduction",
    phase: Phase.VALIDATED,
    supplierKey: "dow" as SupplierKey,
    materialKey: "antiCorrosion" as MaterialKey,
    alternativeSupplierKey: "arkema" as SupplierKey,
    alternativeMaterialManualName: null,
    categoryKey: "additiveBlends" as CategoryKey,
    plantKey: "almere" as PlantKey,
    businessUnitKey: "additives" as BusinessUnitKey,
    buyerKey: "additivesOps" as BuyerKey,
    stakeholderKeys: ["sophie", "helen"] as UserKey[],
    baselinePrice: 6.35,
    newPrice: 5.9,
    annualVolume: 61000,
    currency: Currency.EUR,
    fxRate: 1,
    frequency: Frequency.RECURRING,
    savingDriver: "Specification Optimization",
    implementationComplexity: "Strategic",
    qualificationStatus: "Plant Trial",
    startDate: new Date("2026-04-01T00:00:00.000Z"),
    endDate: new Date("2026-12-31T00:00:00.000Z"),
    impactStartDate: new Date("2026-06-01T00:00:00.000Z"),
    impactEndDate: new Date("2026-12-31T00:00:00.000Z"),
    evidenceFileName: "dow-anti-corrosion-trial.docx",
    evidenceType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    cancellationReason: null,
  },
  {
    title: "Avient white-to-natural tint masterbatch conversion",
    description: "Replace legacy white masterbatch with Avient natural tinting and lower application dose to save material while meeting spec.",
    savingType: "Demand reduction",
    phase: Phase.ACHIEVED,
    supplierKey: "avient" as SupplierKey,
    materialKey: "whitePE" as MaterialKey,
    alternativeSupplierKey: "sabic" as SupplierKey,
    alternativeMaterialManualName: null,
    categoryKey: "colorConcentrates" as CategoryKey,
    plantKey: "rotterdam" as PlantKey,
    businessUnitKey: "masterbatch" as BusinessUnitKey,
    buyerKey: "packagingStrategic" as BuyerKey,
    stakeholderKeys: ["luca", "marco"] as UserKey[],
    baselinePrice: 4.58,
    newPrice: 4.22,
    annualVolume: 173000,
    currency: Currency.EUR,
    fxRate: 1,
    frequency: Frequency.RECURRING,
    savingDriver: "Demand Reduction",
    implementationComplexity: "Medium",
    qualificationStatus: "Approved",
    startDate: new Date("2026-02-15T00:00:00.000Z"),
    endDate: new Date("2026-12-31T00:00:00.000Z"),
    impactStartDate: new Date("2026-03-15T00:00:00.000Z"),
    impactEndDate: new Date("2026-12-31T00:00:00.000Z"),
    evidenceFileName: "avient-white-to-natural-achieved.pdf",
    evidenceType: "application/pdf",
    cancellationReason: null,
  },
  {
    title: "Ampacet biopolymer-compatible masterbatch pilot",
    description: "Evaluate biopolymer-compatible masterbatch for premium lines; suspend if certification body rejects migration profile.",
    savingType: "Specification change",
    phase: Phase.CANCELLED,
    supplierKey: "ampacet" as SupplierKey,
    materialKey: "functionalClear" as MaterialKey,
    alternativeSupplierKey: "arkema" as SupplierKey,
    alternativeMaterialManualName: null,
    categoryKey: "additiveBlends" as CategoryKey,
    plantKey: "leipzig" as PlantKey,
    businessUnitKey: "additives" as BusinessUnitKey,
    buyerKey: "additivesOps" as BuyerKey,
    stakeholderKeys: ["sophie", "helen"] as UserKey[],
    baselinePrice: 8.2,
    newPrice: 7.55,
    annualVolume: 39000,
    currency: Currency.EUR,
    fxRate: 1,
    frequency: Frequency.ONE_TIME,
    savingDriver: "Material Substitution",
    implementationComplexity: "Strategic",
    qualificationStatus: "Rejected",
    startDate: new Date("2026-03-01T00:00:00.000Z"),
    endDate: new Date("2026-08-31T00:00:00.000Z"),
    impactStartDate: new Date("2026-05-01T00:00:00.000Z"),
    impactEndDate: new Date("2026-08-31T00:00:00.000Z"),
    evidenceFileName: "ampacet-bio-pilot-cancelled.xlsx",
    evidenceType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    cancellationReason: "Certification review rejected due to unresolved migration stability concerns.",
  },
  {
    title: "Mane high-impact PE rollout optimization",
    description: "Optimize line settings and dosing points for Mane high-impact PE masterbatch to reduce color variation and waste.",
    savingType: "Implementation optimization",
    phase: Phase.VALIDATED,
    supplierKey: "mane" as SupplierKey,
    materialKey: "highImpact" as MaterialKey,
    alternativeSupplierKey: "clariant" as SupplierKey,
    alternativeMaterialManualName: null,
    categoryKey: "rawMaterials" as CategoryKey,
    plantKey: "zeebrugge" as PlantKey,
    businessUnitKey: "masterbatch" as BusinessUnitKey,
    buyerKey: "luca" as BuyerKey,
    stakeholderKeys: ["marco", "luca"] as UserKey[],
    baselinePrice: 3.9,
    newPrice: 3.62,
    annualVolume: 102000,
    currency: Currency.EUR,
    fxRate: 1,
    frequency: Frequency.RECURRING,
    savingDriver: "Implementation Optimization",
    implementationComplexity: "High",
    qualificationStatus: "Plant Trial",
    startDate: new Date("2026-01-25T00:00:00.000Z"),
    endDate: new Date("2026-12-31T00:00:00.000Z"),
    impactStartDate: new Date("2026-03-01T00:00:00.000Z"),
    impactEndDate: new Date("2026-12-31T00:00:00.000Z"),
    evidenceFileName: "mane-high-impact-optimization.pdf",
    evidenceType: "application/pdf",
    cancellationReason: null,
  },
  {
    title: "PE carrier formulation optimization",
    description: "Reduce PE carrier cost through formulation adjustment.",
    savingType: "Specification change",
    phase: Phase.REALISED,
    supplierKey: "basf" as SupplierKey,
    materialKey: "peCarrier" as MaterialKey,
    alternativeSupplierKey: null,
    alternativeMaterialManualName: "Optimized PE mix",
    categoryKey: "rawMaterials" as CategoryKey,
    plantKey: "almere" as PlantKey,
    businessUnitKey: "masterbatch" as BusinessUnitKey,
    buyerKey: "luca" as BuyerKey,
    stakeholderKeys: ["marco"] as UserKey[],
    baselinePrice: 5.5,
    newPrice: 5.0,
    annualVolume: 140000,
    currency: Currency.EUR,
    fxRate: 1,
    frequency: Frequency.RECURRING,
    savingDriver: "Formulation optimization",
    implementationComplexity: "Medium",
    qualificationStatus: "Approved",
    startDate: new Date("2026-01-01T00:00:00.000Z"),
    endDate: new Date("2026-12-31T00:00:00.000Z"),
    impactStartDate: new Date("2026-03-01T00:00:00.000Z"),
    impactEndDate: new Date("2026-12-31T00:00:00.000Z"),
    evidenceFileName: "pe-carrier-optimization.docx",
    evidenceType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    cancellationReason: null,
  },
] as const;

async function clearExistingData() {
  await prisma.phaseChangeRequestApproval.deleteMany();
  await prisma.phaseChangeRequest.deleteMany();
  await prisma.approval.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.phaseHistory.deleteMany();
  await prisma.savingCardComment.deleteMany();
  await prisma.savingCardAlternativeMaterial.deleteMany();
  await prisma.savingCardAlternativeSupplier.deleteMany();
  await prisma.savingCardEvidence.deleteMany();
  await prisma.savingCardStakeholder.deleteMany();
  await prisma.savingCard.deleteMany();
  await prisma.annualTarget.deleteMany();
  await prisma.fxRate.deleteMany();
  await prisma.buyer.deleteMany();
  await prisma.businessUnit.deleteMany();
  await prisma.plant.deleteMany();
  await prisma.category.deleteMany();
  await prisma.material.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();
}

async function upsertOrganization() {
  return prisma.organization.upsert({
    where: { slug: "demo-org" },
    update: {},
    create: {
      name: "Demo Org",
      slug: "demo-org",
    },
  });
}

async function upsertUsers(organizationId: string): Promise<IdLookup<UserKey>> {
  const upsertedUsers = {} as IdLookup<UserKey>;

  for (const [key, user] of Object.entries(userSeeds) as [UserKey, (typeof userSeeds)[UserKey]][]) {
    const created = await prisma.user.upsert({
      where: {
        organizationId_email: {
          organizationId,
          email: user.email,
        },
      },
      update: {
        name: user.name,
        role: user.role,
      },
      create: {
        organizationId,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

    upsertedUsers[key] = { id: created.id, name: created.name };
  }

  return upsertedUsers;
}

async function upsertBuyers(organizationId: string): Promise<IdLookup<BuyerKey>> {
  const upsertedBuyers = {} as IdLookup<BuyerKey>;

  for (const [key, buyer] of Object.entries(buyerSeeds) as [BuyerKey, (typeof buyerSeeds)[BuyerKey]][]) {
    const created = await prisma.buyer.upsert({
      where: {
        organizationId_name: {
          organizationId,
          name: buyer.name,
        },
      },
      update: {},
      create: {
        organizationId,
        name: buyer.name,
        email: null,
      },
    });

    upsertedBuyers[key] = { id: created.id, name: created.name };
  }

  return upsertedBuyers;
}

async function upsertSuppliers(organizationId: string): Promise<IdLookup<SupplierKey>> {
  const upsertedSuppliers = {} as IdLookup<SupplierKey>;

  for (const [key, supplier] of Object.entries(supplierSeeds) as [SupplierKey, (typeof supplierSeeds)[SupplierKey]][]) {
    const created = await prisma.supplier.upsert({
      where: {
        organizationId_name: {
          organizationId,
          name: supplier.name,
        },
      },
      update: {},
      create: {
        organizationId,
        name: supplier.name,
      },
    });

    upsertedSuppliers[key] = { id: created.id, name: created.name };
  }

  return upsertedSuppliers;
}

async function upsertMaterials(organizationId: string): Promise<IdLookup<MaterialKey>> {
  const upsertedMaterials = {} as IdLookup<MaterialKey>;

  for (const [key, material] of Object.entries(materialSeeds) as [MaterialKey, (typeof materialSeeds)[MaterialKey]][]) {
    const created = await prisma.material.upsert({
      where: {
        organizationId_name: {
          organizationId,
          name: material.name,
        },
      },
      update: {},
      create: {
        organizationId,
        name: material.name,
      },
    });

    upsertedMaterials[key] = { id: created.id, name: created.name };
  }

  return upsertedMaterials;
}

async function upsertCategories(organizationId: string): Promise<IdLookup<CategoryKey>> {
  const upsertedCategories = {} as IdLookup<CategoryKey>;

  for (const [key, category] of Object.entries(categorySeeds) as [CategoryKey, (typeof categorySeeds)[CategoryKey]][]) {
    const created = await prisma.category.upsert({
      where: {
        organizationId_name: {
          organizationId,
          name: category.name,
        },
      },
      update: {},
      create: {
        organizationId,
        name: category.name,
        annualTarget: 0,
      },
    });

    upsertedCategories[key] = { id: created.id, name: created.name };
  }

  return upsertedCategories;
}

async function upsertPlants(organizationId: string): Promise<IdLookup<PlantKey>> {
  const upsertedPlants = {} as IdLookup<PlantKey>;

  for (const [key, plant] of Object.entries(plantSeeds) as [PlantKey, (typeof plantSeeds)[PlantKey]][]) {
    const created = await prisma.plant.upsert({
      where: {
        organizationId_name: {
          organizationId,
          name: plant.name,
        },
      },
      update: {
        region: plant.region,
      },
      create: {
        organizationId,
        name: plant.name,
        region: plant.region,
      },
      });

    upsertedPlants[key] = { id: created.id, name: created.name };
  }

  return upsertedPlants;
}

async function upsertBusinessUnits(organizationId: string): Promise<IdLookup<BusinessUnitKey>> {
  const upsertedBusinessUnits = {} as IdLookup<BusinessUnitKey>;

  for (const [key, unit] of Object.entries(businessUnitSeeds) as [BusinessUnitKey, (typeof businessUnitSeeds)[BusinessUnitKey]][]) {
    const created = await prisma.businessUnit.upsert({
      where: {
        organizationId_name: {
          organizationId,
          name: unit.name,
        },
      },
      update: {},
      create: {
        organizationId,
        name: unit.name,
      },
    });

    upsertedBusinessUnits[key] = { id: created.id, name: created.name };
  }

  return upsertedBusinessUnits;
}

function buildPhaseHistory(phase: Phase, users: IdLookup<UserKey>) {
  const history: Array<{
    fromPhase: Phase | null;
    toPhase: Phase;
    changedById: string;
  }> = [
    {
      fromPhase: null,
      toPhase: Phase.IDEA,
      changedById: users.luca.id,
    },
  ];

  if (phase === Phase.VALIDATED || phase === Phase.REALISED || phase === Phase.ACHIEVED) {
    history.push({
      fromPhase: Phase.IDEA,
      toPhase: Phase.VALIDATED,
      changedById: users.sophie.id,
    });
  }

  if (phase === Phase.REALISED || phase === Phase.ACHIEVED) {
    history.push({
      fromPhase: Phase.VALIDATED,
      toPhase: Phase.REALISED,
      changedById: users.marco.id,
    });
  }

  if (phase === Phase.ACHIEVED) {
    history.push({
      fromPhase: Phase.REALISED,
      toPhase: Phase.ACHIEVED,
      changedById: users.helen.id,
    });
  }

  if (phase === Phase.CANCELLED) {
    history.push({
      fromPhase: Phase.IDEA,
      toPhase: Phase.CANCELLED,
      changedById: users.helen.id,
    });
  }

  return history;
}

function buildApprovals(
  savingCardId: string,
  phase: Phase,
  users: IdLookup<UserKey>
) {
  const approvals: Array<{
    savingCardId: string;
    approverId: string;
    phase: Phase;
    approved: boolean;
    status: ApprovalStatus;
    comment: string;
  }> = [];

  if (phase === Phase.VALIDATED || phase === Phase.REALISED || phase === Phase.ACHIEVED) {
    approvals.push({
      savingCardId,
      approverId: users.sophie.id,
      phase: Phase.VALIDATED,
      approved: true,
      status: ApprovalStatus.APPROVED,
      comment: "Seeded approval",
    });
  }

  if (phase === Phase.REALISED || phase === Phase.ACHIEVED) {
    approvals.push({
      savingCardId,
      approverId: users.marco.id,
      phase: Phase.REALISED,
      approved: true,
      status: ApprovalStatus.APPROVED,
      comment: "Seeded approval",
    });
  }

  if (phase === Phase.ACHIEVED) {
    approvals.push({
      savingCardId,
      approverId: users.helen.id,
      phase: Phase.ACHIEVED,
      approved: true,
      status: ApprovalStatus.APPROVED,
      comment: "Seeded approval",
    });
  }

  return approvals;
}

async function createPendingWorkflow(
  createdCards: Record<string, { id: string }>,
  users: IdLookup<UserKey>
) {
  const card = createdCards["BASF TiO2 renegotiation"];
  if (!card) return;

  await prisma.phaseChangeRequest.create({
    data: {
      savingCardId: card.id,
      currentPhase: Phase.IDEA,
      requestedPhase: Phase.VALIDATED,
      requestedById: users.luca.id,
      approvalStatus: ApprovalStatus.PENDING,
      comment: "Please review seeded transition request.",
      approvals: {
        create: [
          {
            approverId: users.sophie.id,
            role: Role.GLOBAL_CATEGORY_LEADER,
            status: ApprovalStatus.PENDING,
          },
        ],
      },
    },
  });

  await prisma.notification.create({
    data: {
      userId: users.sophie.id,
      title: "Phase change approval required",
      message: "BASF TiO2 renegotiation requests movement from IDEA to VALIDATED.",
    },
  });
}

async function main() {
  await clearExistingData();

  const organization = await upsertOrganization();

  const users = await upsertUsers(organization.id);
  const buyers = await upsertBuyers(organization.id);
  const businessUnits = await upsertBusinessUnits(organization.id);
  const categories = await upsertCategories(organization.id);
  const plants = await upsertPlants(organization.id);
  const suppliers = await upsertSuppliers(organization.id);
  const materials = await upsertMaterials(organization.id);

  await prisma.fxRate.createMany({
    data: fxRatesSeed.map((rate) => ({ ...rate })),
  });

  await prisma.annualTarget.createMany({
    data: annualTargetsSeed.map((target) => ({
      organizationId: organization.id,
      year: target.year,
      targetValue: target.targetValue,
      categoryId: target.categoryKey ? categories[target.categoryKey as CategoryKey].id : null,
    })),
  });

  const createdCards: Record<string, { id: string }> = {};

  for (const card of savingCardsSeed) {
    const savings = calculateSavings({
      baselinePrice: card.baselinePrice,
      newPrice: card.newPrice,
      annualVolume: card.annualVolume,
      currency: card.currency,
      fxRate: card.fxRate,
    });

    const created = await prisma.savingCard.create({
      data: {
        organizationId: organization.id,
        title: card.title,
        description: card.description,
        savingType: card.savingType,
        phase: card.phase,
        supplierId: suppliers[card.supplierKey].id,
        materialId: materials[card.materialKey].id,
        alternativeSupplierId: card.alternativeSupplierKey
          ? suppliers[card.alternativeSupplierKey].id
          : null,
        alternativeSupplierManualName: null,
        alternativeMaterialId: null,
        alternativeMaterialManualName: card.alternativeMaterialManualName ?? null,
        categoryId: categories[card.categoryKey].id,
        plantId: plants[card.plantKey].id,
        businessUnitId: businessUnits[card.businessUnitKey].id,
        buyerId: buyers[card.buyerKey].id,
        baselinePrice: card.baselinePrice,
        newPrice: card.newPrice,
        annualVolume: card.annualVolume,
        currency: card.currency,
        fxRate: card.fxRate,
        calculatedSavings: savings.savingsEUR,
        calculatedSavingsUSD: savings.savingsUSD,
        frequency: card.frequency,
        savingDriver: card.savingDriver,
        implementationComplexity: card.implementationComplexity,
        qualificationStatus: card.qualificationStatus,
        startDate: card.startDate,
        endDate: card.endDate,
        impactStartDate: card.impactStartDate,
        impactEndDate: card.impactEndDate,
        financeLocked: card.phase === "REALISED" || card.phase === "ACHIEVED",
        cancellationReason: card.cancellationReason ?? null,
        stakeholders: {
          create: card.stakeholderKeys.map((stakeholderKey) => ({
            userId: users[stakeholderKey].id,
          })),
        },
        comments: {
          create: {
            authorId: users.luca.id,
            body: `Seeded demo case for ${card.title.toLowerCase()}.`,
          },
        },
        phaseHistory: {
          create: buildPhaseHistory(card.phase, users),
        },
        auditLogs: {
          create: {
            userId: users.luca.id,
            action: "saving_card.seeded",
            detail: `Seeded demo saving card in ${card.phase} phase`,
          },
        },
      },
    });

    createdCards[card.title] = { id: created.id };

    await prisma.savingCardEvidence.create({
      data: {
        savingCardId: created.id,
        fileName: card.evidenceFileName,
        storageBucket: getEvidenceStorageBucketName(),
        storagePath: buildSeedEvidenceStoragePath(organization.id, created.id, card.evidenceFileName),
        fileSize: 245760,
        fileType: card.evidenceType,
        uploadedById: users.luca.id,
      },
    });

    const approvals = buildApprovals(created.id, card.phase, users);
    if (approvals.length) {
      await prisma.approval.createMany({ data: approvals });
    }
  }

  await createPendingWorkflow(createdCards, users);

  console.log(`Seed completed for organization: ${organization.name}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
