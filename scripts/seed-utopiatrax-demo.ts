import { pathToFileURL } from "node:url";

import {
  ApprovalStatus,
  Currency,
  EvidenceType,
  ForecastSource,
  Frequency,
  MembershipStatus,
  OrganizationRole,
  Phase,
  Prisma,
  PrismaClient,
  Role,
  SavingType,
  SavingsBudgetImpact,
  SavingsImpactRecurrence,
  SavingsImpactType,
  SubscriptionStatus,
} from "@prisma/client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { calculateSavings, calculatePeriodizedSavings } from "../lib/calculations";
import { auditEventTypes } from "../lib/audit";
import { invalidatePortfolioSurfaceCaches } from "../lib/workspace/portfolio-surface-cache";
import {
  getUtopiaTraxResetSafetyViolations,
  UTOPIATRAX_DEMO_NAME,
  UTOPIATRAX_DEMO_SLUG,
  UTOPIATRAX_SHOWCASE_CARD_TITLE,
  validateUtopiaTraxStaticContract,
} from "./utopiatrax-demo-contract";

const DEMO_WORKSPACE_NAME = UTOPIATRAX_DEMO_NAME;
const DEMO_WORKSPACE_SLUG = UTOPIATRAX_DEMO_SLUG;
const DEMO_PASSWORD = "Traxium123!";
const UTOPIATRAX_FISCAL_YEAR_START_MONTH = 1;
const DEMO_STORAGE_BUCKET = "evidence-private";
const DEMO_BILLING_CUSTOMER_ID = "cus_demo_utopiatrax";
const DEMO_SUBSCRIPTION_ID = "sub_demo_utopiatrax";
const DEMO_TRIAL_END = new Date("2028-12-31T23:59:59.000Z");
const DEMO_YEAR = 2026;
const EUR_TO_USD_RATE = 1.08;
const SUPABASE_OPERATION_TIMEOUT_MS = 5_000;
let storageUploadFailureSeen = false;

export const UTOPIATRAX_DEMO_TRIAL_END = DEMO_TRIAL_END;
export { UTOPIATRAX_SHOWCASE_CARD_TITLE };

type DemoUserSeed = {
  email: string;
  name: string;
  role: Role;
  membershipRole: OrganizationRole;
};

type NamedSeed = {
  name: string;
};

type BuyerSeed = NamedSeed & {
  email?: string;
};

type PlantSeed = NamedSeed & {
  region: string;
};

type DirectCategorySeed = NamedSeed & {
  annualTarget: number;
};

type EvidenceSeed = {
  fileName: string;
  label: string;
  content: string;
  evidenceType: EvidenceType;
};

type AlternativeScenarioSeed = {
  supplierName: string;
  materialName?: string;
  country: string;
  quotedPrice: number;
  currency: Currency;
  leadTimeDays: number;
  moq: number;
  paymentTerms: string;
  qualityRating: string;
  riskLevel: "Low" | "Medium" | "High" | "Critical";
  qualificationStatus: "Not Started" | "Lab Testing" | "Plant Trial" | "Approved" | "Rejected";
  performanceImpact: string;
  notes: string;
  isSelected: boolean;
};

type VolumeProfile = "on-track" | "behind" | "ahead";

export type UtopiaTraxSavingCardSeed = {
  title: string;
  categoryName: string;
  phase: Phase;
  supplierName: string;
  alternativeSupplierName?: string;
  materialName: string;
  buyerName: string;
  plantName: string;
  businessUnitName: string;
  baselinePrice: number;
  newPrice: number;
  referencePrice?: number;
  annualVolume: number;
  currency: Currency;
  impactStart: string;
  impactEnd: string;
  narrative: string;
  legacySavingsMethod: string;
  savingType: SavingType;
  impactType: SavingsImpactType;
  impactRecurrence: SavingsImpactRecurrence;
  budgetImpact: SavingsBudgetImpact;
  savingDriver: string;
  implementationComplexity: string;
  qualificationStatus: string;
  financeLocked?: boolean;
  cancellationReason?: string;
  evidence: EvidenceSeed[];
  alternative?: AlternativeScenarioSeed;
  volumeProfile?: VolumeProfile;
};

type UtopiaTraxSavingCardBaseSeed = Omit<
  UtopiaTraxSavingCardSeed,
  "savingType" | "impactType" | "impactRecurrence" | "budgetImpact"
>;

type IdName = {
  id: string;
  name: string;
};

type SeedLookup = Record<string, IdName>;

type UserLookupRecord = IdName & {
  email: string;
  role: Role;
};

type UserLookup = Record<string, UserLookupRecord>;

export type UtopiaTraxDatasetSummary = {
  savingCardCount: number;
  directCategoryCount: number;
  supplierCount: number;
  materialCount: number;
  userCount: number;
  evidenceCount: number;
  alternativeCount: number;
  costAvoidanceCardCount: number;
  midYearImpactStartCount: number;
  volumeProfileCount: number;
  pendingPhaseRequestCount: number;
  expectedPendingOpenActions: number;
  phaseCounts: Record<Phase, number>;
  savingTypeCounts: Record<SavingType, number>;
  impactTypeCounts: Record<SavingsImpactType, number>;
  recurrenceCounts: Record<SavingsImpactRecurrence, number>;
  budgetImpactCounts: Record<SavingsBudgetImpact, number>;
  categoriesRepresented: string[];
  financeLockedViolations: string[];
  unknownCategoryCards: string[];
  duplicateCardTitles: string[];
  duplicateCategoryNames: string[];
};

export type UtopiaTraxSeedResult = {
  organizationId: string;
  organizationName: string;
  users: number;
  categories: number;
  suppliers: number;
  materials: number;
  buyers: number;
  plants: number;
  businessUnits: number;
  savingCards: number;
  evidenceRecords: number;
  evidenceFilesUploaded: number;
  alternatives: number;
  phaseHistoryEntries: number;
  approvalRecords: number;
  phaseChangeRequests: number;
  pendingOpenActions: number;
  volumeForecastRows: number;
  volumeActualRows: number;
  authUsersCreatedOrUpdated: number;
  authSkipped: boolean;
  storageSkipped: boolean;
  warnings: string[];
};

export const UTOPIATRAX_DEMO_USERS: readonly DemoUserSeed[] = [
  {
    email: "taylaniscan+4@gmail.com",
    name: "Taylan Iscan",
    role: Role.HEAD_OF_GLOBAL_PROCUREMENT,
    membershipRole: OrganizationRole.OWNER,
  },
  {
    email: "taylaniscan+5@gmail.com",
    name: "Mert Dulger",
    role: Role.FINANCIAL_CONTROLLER,
    membershipRole: OrganizationRole.ADMIN,
  },
  {
    email: "taylaniscan+6@gmail.com",
    name: "Aylin Demir",
    role: Role.GLOBAL_CATEGORY_LEADER,
    membershipRole: OrganizationRole.MEMBER,
  },
  {
    email: "taylaniscan+7@gmail.com",
    name: "Can Kaya",
    role: Role.TACTICAL_BUYER,
    membershipRole: OrganizationRole.MEMBER,
  },
] as const;

export const UTOPIATRAX_DIRECT_CATEGORIES: readonly DirectCategorySeed[] = [
  { name: "Polymer Carriers", annualTarget: 260000 },
  { name: "TiO2 & White Pigments", annualTarget: 230000 },
  { name: "Organic Pigments & Dyes", annualTarget: 185000 },
  { name: "Additives & Stabilizers", annualTarget: 170000 },
  { name: "Packaging Materials", annualTarget: 135000 },
  { name: "Tolling & Subcontracted Processing", annualTarget: 95000 },
] as const;

export const UTOPIATRAX_SUPPLIERS: readonly NamedSeed[] = [
  { name: "Borealis Polymers" },
  { name: "Sabic Europe" },
  { name: "LyondellBasell" },
  { name: "TotalEnergies Polymers" },
  { name: "RePolymers Circular" },
  { name: "Kronos Pigments" },
  { name: "Venator Materials" },
  { name: "Heubach Colorants" },
  { name: "DIC Pigments" },
  { name: "Lanxess Inorganics" },
  { name: "Shepherd Color" },
  { name: "Orion Carbon" },
  { name: "BASF Additives" },
  { name: "SI Group" },
  { name: "Clariant Additives" },
  { name: "Avient Additives" },
  { name: "PMC Organometallix" },
  { name: "Mondi Industrial Bags" },
  { name: "Smurfit Kappa" },
  { name: "Greif Packaging" },
  { name: "LocalFlex Packaging" },
  { name: "Dutch Compounding Services" },
  { name: "Izmir Toll Processing" },
  { name: "Midwest Compounding LLC" },
  { name: "Java Polymer Services" },
] as const;

export const UTOPIATRAX_MATERIALS: readonly NamedSeed[] = [
  { name: "PP Homopolymer Carrier" },
  { name: "PE LD Carrier" },
  { name: "PET Carrier Resin" },
  { name: "Bio-based Carrier Resin" },
  { name: "Recycled PP Carrier" },
  { name: "TiO2 Rutile R-996" },
  { name: "TiO2 Chloride Grade" },
  { name: "Calcium Carbonate Filler" },
  { name: "Zinc Sulfide White Pigment" },
  { name: "Phthalocyanine Blue 15:3" },
  { name: "Quinacridone Red" },
  { name: "Diarylide Yellow" },
  { name: "Solvent Dye Red 135" },
  { name: "High Performance Green Pigment" },
  { name: "UV Stabilizer Package" },
  { name: "Antioxidant Blend" },
  { name: "Processing Aid Masterbatch" },
  { name: "Slip Additive" },
  { name: "PET Chain Extender" },
  { name: "25kg PE Bags" },
  { name: "Octabin 1000kg" },
  { name: "Stretch Film" },
  { name: "Pallet Covers" },
  { name: "FIBC Bulk Bags" },
  { name: "External Twin-Screw Compounding" },
  { name: "Color Matching Lab Service" },
  { name: "Repackaging Service" },
  { name: "Pellet Drying Service" },
] as const;

const UTOPIATRAX_BUYERS: readonly BuyerSeed[] = [
  {
    name: "Taylan Iscan",
    email: "taylaniscan+4@gmail.com",
  },
  {
    name: "Aylin Demir",
    email: "taylaniscan+6@gmail.com",
  },
  {
    name: "Can Kaya",
    email: "taylaniscan+7@gmail.com",
  },
  {
    name: "Maya Yilmaz",
    email: "maya.yilmaz@utopiatrax.demo",
  },
] as const;

const UTOPIATRAX_PLANTS: readonly PlantSeed[] = [
  { name: "Apeldoorn Plant", region: "EMEA" },
  { name: "Izmir Tolling Partner", region: "Turkey" },
  { name: "Ohio Compounding Site", region: "North America" },
  { name: "Jakarta Packaging Line", region: "APAC" },
] as const;

const UTOPIATRAX_BUSINESS_UNITS: readonly NamedSeed[] = [
  { name: "Packaging Colorants" },
  { name: "Building & Construction" },
  { name: "PET Packaging" },
  { name: "Consumer Goods" },
  { name: "Industrial Plastics" },
] as const;

function evidence(fileName: string, label: string, content: string): EvidenceSeed {
  return {
    fileName: fileName.replace(/\.txt$/iu, ".pdf"),
    label,
    content,
    evidenceType: inferEvidenceType(label),
  };
}

function inferEvidenceType(label: string): EvidenceType {
  const normalized = label.toLowerCase();

  if (normalized.includes("supplier quote") || normalized.includes("bid")) {
    return EvidenceType.SUPPLIER_QUOTE;
  }
  if (normalized.includes("price confirmation")) {
    return EvidenceType.PRICE_CONFIRMATION;
  }
  if (normalized.includes("contract") || normalized.includes("purchase order")) {
    return EvidenceType.CONTRACT_OR_PO;
  }
  if (
    normalized.includes("invoice") ||
    normalized.includes("actual") ||
    normalized.includes("implementation proof")
  ) {
    return EvidenceType.INVOICE_OR_ACTUAL;
  }
  if (normalized.includes("calculation") || normalized.includes("workbook")) {
    return EvidenceType.CALCULATION_WORKBOOK;
  }
  if (normalized.includes("technical approval")) {
    return EvidenceType.TECHNICAL_APPROVAL;
  }
  if (normalized.includes("customer approval")) {
    return EvidenceType.CUSTOMER_APPROVAL;
  }
  if (normalized.includes("rebate")) {
    return EvidenceType.REBATE_AGREEMENT;
  }
  if (normalized.includes("tolling") || normalized.includes("rate card")) {
    return EvidenceType.TOLLING_RATE_CARD;
  }
  if (normalized.includes("negotiation")) {
    return EvidenceType.NEGOTIATION_SUMMARY;
  }

  return EvidenceType.OTHER;
}

function alternative(input: AlternativeScenarioSeed): AlternativeScenarioSeed {
  return input;
}

const UTOPIATRAX_SAVING_CARD_BASE: readonly UtopiaTraxSavingCardBaseSeed[] = [
  {
    title: "PP Carrier dual-source negotiation",
    categoryName: "Polymer Carriers",
    phase: Phase.ACHIEVED,
    supplierName: "Borealis Polymers",
    alternativeSupplierName: "Sabic Europe",
    materialName: "PP Homopolymer Carrier",
    buyerName: "Aylin Demir",
    plantName: "Apeldoorn Plant",
    businessUnitName: "Packaging Colorants",
    baselinePrice: 1.42,
    newPrice: 1.31,
    annualVolume: 850000,
    currency: Currency.USD,
    impactStart: "2026-01-01",
    impactEnd: "2026-12-31",
    narrative: "Annual contract renegotiation with second-source benchmark.",
    legacySavingsMethod: "Commercial negotiation",
    savingDriver: "Dual sourcing",
    implementationComplexity: "Medium",
    qualificationStatus: "Approved",
    evidence: [
      evidence(
        "pp-carrier-supplier-quote.txt",
        "Supplier quote",
        "Sabic benchmark quote used to validate the Borealis annual carrier negotiation."
      ),
      evidence(
        "pp-carrier-negotiation-summary.txt",
        "Negotiation summary",
        "Procurement summary showing final annual price, volume commitment, and finance-reviewed baseline."
      ),
      evidence(
        "pp-carrier-price-confirmation.txt",
        "Supplier price confirmation",
        "Borealis confirmed the implemented USD 1.31 per kilogram price and annual volume commitment."
      ),
      evidence(
        "pp-carrier-calculation-workbook.txt",
        "Calculation workbook",
        "Finance bridge showing baseline price, implemented price, annual volume, and captured savings."
      ),
      evidence(
        "pp-carrier-implementation-proof.txt",
        "Implementation proof",
        "First implemented purchase receipt confirms the negotiated carrier price is active."
      ),
    ],
    alternative: alternative({
      supplierName: "Sabic Europe",
      materialName: "PP Homopolymer Carrier",
      country: "Netherlands",
      quotedPrice: 1.33,
      currency: Currency.USD,
      leadTimeDays: 14,
      moq: 24000,
      paymentTerms: "60 days net",
      qualityRating: "A",
      riskLevel: "Low",
      qualificationStatus: "Approved",
      performanceImpact: "No performance loss after plant trial.",
      notes: "Selected as credible benchmark and backup source.",
      isSelected: true,
    }),
    volumeProfile: "on-track",
  },
  {
    title: "LDPE carrier formula optimization",
    categoryName: "Polymer Carriers",
    phase: Phase.REALISED,
    supplierName: "LyondellBasell",
    alternativeSupplierName: "TotalEnergies Polymers",
    materialName: "PE LD Carrier",
    buyerName: "Can Kaya",
    plantName: "Ohio Compounding Site",
    businessUnitName: "Consumer Goods",
    baselinePrice: 1.56,
    newPrice: 1.47,
    annualVolume: 620000,
    currency: Currency.USD,
    impactStart: "2026-02-01",
    impactEnd: "2026-12-31",
    narrative: "Formula adjustment enabled equivalent performance at lower carrier cost.",
    legacySavingsMethod: "Specification optimization",
    savingDriver: "Formula redesign",
    implementationComplexity: "Medium",
    qualificationStatus: "Approved",
    evidence: [
      evidence(
        "ldpe-technical-approval-note.txt",
        "Technical approval note",
        "Technical service confirmed equivalent dispersion and melt flow performance for the optimized formula."
      ),
    ],
    alternative: alternative({
      supplierName: "TotalEnergies Polymers",
      materialName: "PE LD Carrier",
      country: "France",
      quotedPrice: 1.49,
      currency: Currency.USD,
      leadTimeDays: 21,
      moq: 22000,
      paymentTerms: "45 days net",
      qualityRating: "A-",
      riskLevel: "Medium",
      qualificationStatus: "Plant Trial",
      performanceImpact: "Equivalent in standard consumer-goods color masterbatch runs.",
      notes: "Held as a qualified fallback if LyondellBasell allocation tightens.",
      isSelected: false,
    }),
    volumeProfile: "behind",
  },
  {
    title: "PET carrier quarterly index reset",
    categoryName: "Polymer Carriers",
    phase: Phase.VALIDATED,
    supplierName: "TotalEnergies Polymers",
    materialName: "PET Carrier Resin",
    buyerName: "Aylin Demir",
    plantName: "Apeldoorn Plant",
    businessUnitName: "PET Packaging",
    baselinePrice: 1.68,
    newPrice: 1.58,
    annualVolume: 430000,
    currency: Currency.USD,
    impactStart: "2026-03-01",
    impactEnd: "2026-12-31",
    narrative: "Index-linked contract reset validated by finance.",
    legacySavingsMethod: "Index reset",
    savingDriver: "Contract indexation",
    implementationComplexity: "Low",
    qualificationStatus: "Approved",
    financeLocked: true,
    evidence: [
      evidence(
        "pet-carrier-index-confirmation.txt",
        "Index confirmation",
        "Supplier index reset confirmation and controller validation note for the 2026 PET carrier contract."
      ),
    ],
    volumeProfile: "on-track",
  },
  {
    title: "Bio-based carrier pilot sourcing",
    categoryName: "Polymer Carriers",
    phase: Phase.IDEA,
    supplierName: "RePolymers Circular",
    materialName: "Bio-based Carrier Resin",
    buyerName: "Aylin Demir",
    plantName: "Jakarta Packaging Line",
    businessUnitName: "Consumer Goods",
    baselinePrice: 2.35,
    newPrice: 2.18,
    annualVolume: 120000,
    currency: Currency.USD,
    impactStart: "2026-07-01",
    impactEnd: "2026-12-31",
    narrative: "Sustainability-led alternative carrier pilot.",
    legacySavingsMethod: "Alternative material",
    savingDriver: "Sustainability sourcing",
    implementationComplexity: "High",
    qualificationStatus: "Lab Testing",
    evidence: [],
  },
  {
    title: "Recycled PP carrier localization",
    categoryName: "Polymer Carriers",
    phase: Phase.CANCELLED,
    supplierName: "RePolymers Circular",
    materialName: "Recycled PP Carrier",
    buyerName: "Can Kaya",
    plantName: "Izmir Tolling Partner",
    businessUnitName: "Building & Construction",
    baselinePrice: 1.26,
    newPrice: 1.15,
    annualVolume: 240000,
    currency: Currency.USD,
    impactStart: "2026-04-01",
    impactEnd: "2026-12-31",
    narrative: "Canceled after inconsistent MFI results.",
    legacySavingsMethod: "Localization",
    savingDriver: "Regional sourcing",
    implementationComplexity: "High",
    qualificationStatus: "Rejected",
    cancellationReason: "Quality variation exceeded approved tolerance during validation.",
    evidence: [
      evidence(
        "recycled-pp-quality-variation-note.txt",
        "Quality variation note",
        "Lab results showed inconsistent MFI performance across three batches, leading to cancellation."
      ),
    ],
  },
  {
    title: "TiO2 chloride grade rebate",
    categoryName: "TiO2 & White Pigments",
    phase: Phase.ACHIEVED,
    supplierName: "Kronos Pigments",
    materialName: "TiO2 Chloride Grade",
    buyerName: "Taylan Iscan",
    plantName: "Apeldoorn Plant",
    businessUnitName: "Packaging Colorants",
    baselinePrice: 3.25,
    newPrice: 3.05,
    annualVolume: 390000,
    currency: Currency.USD,
    impactStart: "2026-01-01",
    impactEnd: "2026-12-31",
    narrative: "Volume aggregation improved rebate tier.",
    legacySavingsMethod: "Rebate agreement",
    savingDriver: "Volume aggregation",
    implementationComplexity: "Low",
    qualificationStatus: "Approved",
    evidence: [
      evidence(
        "tio2-rebate-agreement.txt",
        "Annual rebate agreement",
        "Kronos rebate tier confirmation for aggregated 2026 TiO2 chloride grade demand."
      ),
      evidence(
        "tio2-supplier-confirmation.txt",
        "Supplier confirmation",
        "Supplier confirmation of rebate mechanics, settlement timing, and eligible sites."
      ),
    ],
    volumeProfile: "ahead",
  },
  {
    title: "TiO2 rutile supplier benchmark",
    categoryName: "TiO2 & White Pigments",
    phase: Phase.REALISED,
    supplierName: "Venator Materials",
    alternativeSupplierName: "Kronos Pigments",
    materialName: "TiO2 Rutile R-996",
    buyerName: "Aylin Demir",
    plantName: "Ohio Compounding Site",
    businessUnitName: "Industrial Plastics",
    baselinePrice: 3.48,
    newPrice: 3.32,
    annualVolume: 280000,
    currency: Currency.USD,
    impactStart: "2026-02-15",
    impactEnd: "2026-12-31",
    narrative: "Competitive RFQ secured improved pigment pricing.",
    legacySavingsMethod: "Competitive RFQ",
    savingDriver: "Supplier benchmark",
    implementationComplexity: "Medium",
    qualificationStatus: "Approved",
    evidence: [
      evidence(
        "tio2-rutile-rfq-summary.txt",
        "Benchmark RFQ summary",
        "RFQ comparison showing Venator final offer against Kronos benchmark and freight assumptions."
      ),
    ],
    alternative: alternative({
      supplierName: "Kronos Pigments",
      materialName: "TiO2 Rutile R-996",
      country: "Germany",
      quotedPrice: 3.36,
      currency: Currency.USD,
      leadTimeDays: 18,
      moq: 18000,
      paymentTerms: "60 days net",
      qualityRating: "A",
      riskLevel: "Low",
      qualificationStatus: "Approved",
      performanceImpact: "Equivalent opacity in industrial plastics grade.",
      notes: "Used as commercial benchmark and fallback allocation.",
      isSelected: true,
    }),
    volumeProfile: "on-track",
  },
  {
    title: "Calcium carbonate filler consolidation",
    categoryName: "TiO2 & White Pigments",
    phase: Phase.VALIDATED,
    supplierName: "Lanxess Inorganics",
    materialName: "Calcium Carbonate Filler",
    buyerName: "Can Kaya",
    plantName: "Jakarta Packaging Line",
    businessUnitName: "Building & Construction",
    baselinePrice: 0.42,
    newPrice: 0.37,
    annualVolume: 1100000,
    currency: Currency.USD,
    impactStart: "2026-04-01",
    impactEnd: "2026-12-31",
    narrative: "Site consolidation and freight-inclusive pricing.",
    legacySavingsMethod: "Supplier consolidation",
    savingDriver: "Landed cost reduction",
    implementationComplexity: "Medium",
    qualificationStatus: "Approved",
    financeLocked: true,
    evidence: [
      evidence(
        "calcium-carbonate-finance-validation.txt",
        "Finance validation note",
        "Controller note confirming freight-inclusive baseline and validated supplier quote."
      ),
    ],
    volumeProfile: "behind",
  },
  {
    title: "Zinc sulfide white pigment alternative",
    categoryName: "TiO2 & White Pigments",
    phase: Phase.IDEA,
    supplierName: "Shepherd Color",
    materialName: "Zinc Sulfide White Pigment",
    buyerName: "Aylin Demir",
    plantName: "Apeldoorn Plant",
    businessUnitName: "Industrial Plastics",
    baselinePrice: 4.85,
    newPrice: 4.55,
    referencePrice: 5.6,
    annualVolume: 70000,
    currency: Currency.USD,
    impactStart: "2026-08-01",
    impactEnd: "2026-12-31",
    narrative: "Alternative white pigment under lab review.",
    legacySavingsMethod: "Alternative material",
    savingDriver: "Pigment substitution",
    implementationComplexity: "High",
    qualificationStatus: "Lab Testing",
    evidence: [],
  },
  {
    title: "TiO2 emergency stock optimization",
    categoryName: "TiO2 & White Pigments",
    phase: Phase.VALIDATED,
    supplierName: "Venator Materials",
    materialName: "TiO2 Rutile R-996",
    buyerName: "Taylan Iscan",
    plantName: "Apeldoorn Plant",
    businessUnitName: "PET Packaging",
    baselinePrice: 3.55,
    newPrice: 3.42,
    annualVolume: 210000,
    currency: Currency.USD,
    impactStart: "2026-05-01",
    impactEnd: "2026-12-31",
    narrative: "Emergency buffer reduced after supplier lead-time stabilization.",
    legacySavingsMethod: "Inventory policy",
    savingDriver: "Working capital and unit cost",
    implementationComplexity: "Low",
    qualificationStatus: "Approved",
    financeLocked: true,
    evidence: [
      evidence(
        "tio2-emergency-stock-policy.txt",
        "Inventory policy approval",
        "Procurement and operations note approving the reduced emergency stock buffer."
      ),
    ],
  },
  {
    title: "Phthalocyanine blue dual award",
    categoryName: "Organic Pigments & Dyes",
    phase: Phase.REALISED,
    supplierName: "Heubach Colorants",
    alternativeSupplierName: "DIC Pigments",
    materialName: "Phthalocyanine Blue 15:3",
    buyerName: "Aylin Demir",
    plantName: "Apeldoorn Plant",
    businessUnitName: "Packaging Colorants",
    baselinePrice: 9.8,
    newPrice: 9.15,
    annualVolume: 85000,
    currency: Currency.USD,
    impactStart: "2026-03-01",
    impactEnd: "2026-12-31",
    narrative: "Dual-award model reduced incumbent dependency.",
    legacySavingsMethod: "Dual award",
    savingDriver: "Supply risk reduction",
    implementationComplexity: "Medium",
    qualificationStatus: "Approved",
    evidence: [
      evidence(
        "blue-pigment-dual-award-approval.txt",
        "Dual-award approval",
        "Category leader approval of the dual-award strategy and allocation split."
      ),
    ],
    alternative: alternative({
      supplierName: "DIC Pigments",
      materialName: "Phthalocyanine Blue 15:3",
      country: "Spain",
      quotedPrice: 9.2,
      currency: Currency.USD,
      leadTimeDays: 28,
      moq: 5000,
      paymentTerms: "45 days net",
      qualityRating: "A-",
      riskLevel: "Medium",
      qualificationStatus: "Approved",
      performanceImpact: "Slight tint adjustment required, approved by lab.",
      notes: "Selected for 35 percent volume allocation.",
      isSelected: true,
    }),
    volumeProfile: "on-track",
  },
  {
    title: "Quinacridone red MOQ renegotiation",
    categoryName: "Organic Pigments & Dyes",
    phase: Phase.VALIDATED,
    supplierName: "DIC Pigments",
    materialName: "Quinacridone Red",
    buyerName: "Can Kaya",
    plantName: "Ohio Compounding Site",
    businessUnitName: "Consumer Goods",
    baselinePrice: 18.4,
    newPrice: 17.25,
    annualVolume: 26000,
    currency: Currency.USD,
    impactStart: "2026-04-01",
    impactEnd: "2026-12-31",
    narrative: "MOQ and payment term renegotiation lowered effective purchase price.",
    legacySavingsMethod: "MOQ renegotiation",
    savingDriver: "Commercial terms",
    implementationComplexity: "Low",
    qualificationStatus: "Approved",
    evidence: [],
    volumeProfile: "ahead",
  },
  {
    title: "Diarylide yellow regional sourcing",
    categoryName: "Organic Pigments & Dyes",
    phase: Phase.ACHIEVED,
    supplierName: "Heubach Colorants",
    materialName: "Diarylide Yellow",
    buyerName: "Aylin Demir",
    plantName: "Jakarta Packaging Line",
    businessUnitName: "Packaging Colorants",
    baselinePrice: 7.2,
    newPrice: 6.74,
    annualVolume: 140000,
    currency: Currency.USD,
    impactStart: "2026-01-15",
    impactEnd: "2026-12-31",
    narrative: "Regional sourcing reduced cost and lead time.",
    legacySavingsMethod: "Regional sourcing",
    savingDriver: "Landed cost reduction",
    implementationComplexity: "Medium",
    qualificationStatus: "Approved",
    evidence: [
      evidence(
        "diarylide-yellow-price-confirmation.txt",
        "Supplier price confirmation",
        "Supplier confirmation of regional landed price and lead-time commitment."
      ),
    ],
    volumeProfile: "on-track",
  },
  {
    title: "Solvent dye red batch-size optimization",
    categoryName: "Organic Pigments & Dyes",
    phase: Phase.IDEA,
    supplierName: "DIC Pigments",
    materialName: "Solvent Dye Red 135",
    buyerName: "Can Kaya",
    plantName: "Apeldoorn Plant",
    businessUnitName: "PET Packaging",
    baselinePrice: 22.5,
    newPrice: 21.4,
    annualVolume: 16000,
    currency: Currency.USD,
    impactStart: "2026-09-01",
    impactEnd: "2026-12-31",
    narrative: "Batch-size optimization under technical feasibility review.",
    legacySavingsMethod: "Batch optimization",
    savingDriver: "Production efficiency",
    implementationComplexity: "Medium",
    qualificationStatus: "Not Started",
    evidence: [],
  },
  {
    title: "High-performance green pigment reformulation",
    categoryName: "Organic Pigments & Dyes",
    phase: Phase.CANCELLED,
    supplierName: "Shepherd Color",
    materialName: "High Performance Green Pigment",
    buyerName: "Aylin Demir",
    plantName: "Ohio Compounding Site",
    businessUnitName: "Industrial Plastics",
    baselinePrice: 31,
    newPrice: 28.9,
    annualVolume: 12000,
    currency: Currency.USD,
    impactStart: "2026-06-01",
    impactEnd: "2026-12-31",
    narrative: "Canceled due to failed shade approval.",
    legacySavingsMethod: "Reformulation",
    savingDriver: "Material substitution",
    implementationComplexity: "High",
    qualificationStatus: "Rejected",
    cancellationReason: "Customer color approval failed during validation.",
    evidence: [
      evidence(
        "green-pigment-customer-rejection.txt",
        "Customer approval note",
        "Customer shade approval failed after reformulation trial, so procurement canceled the initiative."
      ),
    ],
  },
  {
    title: "UV stabilizer package rebid",
    categoryName: "Additives & Stabilizers",
    phase: Phase.REALISED,
    supplierName: "BASF Additives",
    alternativeSupplierName: "Clariant Additives",
    materialName: "UV Stabilizer Package",
    buyerName: "Taylan Iscan",
    plantName: "Apeldoorn Plant",
    businessUnitName: "Building & Construction",
    baselinePrice: 6.8,
    newPrice: 6.28,
    annualVolume: 115000,
    currency: Currency.USD,
    impactStart: "2026-02-01",
    impactEnd: "2026-12-31",
    narrative: "Competitive rebid reduced stabilizer package cost.",
    legacySavingsMethod: "Competitive rebid",
    savingDriver: "RFQ",
    implementationComplexity: "Medium",
    qualificationStatus: "Approved",
    evidence: [
      evidence(
        "uv-stabilizer-rfq-award-note.txt",
        "RFQ award note",
        "Award note documenting final evaluated price, supply risk, and implementation owner."
      ),
    ],
    alternative: alternative({
      supplierName: "Clariant Additives",
      materialName: "UV Stabilizer Package",
      country: "Switzerland",
      quotedPrice: 6.34,
      currency: Currency.USD,
      leadTimeDays: 24,
      moq: 3000,
      paymentTerms: "60 days net",
      qualityRating: "A",
      riskLevel: "Low",
      qualificationStatus: "Approved",
      performanceImpact: "Equivalent weathering result in accelerated testing.",
      notes: "Selected as second ranked supplier and benchmark.",
      isSelected: true,
    }),
    volumeProfile: "on-track",
  },
  {
    title: "Antioxidant blend supplier switch",
    categoryName: "Additives & Stabilizers",
    phase: Phase.VALIDATED,
    supplierName: "SI Group",
    alternativeSupplierName: "BASF Additives",
    materialName: "Antioxidant Blend",
    buyerName: "Aylin Demir",
    plantName: "Ohio Compounding Site",
    businessUnitName: "Industrial Plastics",
    baselinePrice: 5.4,
    newPrice: 5.06,
    annualVolume: 98000,
    currency: Currency.USD,
    impactStart: "2026-05-01",
    impactEnd: "2026-12-31",
    narrative: "Supplier switch validated after equivalent performance testing.",
    legacySavingsMethod: "Supplier switch",
    savingDriver: "Alternative supplier",
    implementationComplexity: "High",
    qualificationStatus: "Approved",
    financeLocked: true,
    evidence: [
      evidence(
        "antioxidant-blend-performance-test.txt",
        "Technical approval note",
        "Equivalent performance testing and finance conversion note for the USD supplier switch."
      ),
    ],
    alternative: alternative({
      supplierName: "BASF Additives",
      materialName: "Antioxidant Blend",
      country: "United States",
      quotedPrice: 5.08,
      currency: Currency.USD,
      leadTimeDays: 21,
      moq: 4000,
      paymentTerms: "45 days net",
      qualityRating: "A",
      riskLevel: "Medium",
      qualificationStatus: "Approved",
      performanceImpact: "No measurable performance impact in accelerated aging test.",
      notes: "Selected for switch after finance locked the validated case.",
      isSelected: true,
    }),
  },
  {
    title: "Processing aid masterbatch redesign",
    categoryName: "Additives & Stabilizers",
    phase: Phase.ACHIEVED,
    supplierName: "Avient Additives",
    materialName: "Processing Aid Masterbatch",
    buyerName: "Can Kaya",
    plantName: "Jakarta Packaging Line",
    businessUnitName: "Consumer Goods",
    baselinePrice: 4.15,
    newPrice: 3.82,
    annualVolume: 210000,
    currency: Currency.USD,
    impactStart: "2026-01-01",
    impactEnd: "2026-12-31",
    narrative: "Internal specification redesign reduced additive cost.",
    legacySavingsMethod: "Specification redesign",
    savingDriver: "Internal specification",
    implementationComplexity: "Medium",
    qualificationStatus: "Approved",
    evidence: [
      evidence(
        "processing-aid-specification-release.txt",
        "Specification release",
        "Released internal specification with approved dosage window and savings calculation."
      ),
    ],
    volumeProfile: "ahead",
  },
  {
    title: "Slip additive indexed contract",
    categoryName: "Additives & Stabilizers",
    phase: Phase.IDEA,
    supplierName: "Clariant Additives",
    materialName: "Slip Additive",
    buyerName: "Aylin Demir",
    plantName: "Apeldoorn Plant",
    businessUnitName: "Packaging Colorants",
    baselinePrice: 3.95,
    newPrice: 3.7,
    referencePrice: 4.6,
    annualVolume: 76000,
    currency: Currency.USD,
    impactStart: "2026-08-01",
    impactEnd: "2026-12-31",
    narrative: "Proposed index-linked contract under negotiation.",
    legacySavingsMethod: "Indexed contract",
    savingDriver: "Contracting",
    implementationComplexity: "Low",
    qualificationStatus: "Not Started",
    evidence: [],
  },
  {
    title: "PET chain extender annual agreement",
    categoryName: "Additives & Stabilizers",
    phase: Phase.REALISED,
    supplierName: "PMC Organometallix",
    materialName: "PET Chain Extender",
    buyerName: "Taylan Iscan",
    plantName: "Apeldoorn Plant",
    businessUnitName: "PET Packaging",
    baselinePrice: 12.2,
    newPrice: 11.35,
    annualVolume: 38000,
    currency: Currency.USD,
    impactStart: "2026-03-01",
    impactEnd: "2026-12-31",
    narrative: "Annual agreement reduced exposure to spot buys.",
    legacySavingsMethod: "Annual agreement",
    savingDriver: "Spot buy avoidance",
    implementationComplexity: "Low",
    qualificationStatus: "Approved",
    evidence: [
      evidence(
        "pet-chain-extender-annual-agreement.txt",
        "Signed annual agreement",
        "Signed annual agreement confirming price, volume band, and delivery terms."
      ),
    ],
    volumeProfile: "on-track",
  },
  {
    title: "Octabin specification harmonization",
    categoryName: "Packaging Materials",
    phase: Phase.REALISED,
    supplierName: "Smurfit Kappa",
    alternativeSupplierName: "Greif Packaging",
    materialName: "Octabin 1000kg",
    buyerName: "Can Kaya",
    plantName: "Apeldoorn Plant",
    businessUnitName: "Packaging Colorants",
    baselinePrice: 18.5,
    newPrice: 16.9,
    annualVolume: 42000,
    currency: Currency.USD,
    impactStart: "2026-02-01",
    impactEnd: "2026-12-31",
    narrative: "Harmonized octabin spec across plants.",
    legacySavingsMethod: "Specification harmonization",
    savingDriver: "Packaging standardization",
    implementationComplexity: "Medium",
    qualificationStatus: "Approved",
    evidence: [
      evidence(
        "octabin-packaging-spec-approval.txt",
        "Packaging specification approval",
        "Packaging engineering approval for harmonized octabin dimensions and board grade."
      ),
    ],
    alternative: alternative({
      supplierName: "Greif Packaging",
      materialName: "Octabin 1000kg",
      country: "Netherlands",
      quotedPrice: 17.1,
      currency: Currency.USD,
      leadTimeDays: 10,
      moq: 500,
      paymentTerms: "30 days net",
      qualityRating: "A-",
      riskLevel: "Low",
      qualificationStatus: "Approved",
      performanceImpact: "Equivalent stacking and filling performance.",
      notes: "Selected as dual-source packaging backup.",
      isSelected: true,
    }),
    volumeProfile: "on-track",
  },
  {
    title: "25kg bag regional sourcing",
    categoryName: "Packaging Materials",
    phase: Phase.VALIDATED,
    supplierName: "Mondi Industrial Bags",
    alternativeSupplierName: "LocalFlex Packaging",
    materialName: "25kg PE Bags",
    buyerName: "Can Kaya",
    plantName: "Jakarta Packaging Line",
    businessUnitName: "Consumer Goods",
    baselinePrice: 0.34,
    newPrice: 0.3,
    annualVolume: 1800000,
    currency: Currency.USD,
    impactStart: "2026-05-01",
    impactEnd: "2026-12-31",
    narrative: "Regional bag sourcing reduced landed cost.",
    legacySavingsMethod: "Regional sourcing",
    savingDriver: "Landed cost reduction",
    implementationComplexity: "Medium",
    qualificationStatus: "Approved",
    financeLocked: true,
    evidence: [
      evidence(
        "25kg-bag-regional-quote.txt",
        "Supplier quotation",
        "Regional quote with landed cost calculation and confirmed lead time."
      ),
    ],
    alternative: alternative({
      supplierName: "LocalFlex Packaging",
      materialName: "25kg PE Bags",
      country: "Indonesia",
      quotedPrice: 0.31,
      currency: Currency.USD,
      leadTimeDays: 12,
      moq: 100000,
      paymentTerms: "30 days net",
      qualityRating: "B+",
      riskLevel: "Medium",
      qualificationStatus: "Plant Trial",
      performanceImpact: "Minor print registration adjustment required.",
      notes: "Selected for regional cost advantage after finance validation.",
      isSelected: true,
    }),
  },
  {
    title: "Stretch film gauge reduction",
    categoryName: "Packaging Materials",
    phase: Phase.IDEA,
    supplierName: "LocalFlex Packaging",
    materialName: "Stretch Film",
    buyerName: "Can Kaya",
    plantName: "Ohio Compounding Site",
    businessUnitName: "Industrial Plastics",
    baselinePrice: 2.1,
    newPrice: 1.92,
    annualVolume: 95000,
    currency: Currency.USD,
    impactStart: "2026-09-01",
    impactEnd: "2026-12-31",
    narrative: "Lower-gauge stretch film pilot for pallet stability.",
    legacySavingsMethod: "Specification optimization",
    savingDriver: "Material usage reduction",
    implementationComplexity: "Medium",
    qualificationStatus: "Not Started",
    evidence: [],
  },
  {
    title: "Twin-screw compounding tolling rate card",
    categoryName: "Tolling & Subcontracted Processing",
    phase: Phase.REALISED,
    supplierName: "Dutch Compounding Services",
    alternativeSupplierName: "Midwest Compounding LLC",
    materialName: "External Twin-Screw Compounding",
    buyerName: "Taylan Iscan",
    plantName: "Izmir Tolling Partner",
    businessUnitName: "Building & Construction",
    baselinePrice: 0.48,
    newPrice: 0.42,
    annualVolume: 620000,
    currency: Currency.USD,
    impactStart: "2026-03-01",
    impactEnd: "2026-12-31",
    narrative: "Consolidated tolling rate card across projects.",
    legacySavingsMethod: "Tolling rate card",
    savingDriver: "Subcontracting leverage",
    implementationComplexity: "Medium",
    qualificationStatus: "Approved",
    evidence: [
      evidence(
        "twin-screw-tolling-rate-card.txt",
        "Tolling rate card",
        "Signed tolling rate card with project band, surcharge terms, and annual volume assumption."
      ),
    ],
    alternative: alternative({
      supplierName: "Midwest Compounding LLC",
      materialName: "External Twin-Screw Compounding",
      country: "United States",
      quotedPrice: 0.44,
      currency: Currency.USD,
      leadTimeDays: 20,
      moq: 15000,
      paymentTerms: "45 days net",
      qualityRating: "A-",
      riskLevel: "Medium",
      qualificationStatus: "Approved",
      performanceImpact: "Equivalent compounding capability, higher freight for EMEA demand.",
      notes: "Kept as benchmark and regional backup.",
      isSelected: true,
    }),
    volumeProfile: "behind",
  },
  {
    title: "Color matching lab service bundle",
    categoryName: "Tolling & Subcontracted Processing",
    phase: Phase.VALIDATED,
    supplierName: "Izmir Toll Processing",
    materialName: "Color Matching Lab Service",
    buyerName: "Aylin Demir",
    plantName: "Izmir Tolling Partner",
    businessUnitName: "Packaging Colorants",
    baselinePrice: 420,
    newPrice: 365,
    annualVolume: 450,
    currency: Currency.USD,
    impactStart: "2026-06-01",
    impactEnd: "2026-12-31",
    narrative: "Bundled lab-service agreement for recurring color approvals.",
    legacySavingsMethod: "Service bundle",
    savingDriver: "Service contracting",
    implementationComplexity: "Low",
    qualificationStatus: "Approved",
    evidence: [
      evidence(
        "color-matching-service-bundle.txt",
        "Supplier price confirmation",
        "Bundled service offer covering recurring color matching approvals and turnaround time."
      ),
    ],
  },
] as const;

const UTOPIATRAX_CLASSIFICATION_BY_TITLE: Record<
  string,
  Pick<
    UtopiaTraxSavingCardSeed,
    "savingType" | "impactType" | "impactRecurrence" | "budgetImpact"
  >
> = {
  "PP Carrier dual-source negotiation": {
    savingType: SavingType.SUPPLIER_SWITCH,
    impactType: SavingsImpactType.HARD_SAVINGS,
    impactRecurrence: SavingsImpactRecurrence.RECURRING,
    budgetImpact: SavingsBudgetImpact.BUDGET_IMPACT,
  },
  "LDPE carrier formula optimization": {
    savingType: SavingType.SPECIFICATION_CHANGE,
    impactType: SavingsImpactType.HARD_SAVINGS,
    impactRecurrence: SavingsImpactRecurrence.RECURRING,
    budgetImpact: SavingsBudgetImpact.BUDGET_IMPACT,
  },
  "PET carrier quarterly index reset": {
    savingType: SavingType.PRICE_REDUCTION,
    impactType: SavingsImpactType.HARD_SAVINGS,
    impactRecurrence: SavingsImpactRecurrence.RECURRING,
    budgetImpact: SavingsBudgetImpact.BUDGET_IMPACT,
  },
  "Bio-based carrier pilot sourcing": {
    savingType: SavingType.COST_AVOIDANCE,
    impactType: SavingsImpactType.RISK_CONTINUITY_BENEFIT,
    impactRecurrence: SavingsImpactRecurrence.TEMPORARY,
    budgetImpact: SavingsBudgetImpact.FORECAST_AVOIDANCE,
  },
  "Recycled PP carrier localization": {
    savingType: SavingType.FREIGHT_LOGISTICS,
    impactType: SavingsImpactType.RISK_CONTINUITY_BENEFIT,
    impactRecurrence: SavingsImpactRecurrence.UNKNOWN,
    budgetImpact: SavingsBudgetImpact.NON_BUDGET_OPERATIONAL_BENEFIT,
  },
  "TiO2 chloride grade rebate": {
    savingType: SavingType.REBATE_CREDIT,
    impactType: SavingsImpactType.HARD_SAVINGS,
    impactRecurrence: SavingsImpactRecurrence.RECURRING,
    budgetImpact: SavingsBudgetImpact.BUDGET_IMPACT,
  },
  "TiO2 rutile supplier benchmark": {
    savingType: SavingType.PRICE_REDUCTION,
    impactType: SavingsImpactType.HARD_SAVINGS,
    impactRecurrence: SavingsImpactRecurrence.RECURRING,
    budgetImpact: SavingsBudgetImpact.BUDGET_IMPACT,
  },
  "Calcium carbonate filler consolidation": {
    savingType: SavingType.VOLUME_CONSOLIDATION,
    impactType: SavingsImpactType.HARD_SAVINGS,
    impactRecurrence: SavingsImpactRecurrence.RECURRING,
    budgetImpact: SavingsBudgetImpact.BUDGET_IMPACT,
  },
  "Zinc sulfide white pigment alternative": {
    savingType: SavingType.SUPPLIER_SWITCH,
    impactType: SavingsImpactType.COST_AVOIDANCE,
    impactRecurrence: SavingsImpactRecurrence.UNKNOWN,
    budgetImpact: SavingsBudgetImpact.FORECAST_AVOIDANCE,
  },
  "TiO2 emergency stock optimization": {
    savingType: SavingType.PRICE_REDUCTION,
    impactType: SavingsImpactType.WORKING_CAPITAL_IMPACT,
    impactRecurrence: SavingsImpactRecurrence.RECURRING,
    budgetImpact: SavingsBudgetImpact.NON_BUDGET_OPERATIONAL_BENEFIT,
  },
  "Phthalocyanine blue dual award": {
    savingType: SavingType.REBATE_CREDIT,
    impactType: SavingsImpactType.HARD_SAVINGS,
    impactRecurrence: SavingsImpactRecurrence.ONE_TIME,
    budgetImpact: SavingsBudgetImpact.BUDGET_IMPACT,
  },
  "Quinacridone red MOQ renegotiation": {
    savingType: SavingType.PAYMENT_TERMS,
    impactType: SavingsImpactType.WORKING_CAPITAL_IMPACT,
    impactRecurrence: SavingsImpactRecurrence.RECURRING,
    budgetImpact: SavingsBudgetImpact.NON_BUDGET_OPERATIONAL_BENEFIT,
  },
  "Diarylide yellow regional sourcing": {
    savingType: SavingType.SUPPLIER_SWITCH,
    impactType: SavingsImpactType.HARD_SAVINGS,
    impactRecurrence: SavingsImpactRecurrence.RECURRING,
    budgetImpact: SavingsBudgetImpact.BUDGET_IMPACT,
  },
  "Solvent dye red batch-size optimization": {
    savingType: SavingType.PROCESS_TOLLING,
    impactType: SavingsImpactType.HARD_SAVINGS,
    impactRecurrence: SavingsImpactRecurrence.RECURRING,
    budgetImpact: SavingsBudgetImpact.BUDGET_IMPACT,
  },
  "High-performance green pigment reformulation": {
    savingType: SavingType.SPECIFICATION_CHANGE,
    impactType: SavingsImpactType.RISK_CONTINUITY_BENEFIT,
    impactRecurrence: SavingsImpactRecurrence.UNKNOWN,
    budgetImpact: SavingsBudgetImpact.NON_BUDGET_OPERATIONAL_BENEFIT,
  },
  "UV stabilizer package rebid": {
    savingType: SavingType.PRICE_REDUCTION,
    impactType: SavingsImpactType.HARD_SAVINGS,
    impactRecurrence: SavingsImpactRecurrence.RECURRING,
    budgetImpact: SavingsBudgetImpact.BUDGET_IMPACT,
  },
  "Antioxidant blend supplier switch": {
    savingType: SavingType.SUPPLIER_SWITCH,
    impactType: SavingsImpactType.HARD_SAVINGS,
    impactRecurrence: SavingsImpactRecurrence.RECURRING,
    budgetImpact: SavingsBudgetImpact.BUDGET_IMPACT,
  },
  "Processing aid masterbatch redesign": {
    savingType: SavingType.SPECIFICATION_CHANGE,
    impactType: SavingsImpactType.HARD_SAVINGS,
    impactRecurrence: SavingsImpactRecurrence.RECURRING,
    budgetImpact: SavingsBudgetImpact.BUDGET_IMPACT,
  },
  "Slip additive indexed contract": {
    savingType: SavingType.PRICE_REDUCTION,
    impactType: SavingsImpactType.COST_AVOIDANCE,
    impactRecurrence: SavingsImpactRecurrence.TEMPORARY,
    budgetImpact: SavingsBudgetImpact.FORECAST_AVOIDANCE,
  },
  "PET chain extender annual agreement": {
    savingType: SavingType.REBATE_CREDIT,
    impactType: SavingsImpactType.HARD_SAVINGS,
    impactRecurrence: SavingsImpactRecurrence.RECURRING,
    budgetImpact: SavingsBudgetImpact.BUDGET_IMPACT,
  },
  "Octabin specification harmonization": {
    savingType: SavingType.PRICE_REDUCTION,
    impactType: SavingsImpactType.HARD_SAVINGS,
    impactRecurrence: SavingsImpactRecurrence.RECURRING,
    budgetImpact: SavingsBudgetImpact.BUDGET_IMPACT,
  },
  "25kg bag regional sourcing": {
    savingType: SavingType.FREIGHT_LOGISTICS,
    impactType: SavingsImpactType.HARD_SAVINGS,
    impactRecurrence: SavingsImpactRecurrence.RECURRING,
    budgetImpact: SavingsBudgetImpact.BUDGET_IMPACT,
  },
  "Stretch film gauge reduction": {
    savingType: SavingType.PRICE_REDUCTION,
    impactType: SavingsImpactType.HARD_SAVINGS,
    impactRecurrence: SavingsImpactRecurrence.RECURRING,
    budgetImpact: SavingsBudgetImpact.BUDGET_IMPACT,
  },
  "Twin-screw compounding tolling rate card": {
    savingType: SavingType.PROCESS_TOLLING,
    impactType: SavingsImpactType.HARD_SAVINGS,
    impactRecurrence: SavingsImpactRecurrence.RECURRING,
    budgetImpact: SavingsBudgetImpact.BUDGET_IMPACT,
  },
  "Color matching lab service bundle": {
    savingType: SavingType.PRICE_REDUCTION,
    impactType: SavingsImpactType.HARD_SAVINGS,
    impactRecurrence: SavingsImpactRecurrence.RECURRING,
    budgetImpact: SavingsBudgetImpact.BUDGET_IMPACT,
  },
};

export const UTOPIATRAX_SAVING_CARDS: readonly UtopiaTraxSavingCardSeed[] =
  UTOPIATRAX_SAVING_CARD_BASE.map((card) => ({
    ...card,
    ...UTOPIATRAX_CLASSIFICATION_BY_TITLE[card.title],
  }));

export const UTOPIATRAX_PENDING_PHASE_REQUESTS: ReadonlyArray<{
  cardTitle: string;
  requestedPhase: Phase;
  requestedByEmail: string;
  comment: string;
  createdAt: string;
}> = [
  {
    cardTitle: "Bio-based carrier pilot sourcing",
    requestedPhase: Phase.VALIDATED,
    requestedByEmail: "taylaniscan+6@gmail.com",
    comment: "Please review the pilot business case and finance baseline before lab qualification starts.",
    createdAt: "2026-04-10T09:15:00.000Z",
  },
  {
    cardTitle: "Quinacridone red MOQ renegotiation",
    requestedPhase: Phase.REALISED,
    requestedByEmail: "taylaniscan+7@gmail.com",
    comment: "Commercial terms are signed. Finance approval is needed before realized reporting.",
    createdAt: "2026-04-22T14:30:00.000Z",
  },
  {
    cardTitle: "Antioxidant blend supplier switch",
    requestedPhase: Phase.REALISED,
    requestedByEmail: "taylaniscan+6@gmail.com",
    comment: "Finance-locked USD case is ready for realized phase once the controller confirms FX treatment.",
    createdAt: "2026-04-18T10:45:00.000Z",
  },
  {
    cardTitle: "Stretch film gauge reduction",
    requestedPhase: Phase.VALIDATED,
    requestedByEmail: "taylaniscan+7@gmail.com",
    comment: "Operations completed the pallet stability check and requests validation review.",
    createdAt: "2026-04-24T08:00:00.000Z",
  },
  {
    cardTitle: "Color matching lab service bundle",
    requestedPhase: Phase.REALISED,
    requestedByEmail: "taylaniscan+6@gmail.com",
    comment: "Service bundle is approved by procurement and waiting for finance realized sign-off.",
    createdAt: "2026-04-05T11:00:00.000Z",
  },
] as const;

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function logSeedStep(message: string) {
  if (process.env.DEMO_SEED_QUIET === "1") {
    return;
  }

  console.info(`[utopiatrax] ${message}`);
}

async function withTimeout<T>(
  promise: PromiseLike<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms.`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function parseDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function parseDateTime(value: string) {
  return new Date(value);
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function startOfUtcMonth(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

function addUtcMonths(value: Date, months: number) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, 1));
}

function monthRange(start: Date, end: Date) {
  const periods: Date[] = [];
  let cursor = startOfUtcMonth(start);
  const last = startOfUtcMonth(end);

  while (cursor.getTime() <= last.getTime()) {
    periods.push(cursor);
    cursor = addUtcMonths(cursor, 1);
  }

  return periods;
}

function createMap<T extends { name: string }>(items: readonly T[]) {
  return new Map(items.map((item) => [item.name, item]));
}

function getDuplicateValues(values: readonly string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }

    seen.add(value);
  }

  return [...duplicates].sort();
}

export function getUtopiaTraxExpectedPendingOpenActionCount() {
  return UTOPIATRAX_PENDING_PHASE_REQUESTS.reduce(
    (sum, request) => sum + getRequiredApproverRoles(request.requestedPhase).length,
    0
  );
}

export function getUtopiaTraxNaturalKeys() {
  return {
    organizationSlug: DEMO_WORKSPACE_SLUG,
    userEmails: UTOPIATRAX_DEMO_USERS.map((user) => normalizeEmail(user.email)),
    categoryNames: UTOPIATRAX_DIRECT_CATEGORIES.map((category) => category.name),
    supplierNames: UTOPIATRAX_SUPPLIERS.map((supplier) => supplier.name),
    materialNames: UTOPIATRAX_MATERIALS.map((material) => material.name),
    buyerNames: UTOPIATRAX_BUYERS.map((buyer) => buyer.name),
    plantNames: UTOPIATRAX_PLANTS.map((plant) => plant.name),
    businessUnitNames: UTOPIATRAX_BUSINESS_UNITS.map((unit) => unit.name),
    savingCardTitles: UTOPIATRAX_SAVING_CARDS.map((card) => card.title),
  };
}

export function getUtopiaTraxDatasetSummary(): UtopiaTraxDatasetSummary {
  const categoryNames = new Set(UTOPIATRAX_DIRECT_CATEGORIES.map((category) => category.name));
  const phaseCounts = {
    [Phase.IDEA]: 0,
    [Phase.VALIDATED]: 0,
    [Phase.REALISED]: 0,
    [Phase.ACHIEVED]: 0,
    [Phase.CANCELLED]: 0,
  };
  const categoriesRepresented = new Set<string>();
  const financeLockedViolations: string[] = [];
  const unknownCategoryCards: string[] = [];
  const savingTypeCounts = Object.fromEntries(
    Object.values(SavingType).map((value) => [value, 0])
  ) as Record<SavingType, number>;
  const impactTypeCounts = Object.fromEntries(
    Object.values(SavingsImpactType).map((value) => [value, 0])
  ) as Record<SavingsImpactType, number>;
  const recurrenceCounts = Object.fromEntries(
    Object.values(SavingsImpactRecurrence).map((value) => [value, 0])
  ) as Record<SavingsImpactRecurrence, number>;
  const budgetImpactCounts = Object.fromEntries(
    Object.values(SavingsBudgetImpact).map((value) => [value, 0])
  ) as Record<SavingsBudgetImpact, number>;

  let costAvoidanceCardCount = 0;
  let midYearImpactStartCount = 0;

  for (const card of UTOPIATRAX_SAVING_CARDS) {
    phaseCounts[card.phase] += 1;
    savingTypeCounts[card.savingType] += 1;
    impactTypeCounts[card.impactType] += 1;
    recurrenceCounts[card.impactRecurrence] += 1;
    budgetImpactCounts[card.budgetImpact] += 1;
    categoriesRepresented.add(card.categoryName);

    // Mitigated-increase / cost-avoidance cards carry a reference price.
    if (card.referencePrice !== undefined) {
      costAvoidanceCardCount += 1;
    }
    // Mid-year impact starts are any start that is not January 1.
    if (!card.impactStart.endsWith("-01-01")) {
      midYearImpactStartCount += 1;
    }

    if (!categoryNames.has(card.categoryName)) {
      unknownCategoryCards.push(card.title);
    }

    if (card.financeLocked && card.phase !== Phase.VALIDATED) {
      financeLockedViolations.push(card.title);
    }
  }

  return {
    savingCardCount: UTOPIATRAX_SAVING_CARDS.length,
    directCategoryCount: UTOPIATRAX_DIRECT_CATEGORIES.length,
    supplierCount: UTOPIATRAX_SUPPLIERS.length,
    materialCount: UTOPIATRAX_MATERIALS.length,
    userCount: UTOPIATRAX_DEMO_USERS.length,
    evidenceCount: UTOPIATRAX_SAVING_CARDS.reduce(
      (sum, card) => sum + card.evidence.length,
      0
    ),
    alternativeCount: UTOPIATRAX_SAVING_CARDS.filter((card) => card.alternative).length,
    costAvoidanceCardCount,
    midYearImpactStartCount,
    volumeProfileCount: UTOPIATRAX_SAVING_CARDS.filter((card) => card.volumeProfile)
      .length,
    pendingPhaseRequestCount: UTOPIATRAX_PENDING_PHASE_REQUESTS.length,
    expectedPendingOpenActions: getUtopiaTraxExpectedPendingOpenActionCount(),
    phaseCounts,
    savingTypeCounts,
    impactTypeCounts,
    recurrenceCounts,
    budgetImpactCounts,
    categoriesRepresented: [...categoriesRepresented].sort(),
    financeLockedViolations,
    unknownCategoryCards,
    duplicateCardTitles: getDuplicateValues(
      UTOPIATRAX_SAVING_CARDS.map((card) => card.title)
    ),
    duplicateCategoryNames: getDuplicateValues(
      UTOPIATRAX_DIRECT_CATEGORIES.map((category) => category.name)
    ),
  };
}

export function validateUtopiaTraxDemoDataset() {
  const summary = getUtopiaTraxDatasetSummary();
  const errors = validateUtopiaTraxStaticContract({
    users: UTOPIATRAX_DEMO_USERS,
    categories: UTOPIATRAX_DIRECT_CATEGORIES,
    cards: UTOPIATRAX_SAVING_CARDS,
    pendingPhaseRequestCount: UTOPIATRAX_PENDING_PHASE_REQUESTS.length,
    expectedPendingOpenActions: getUtopiaTraxExpectedPendingOpenActionCount(),
  });

  if (summary.savingCardCount !== 25) {
    errors.push(`Expected 25 saving cards, found ${summary.savingCardCount}.`);
  }

  if (summary.directCategoryCount !== 6) {
    errors.push(`Expected exactly 6 direct categories, found ${summary.directCategoryCount}.`);
  }

  for (const phase of Object.values(Phase)) {
    if ((summary.phaseCounts[phase] ?? 0) === 0) {
      errors.push(`Missing saving cards in ${phase} phase.`);
    }
  }

  if (summary.phaseCounts[Phase.IDEA] !== 5) {
    errors.push(`Expected 5 proposed cards, found ${summary.phaseCounts[Phase.IDEA]}.`);
  }

  if (summary.phaseCounts[Phase.VALIDATED] !== 7) {
    errors.push(
      `Expected 7 finance validated cards, found ${summary.phaseCounts[Phase.VALIDATED]}.`
    );
  }

  if (summary.phaseCounts[Phase.REALISED] !== 7) {
    errors.push(
      `Expected 7 implemented cards, found ${summary.phaseCounts[Phase.REALISED]}.`
    );
  }

  if (summary.phaseCounts[Phase.ACHIEVED] !== 4) {
    errors.push(
      `Expected 4 captured cards, found ${summary.phaseCounts[Phase.ACHIEVED]}.`
    );
  }

  if (summary.phaseCounts[Phase.CANCELLED] !== 2) {
    errors.push(
      `Expected 2 canceled cards, found ${summary.phaseCounts[Phase.CANCELLED]}.`
    );
  }

  if (summary.evidenceCount < 12) {
    errors.push(`Expected at least 12 evidence records, found ${summary.evidenceCount}.`);
  }

  if (summary.alternativeCount < 8) {
    errors.push(
      `Expected alternatives for at least 8 cards, found ${summary.alternativeCount}.`
    );
  }

  if (summary.costAvoidanceCardCount < 2) {
    errors.push(
      `Expected at least 2 cost-avoidance/mitigated-increase cards with a reference price, found ${summary.costAvoidanceCardCount}.`
    );
  }

  if (summary.midYearImpactStartCount < 3) {
    errors.push(
      `Expected several mid-year impact starts, found ${summary.midYearImpactStartCount}.`
    );
  }

  if (summary.categoriesRepresented.length !== summary.directCategoryCount) {
    errors.push("Not every direct category is represented by saving cards.");
  }

  if (summary.financeLockedViolations.length) {
    errors.push(
      `Finance lock is only allowed on Finance Validated cards. Violations: ${summary.financeLockedViolations.join(", ")}.`
    );
  }

  if (summary.unknownCategoryCards.length) {
    errors.push(
      `Cards reference unknown categories: ${summary.unknownCategoryCards.join(", ")}.`
    );
  }

  if (summary.duplicateCardTitles.length) {
    errors.push(`Duplicate saving-card titles: ${summary.duplicateCardTitles.join(", ")}.`);
  }

  if (summary.duplicateCategoryNames.length) {
    errors.push(`Duplicate category names: ${summary.duplicateCategoryNames.join(", ")}.`);
  }

  return [...new Set(errors)];
}

function assertDemoSeedEnvironment() {
  const nodeEnv = process.env.NODE_ENV?.trim().toLowerCase();
  const appEnv = process.env.APP_ENV?.trim().toLowerCase();
  const isProductionLike = nodeEnv === "production" || appEnv === "production";

  if (isProductionLike && process.env.DEMO_SEED_CONFIRM !== DEMO_WORKSPACE_NAME) {
    throw new Error(
      `Refusing to seed ${DEMO_WORKSPACE_NAME} in production. Set DEMO_SEED_CONFIRM=${DEMO_WORKSPACE_NAME} to continue.`
    );
  }
}

async function resetUtopiaTraxDemoWorkspace(prisma: PrismaClient) {
  const organization = await prisma.organization.findUnique({
    where: { slug: DEMO_WORKSPACE_SLUG },
    select: { id: true },
  });

  if (!organization) {
    return;
  }

  const demoEmails = new Set(UTOPIATRAX_DEMO_USERS.map((user) => normalizeEmail(user.email)));
  const workspaceUsers = await prisma.user.findMany({
    where: {
      organizationId: organization.id,
    },
    select: {
      email: true,
      memberships: {
        select: {
          organizationId: true,
        },
      },
    },
  });
  const resetSafety = getUtopiaTraxResetSafetyViolations(
    organization.id,
    workspaceUsers.map((user) => ({
      email: user.email,
      membershipOrganizationIds: user.memberships.map(
        (membership) => membership.organizationId
      ),
    }))
  );

  if (resetSafety.unexpectedEmails.length) {
    throw new Error(
      `Reset aborted because ${DEMO_WORKSPACE_NAME} has non-demo users: ${resetSafety.unexpectedEmails.join(", ")}.`
    );
  }

  if (resetSafety.externalMembershipEmails.length) {
    throw new Error(
      `Reset aborted because demo users have memberships outside ${DEMO_WORKSPACE_NAME}: ${resetSafety.externalMembershipEmails.join(", ")}.`
    );
  }

  await deleteWorkspaceDemoGraph(prisma, organization.id);
  await prisma.organizationMembership.deleteMany({
    where: { organizationId: organization.id },
  });
  await prisma.user.deleteMany({
    where: {
      organizationId: organization.id,
      email: {
        in: [...demoEmails],
        mode: "insensitive",
      },
    },
  });
  await prisma.organization.delete({
    where: { id: organization.id },
  });
}

async function deleteWorkspaceDemoGraph(prisma: PrismaClient, organizationId: string) {
  const cardWhere = { organizationId };

  await prisma.phaseChangeRequestApproval.deleteMany({
    where: { phaseChangeRequest: { savingCard: cardWhere } },
  });
  await prisma.phaseChangeRequest.deleteMany({
    where: { savingCard: cardWhere },
  });
  await prisma.auditLog.deleteMany({
    where: {
      OR: [{ organizationId }, { savingCard: cardWhere }],
    },
  });
  await prisma.notification.deleteMany({
    where: {
      OR: [{ organizationId }, { user: { organizationId } }],
    },
  });
  await prisma.phaseHistory.deleteMany({ where: { savingCard: cardWhere } });
  await prisma.savingCardComment.deleteMany({ where: { savingCard: cardWhere } });
  await prisma.savingCardAlternativeMaterial.deleteMany({
    where: { savingCard: cardWhere },
  });
  await prisma.savingCardAlternativeSupplier.deleteMany({
    where: { savingCard: cardWhere },
  });
  await prisma.savingCardEvidence.deleteMany({ where: { savingCard: cardWhere } });
  await prisma.savingCardStakeholder.deleteMany({ where: { savingCard: cardWhere } });
  await prisma.materialConsumptionActual.deleteMany({
    where: { savingCard: cardWhere },
  });
  await prisma.materialConsumptionForecast.deleteMany({
    where: { savingCard: cardWhere },
  });
  await prisma.savingCard.deleteMany({ where: cardWhere });
  await prisma.annualTarget.deleteMany({ where: { organizationId } });
  await prisma.subscription.deleteMany({ where: { organizationId } });
  await prisma.billingCustomer.deleteMany({ where: { organizationId } });
  await prisma.webhookEvent.deleteMany({ where: { organizationId } });
  await prisma.usageEvent.deleteMany({ where: { organizationId } });
  await prisma.usageCounter.deleteMany({ where: { organizationId } });
  await prisma.quotaSnapshot.deleteMany({ where: { organizationId } });
  await prisma.job.deleteMany({ where: { organizationId } });
  await prisma.invitation.deleteMany({ where: { organizationId } });
  await prisma.buyer.deleteMany({ where: { organizationId } });
  await prisma.businessUnit.deleteMany({ where: { organizationId } });
  await prisma.plant.deleteMany({ where: { organizationId } });
  await prisma.category.deleteMany({ where: { organizationId } });
  await prisma.material.deleteMany({ where: { organizationId } });
  await prisma.supplier.deleteMany({ where: { organizationId } });
}

async function upsertDemoOrganization(prisma: PrismaClient) {
  return prisma.organization.upsert({
    where: { slug: DEMO_WORKSPACE_SLUG },
    update: {
      name: DEMO_WORKSPACE_NAME,
      description:
        "Specialty masterbatch and compound manufacturing demo workspace for finance-trusted procurement savings governance.",
      workspaceTrialEndsAt: DEMO_TRIAL_END,
      defaultCurrency: Currency.USD,
      multiCurrencyEnabled: false,
    },
    create: {
      name: DEMO_WORKSPACE_NAME,
      slug: DEMO_WORKSPACE_SLUG,
      description:
        "Specialty masterbatch and compound manufacturing demo workspace for finance-trusted procurement savings governance.",
      workspaceTrialEndsAt: DEMO_TRIAL_END,
      defaultCurrency: Currency.USD,
      multiCurrencyEnabled: false,
    },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });
}

async function upsertDemoUsers(
  prisma: PrismaClient,
  organizationId: string
): Promise<UserLookup> {
  const users: UserLookup = {};

  for (const seed of UTOPIATRAX_DEMO_USERS) {
    const user = await prisma.user.upsert({
      where: {
        organizationId_email: {
          organizationId,
          email: normalizeEmail(seed.email),
        },
      },
      update: {
        name: seed.name,
        role: seed.role,
        activeOrganizationId: organizationId,
      },
      create: {
        organizationId,
        activeOrganizationId: organizationId,
        name: seed.name,
        email: normalizeEmail(seed.email),
        role: seed.role,
      },
    });

    await prisma.organizationMembership.upsert({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId,
        },
      },
      update: {
        role: seed.membershipRole,
        status: MembershipStatus.ACTIVE,
      },
      create: {
        userId: user.id,
        organizationId,
        role: seed.membershipRole,
        status: MembershipStatus.ACTIVE,
      },
    });

    users[seed.email] = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
    users[seed.name] = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }

  return users;
}

async function upsertBuyers(prisma: PrismaClient, organizationId: string) {
  const lookup: SeedLookup = {};

  for (const seed of UTOPIATRAX_BUYERS) {
    const buyer = await prisma.buyer.upsert({
      where: {
        organizationId_name: {
          organizationId,
          name: seed.name,
        },
      },
      update: {
        email: seed.email ?? null,
      },
      create: {
        organizationId,
        name: seed.name,
        email: seed.email ?? null,
      },
    });
    lookup[seed.name] = { id: buyer.id, name: buyer.name };
  }

  return lookup;
}

async function upsertSuppliers(prisma: PrismaClient, organizationId: string) {
  const lookup: SeedLookup = {};

  for (const seed of UTOPIATRAX_SUPPLIERS) {
    const supplier = await prisma.supplier.upsert({
      where: {
        organizationId_name: {
          organizationId,
          name: seed.name,
        },
      },
      update: {},
      create: {
        organizationId,
        name: seed.name,
      },
    });
    lookup[seed.name] = { id: supplier.id, name: supplier.name };
  }

  return lookup;
}

async function upsertMaterials(prisma: PrismaClient, organizationId: string) {
  const lookup: SeedLookup = {};

  for (const seed of UTOPIATRAX_MATERIALS) {
    const material = await prisma.material.upsert({
      where: {
        organizationId_name: {
          organizationId,
          name: seed.name,
        },
      },
      update: {},
      create: {
        organizationId,
        name: seed.name,
      },
    });
    lookup[seed.name] = { id: material.id, name: material.name };
  }

  return lookup;
}

async function upsertCategories(prisma: PrismaClient, organizationId: string) {
  const lookup: SeedLookup = {};

  for (const seed of UTOPIATRAX_DIRECT_CATEGORIES) {
    const category = await prisma.category.upsert({
      where: {
        organizationId_name: {
          organizationId,
          name: seed.name,
        },
      },
      update: {
        annualTarget: seed.annualTarget,
      },
      create: {
        organizationId,
        name: seed.name,
        annualTarget: seed.annualTarget,
      },
    });
    lookup[seed.name] = { id: category.id, name: category.name };
  }

  await prisma.category.deleteMany({
    where: {
      organizationId,
      name: {
        notIn: UTOPIATRAX_DIRECT_CATEGORIES.map((category) => category.name),
      },
      savingCards: {
        none: {},
      },
    },
  });

  return lookup;
}

async function upsertPlants(prisma: PrismaClient, organizationId: string) {
  const lookup: SeedLookup = {};

  for (const seed of UTOPIATRAX_PLANTS) {
    const plant = await prisma.plant.upsert({
      where: {
        organizationId_name: {
          organizationId,
          name: seed.name,
        },
      },
      update: {
        region: seed.region,
      },
      create: {
        organizationId,
        name: seed.name,
        region: seed.region,
      },
    });
    lookup[seed.name] = { id: plant.id, name: plant.name };
  }

  return lookup;
}

async function upsertBusinessUnits(prisma: PrismaClient, organizationId: string) {
  const lookup: SeedLookup = {};

  for (const seed of UTOPIATRAX_BUSINESS_UNITS) {
    const businessUnit = await prisma.businessUnit.upsert({
      where: {
        organizationId_name: {
          organizationId,
          name: seed.name,
        },
      },
      update: {},
      create: {
        organizationId,
        name: seed.name,
      },
    });
    lookup[seed.name] = { id: businessUnit.id, name: businessUnit.name };
  }

  return lookup;
}

async function seedAnnualTargets(
  prisma: PrismaClient,
  organizationId: string,
  categories: SeedLookup
) {
  await prisma.annualTarget.deleteMany({
    where: {
      organizationId,
      year: DEMO_YEAR,
    },
  });

  await prisma.annualTarget.createMany({
    data: UTOPIATRAX_DIRECT_CATEGORIES.map((category) => ({
      organizationId,
      year: DEMO_YEAR,
      categoryId: categories[category.name].id,
      targetValue: category.annualTarget,
    })),
  });
}

async function seedBillingAccess(prisma: PrismaClient, organizationId: string) {
  const billingCustomer = await prisma.billingCustomer.upsert({
    where: { organizationId },
    update: {
      stripeCustomerId: DEMO_BILLING_CUSTOMER_ID,
      email: "taylaniscan+4@gmail.com",
      name: DEMO_WORKSPACE_NAME,
      metadata: {
        demoMode: true,
        industry: "Specialty plastics / masterbatch manufacturing",
        companySize: "250 employees",
        reportingCurrency: "USD",
      },
    },
    create: {
      organizationId,
      stripeCustomerId: DEMO_BILLING_CUSTOMER_ID,
      email: "taylaniscan+4@gmail.com",
      name: DEMO_WORKSPACE_NAME,
      metadata: {
        demoMode: true,
        industry: "Specialty plastics / masterbatch manufacturing",
        companySize: "250 employees",
        reportingCurrency: "USD",
      },
    },
  });

  await prisma.subscription.deleteMany({
    where: {
      organizationId,
      stripeSubscriptionId: {
        not: DEMO_SUBSCRIPTION_ID,
      },
    },
  });

  await prisma.subscription.upsert({
    where: { stripeSubscriptionId: DEMO_SUBSCRIPTION_ID },
    update: {
      organizationId,
      billingCustomerId: billingCustomer.id,
      status: SubscriptionStatus.TRIALING,
      currencyCode: "eur",
      quantity: 4,
      cancelAtPeriodEnd: false,
      currentPeriodStart: new Date("2026-01-01T00:00:00.000Z"),
      currentPeriodEnd: DEMO_TRIAL_END,
      trialStart: new Date("2026-01-01T00:00:00.000Z"),
      trialEnd: DEMO_TRIAL_END,
      canceledAt: null,
      endedAt: null,
      metadata: {
        demoAccess: true,
        demoWorkspace: DEMO_WORKSPACE_NAME,
      },
    },
    create: {
      organizationId,
      billingCustomerId: billingCustomer.id,
      stripeSubscriptionId: DEMO_SUBSCRIPTION_ID,
      status: SubscriptionStatus.TRIALING,
      currencyCode: "eur",
      quantity: 4,
      cancelAtPeriodEnd: false,
      currentPeriodStart: new Date("2026-01-01T00:00:00.000Z"),
      currentPeriodEnd: DEMO_TRIAL_END,
      trialStart: new Date("2026-01-01T00:00:00.000Z"),
      trialEnd: DEMO_TRIAL_END,
      metadata: {
        demoAccess: true,
        demoWorkspace: DEMO_WORKSPACE_NAME,
      },
    },
  });
}

function getSupabaseAdminClientFromEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    return {
      client: null,
      warning:
        "Supabase Admin Auth and Storage were skipped because NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.",
    };
  }

  return {
    client: createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }),
    warning: null,
  };
}

async function findSupabaseAuthUserByEmail(
  supabase: SupabaseClient,
  email: string
) {
  let page = 1;

  while (true) {
    const { data, error } = await withTimeout(
      supabase.auth.admin.listUsers({
        page,
        perPage: 200,
      }),
      SUPABASE_OPERATION_TIMEOUT_MS,
      "Supabase Auth listUsers"
    );

    if (error) {
      throw error;
    }

    const user =
      data.users.find((item) => normalizeEmail(item.email ?? "") === email) ?? null;

    if (user) {
      return user;
    }

    if (!data.nextPage || data.nextPage === page) {
      return null;
    }

    page = data.nextPage;
  }
}

async function syncDemoAuthUsers(input: {
  supabase: SupabaseClient | null;
  organizationId: string;
  users: UserLookup;
  warnings: string[];
}) {
  if (!input.supabase) {
    return {
      count: 0,
      skipped: true,
    };
  }

  let count = 0;

  for (const seed of UTOPIATRAX_DEMO_USERS) {
    const email = normalizeEmail(seed.email);
    const user = input.users[email] ?? input.users[seed.name];

    if (!user) {
      input.warnings.push(`Auth sync skipped for ${email}; Prisma user was not found.`);
      continue;
    }

    try {
      const existingAuthUser = await findSupabaseAuthUserByEmail(input.supabase, email);
      const authPayload = {
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: {
          name: seed.name,
          full_name: seed.name,
          demoWorkspace: DEMO_WORKSPACE_NAME,
        },
        app_metadata: {
          ...(existingAuthUser?.app_metadata ?? {}),
          userId: user.id,
          activeOrganizationId: input.organizationId,
          demoWorkspace: DEMO_WORKSPACE_NAME,
        },
      };

      // Supabase Auth hashes and stores the password outside the application database.
      // The seed never writes the plaintext demo password to Prisma tables and does
      // not send invitation email; Admin create/update confirms the account directly.
      if (existingAuthUser) {
        const { error } = await withTimeout(
          input.supabase.auth.admin.updateUserById(existingAuthUser.id, authPayload),
          SUPABASE_OPERATION_TIMEOUT_MS,
          `Supabase Auth updateUserById for ${email}`
        );

        if (error) {
          throw error;
        }
      } else {
        const { error } = await withTimeout(
          input.supabase.auth.admin.createUser({
            email,
            ...authPayload,
          }),
          SUPABASE_OPERATION_TIMEOUT_MS,
          `Supabase Auth createUser for ${email}`
        );

        if (error) {
          throw error;
        }
      }

      count += 1;
    } catch (error) {
      input.warnings.push(
        `Auth user ${email} could not be created or updated: ${
          error instanceof Error ? error.message : "Unknown Supabase Auth error"
        }`
      );
    }
  }

  return {
    count,
    skipped: count === 0,
  };
}

async function ensureEvidenceBucket(supabase: SupabaseClient | null, warnings: string[]) {
  if (process.env.DEMO_SEED_SKIP_STORAGE === "1") {
    warnings.push("Evidence storage uploads were skipped because DEMO_SEED_SKIP_STORAGE=1.");
    return false;
  }

  if (!supabase) {
    return false;
  }

  const { error } = await withTimeout(
    supabase.storage.createBucket(DEMO_STORAGE_BUCKET, {
      public: false,
    }),
    SUPABASE_OPERATION_TIMEOUT_MS,
    "Supabase Storage createBucket"
  );

  if (!error) {
    return true;
  }

  if (/already|exist|duplicate/iu.test(error.message)) {
    return true;
  }

  warnings.push(`Evidence storage bucket is unavailable: ${error.message}`);
  return false;
}

async function uploadEvidenceObject(input: {
  supabase: SupabaseClient | null;
  storageEnabled: boolean;
  storagePath: string;
  content: string;
  warnings: string[];
}) {
  if (!input.supabase || !input.storageEnabled) {
    return false;
  }

  if (storageUploadFailureSeen) {
    return false;
  }

  const fileBody = createDemoEvidencePdf(input.content);
  const { error } = await withTimeout(
    input.supabase.storage
      .from(DEMO_STORAGE_BUCKET)
      .upload(input.storagePath, fileBody, {
        contentType: "application/pdf",
        upsert: true,
      }),
    SUPABASE_OPERATION_TIMEOUT_MS,
    `Supabase Storage upload for ${input.storagePath}`
  );

  if (error) {
    storageUploadFailureSeen = true;
    input.warnings.push(
      `Evidence object ${input.storagePath} could not be uploaded: ${error.message}`
    );
    input.warnings.push("Remaining evidence uploads were skipped after the first storage failure.");
    return false;
  }

  return true;
}

function createDemoEvidencePdf(content: string) {
  const lines = content
    .split(/\r?\n/u)
    .flatMap((line) => {
      const normalized = line.replace(/[^\x20-\x7E]/gu, "").trimEnd();
      if (!normalized) return [""];

      const chunks: string[] = [];
      for (let index = 0; index < normalized.length; index += 88) {
        chunks.push(normalized.slice(index, index + 88));
      }
      return chunks;
    })
    .slice(0, 46);
  const stream = [
    "BT",
    "/F1 10 Tf",
    "50 750 Td",
    "14 TL",
    ...lines.flatMap((line, index) => [
      `(${line.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)")}) Tj`,
      ...(index < lines.length - 1 ? ["T*"] : []),
    ]),
    "ET",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "ascii"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "ascii");
}

function buildEvidenceStoragePath(
  organizationId: string,
  savingCardId: string,
  fileName: string
) {
  return `organizations/${organizationId}/saving-cards/${savingCardId}/evidence/${fileName}`;
}

export function shouldPersistUtopiaTraxEvidenceRecord(uploaded: boolean) {
  return uploaded;
}

function resolveProjectDates(card: UtopiaTraxSavingCardSeed) {
  const impactStartDate = parseDate(card.impactStart);
  const impactEndDate = parseDate(card.impactEnd);

  return {
    startDate: addDays(impactStartDate, -75),
    endDate: addDays(impactStartDate, -7),
    impactStartDate,
    impactEndDate,
  };
}

function resolveFxRate(currency: Currency) {
  return currency === Currency.USD ? 1 : EUR_TO_USD_RATE;
}

function resolveVolumeUnit(materialName: string) {
  if (materialName.includes("Service") || materialName.includes("Tolling")) {
    return "service units";
  }

  if (materialName.includes("Bags")) {
    return "bags";
  }

  if (materialName.includes("Octabin")) {
    return "octabins";
  }

  return "kg";
}

function getApproverByRole(users: UserLookup, role: Role) {
  switch (role) {
    case Role.HEAD_OF_GLOBAL_PROCUREMENT:
      return users["taylaniscan+4@gmail.com"];
    case Role.FINANCIAL_CONTROLLER:
      return users["taylaniscan+5@gmail.com"];
    case Role.GLOBAL_CATEGORY_LEADER:
      return users["taylaniscan+6@gmail.com"];
    default:
      return users["taylaniscan+4@gmail.com"];
  }
}

function getRequiredApproverRoles(phase: Phase): Role[] {
  switch (phase) {
    case Phase.VALIDATED:
      return [Role.HEAD_OF_GLOBAL_PROCUREMENT, Role.FINANCIAL_CONTROLLER];
    case Phase.REALISED:
      return [Role.FINANCIAL_CONTROLLER];
    case Phase.ACHIEVED:
      return [Role.FINANCIAL_CONTROLLER];
    case Phase.CANCELLED:
      return [Role.HEAD_OF_GLOBAL_PROCUREMENT, Role.FINANCIAL_CONTROLLER];
    case Phase.IDEA:
    default:
      return [Role.HEAD_OF_GLOBAL_PROCUREMENT];
  }
}

function getPhaseTransitions(card: UtopiaTraxSavingCardSeed) {
  const transitions: Array<{
    fromPhase: Phase | null;
    toPhase: Phase;
  }> = [{ fromPhase: null, toPhase: Phase.IDEA }];

  if (
    card.phase === Phase.VALIDATED ||
    card.phase === Phase.REALISED ||
    card.phase === Phase.ACHIEVED ||
    card.phase === Phase.CANCELLED
  ) {
    transitions.push({ fromPhase: Phase.IDEA, toPhase: Phase.VALIDATED });
  }

  if (card.phase === Phase.REALISED || card.phase === Phase.ACHIEVED) {
    transitions.push({ fromPhase: Phase.VALIDATED, toPhase: Phase.REALISED });
  }

  if (card.phase === Phase.ACHIEVED) {
    transitions.push({ fromPhase: Phase.REALISED, toPhase: Phase.ACHIEVED });
  }

  if (card.phase === Phase.CANCELLED) {
    transitions.push({ fromPhase: Phase.VALIDATED, toPhase: Phase.CANCELLED });
  }

  return transitions;
}

function buildPhaseHistoryRows(
  savingCardId: string,
  card: UtopiaTraxSavingCardSeed,
  users: UserLookup
) {
  const dates = resolveProjectDates(card);
  const transitionDates = [
    addDays(dates.startDate, 0),
    addDays(dates.startDate, 21),
    addDays(dates.startDate, 55),
    addDays(dates.startDate, 82),
  ];

  return getPhaseTransitions(card).map((transition, index) => ({
    savingCardId,
    fromPhase: transition.fromPhase,
    toPhase: transition.toPhase,
    changedById:
      transition.toPhase === Phase.REALISED || transition.toPhase === Phase.ACHIEVED
        ? users["taylaniscan+5@gmail.com"].id
        : transition.toPhase === Phase.CANCELLED
          ? users["taylaniscan+4@gmail.com"].id
          : users["taylaniscan+6@gmail.com"].id,
    createdAt: transitionDates[index] ?? addDays(dates.startDate, index * 21),
  }));
}

async function clearSavingCardChildren(prisma: PrismaClient, savingCardId: string) {
  await prisma.phaseChangeRequestApproval.deleteMany({
    where: { phaseChangeRequest: { savingCardId } },
  });
  await prisma.phaseChangeRequest.deleteMany({ where: { savingCardId } });
  await prisma.auditLog.deleteMany({ where: { savingCardId } });
  await prisma.phaseHistory.deleteMany({ where: { savingCardId } });
  await prisma.savingCardComment.deleteMany({ where: { savingCardId } });
  await prisma.savingCardAlternativeMaterial.deleteMany({ where: { savingCardId } });
  await prisma.savingCardAlternativeSupplier.deleteMany({ where: { savingCardId } });
  await prisma.savingCardEvidence.deleteMany({ where: { savingCardId } });
  await prisma.savingCardStakeholder.deleteMany({ where: { savingCardId } });
  await prisma.materialConsumptionActual.deleteMany({ where: { savingCardId } });
  await prisma.materialConsumptionForecast.deleteMany({ where: { savingCardId } });
}

async function deleteSavingCardWithChildren(prisma: PrismaClient, savingCardId: string) {
  await clearSavingCardChildren(prisma, savingCardId);
  await prisma.savingCard.delete({ where: { id: savingCardId } });
}

async function upsertSavingCardShell(input: {
  prisma: PrismaClient;
  organizationId: string;
  card: UtopiaTraxSavingCardSeed;
  lookups: {
    suppliers: SeedLookup;
    materials: SeedLookup;
    categories: SeedLookup;
    plants: SeedLookup;
    businessUnits: SeedLookup;
    buyers: SeedLookup;
  };
}) {
  const { prisma, organizationId, card, lookups } = input;
  const existingCards = await prisma.savingCard.findMany({
    where: {
      organizationId,
      title: card.title,
    },
    select: {
      id: true,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const [existingCard, ...duplicates] = existingCards;

  for (const duplicate of duplicates) {
    await deleteSavingCardWithChildren(prisma, duplicate.id);
  }

  if (existingCard) {
    await clearSavingCardChildren(prisma, existingCard.id);
  }

  const dates = resolveProjectDates(card);
  const fxRate = resolveFxRate(card.currency);
  const referencePrice = card.referencePrice ?? null;
  const savings = calculateSavings({
    baselinePrice: card.baselinePrice,
    newPrice: card.newPrice,
    annualVolume: card.annualVolume,
    currency: card.currency,
    fxRate,
    impactType: card.impactType,
    referencePrice,
  });
  const periodized = calculatePeriodizedSavings({
    baselinePrice: card.baselinePrice,
    newPrice: card.newPrice,
    annualVolume: card.annualVolume,
    currency: card.currency,
    fxRate,
    impactType: card.impactType,
    referencePrice,
    impactStartDate: dates.impactStartDate,
    impactEndDate: dates.impactEndDate,
    fiscalYear: { startMonth: UTOPIATRAX_FISCAL_YEAR_START_MONTH },
  });
  const data = {
    organizationId,
    title: card.title,
    description: card.narrative,
    legacySavingsMethod: card.legacySavingsMethod,
    savingType: card.savingType,
    impactType: card.impactType,
    impactRecurrence: card.impactRecurrence,
    budgetImpact: card.budgetImpact,
    phase: card.phase,
    supplierId: lookups.suppliers[card.supplierName].id,
    materialId: lookups.materials[card.materialName].id,
    alternativeSupplierId: card.alternativeSupplierName
      ? lookups.suppliers[card.alternativeSupplierName].id
      : null,
    alternativeSupplierManualName: null,
    alternativeMaterialId: null,
    alternativeMaterialManualName: null,
    categoryId: lookups.categories[card.categoryName].id,
    plantId: lookups.plants[card.plantName].id,
    businessUnitId: lookups.businessUnits[card.businessUnitName].id,
    buyerId: lookups.buyers[card.buyerName].id,
    baselinePrice: card.baselinePrice,
    newPrice: card.newPrice,
    referencePrice,
    annualVolume: card.annualVolume,
    volumeUnit: resolveVolumeUnit(card.materialName),
    currency: card.currency,
    fxRate,
    calculatedSavings: savings.localSavings,
    calculatedSavingsUSD: savings.savingsUSD,
    annualizedRunRate: periodized.annualizedRunRate,
    annualizedRunRateUSD: periodized.annualizedRunRateUSD,
    inYearValue: periodized.inYearValue,
    inYearValueUSD: periodized.inYearValueUSD,
    frequency: Frequency.RECURRING,
    savingDriver: card.savingDriver,
    implementationComplexity: card.implementationComplexity,
    qualificationStatus: card.qualificationStatus,
    startDate: dates.startDate,
    endDate: dates.endDate,
    impactStartDate: dates.impactStartDate,
    impactEndDate: dates.impactEndDate,
    financeLocked: card.financeLocked ?? false,
    cancellationReason: card.cancellationReason ?? null,
  };

  if (existingCard) {
    return prisma.savingCard.update({
      where: { id: existingCard.id },
      data,
    });
  }

  return prisma.savingCard.create({ data });
}

async function seedSavingCardRelations(input: {
  prisma: PrismaClient;
  organizationId: string;
  card: UtopiaTraxSavingCardSeed;
  savingCardId: string;
  users: UserLookup;
  suppliers: SeedLookup;
  materials: SeedLookup;
  supabase: SupabaseClient | null;
  storageEnabled: boolean;
  warnings: string[];
}) {
  const {
    prisma,
    organizationId,
    card,
    savingCardId,
    users,
    suppliers,
    materials,
    supabase,
    storageEnabled,
    warnings,
  } = input;
  const buyerUser = users[card.buyerName] ?? users["taylaniscan+4@gmail.com"];
  const financeUser = users["taylaniscan+5@gmail.com"];
  const headUser = users["taylaniscan+4@gmail.com"];
  const phaseRows = buildPhaseHistoryRows(savingCardId, card, users);
  let evidenceRecords = 0;
  let evidenceFilesUploaded = 0;
  let alternatives = 0;
  let approvalRecords = 0;
  let phaseChangeRequests = 0;
  let volumeForecastRows = 0;
  let volumeActualRows = 0;

  await prisma.savingCardStakeholder.createMany({
    data: [
      { savingCardId, userId: buyerUser.id },
      { savingCardId, userId: financeUser.id },
      { savingCardId, userId: headUser.id },
    ],
    skipDuplicates: true,
  });

  await prisma.savingCardComment.create({
    data: {
      savingCardId,
      authorId: buyerUser.id,
      body: `${card.narrative} Seeded for the ${DEMO_WORKSPACE_NAME} manufacturing savings demo.`,
      createdAt: addDays(resolveProjectDates(card).startDate, 3),
    },
  });

  await prisma.phaseHistory.createMany({
    data: phaseRows,
  });

  for (const transition of getPhaseTransitions(card).filter(
    (item) => item.fromPhase !== null
  )) {
    const requestedPhase = transition.toPhase;
    const requestedAt =
      phaseRows.find((row) => row.toPhase === requestedPhase)?.createdAt ??
      resolveProjectDates(card).startDate;
    const approverRoles = getRequiredApproverRoles(requestedPhase);
    const status =
      card.phase === Phase.CANCELLED && requestedPhase === Phase.REALISED
        ? ApprovalStatus.REJECTED
        : ApprovalStatus.APPROVED;

    const phaseChangeRequest = await prisma.phaseChangeRequest.create({
      data: {
        savingCardId,
        currentPhase: transition.fromPhase ?? Phase.IDEA,
        requestedPhase,
        requestedById: buyerUser.id,
        approvalStatus: status,
        comment:
          status === ApprovalStatus.REJECTED
            ? "Rejected during validation; customer or quality approval did not hold."
            : `Historical demo approval for movement to ${requestedPhase}.`,
        cancellationReason:
          requestedPhase === Phase.CANCELLED ? card.cancellationReason ?? null : null,
        createdAt: requestedAt,
        updatedAt: addDays(requestedAt, 1),
        approvals: {
          create: approverRoles.map((role) => {
            const approver = getApproverByRole(users, role);

            return {
              approverId: approver.id,
              role,
              status,
              comment:
                status === ApprovalStatus.REJECTED
                  ? "Rejected in demo validation history."
                  : "Approved in demo workflow history.",
              decidedAt: addDays(requestedAt, 1),
              createdAt: requestedAt,
            };
          }),
        },
      },
    });
    phaseChangeRequests += 1;
    const decisionAt = addDays(requestedAt, 1);
    const approverAuditRows = approverRoles.map((role) => {
      const approver = getApproverByRole(users, role);

      return {
        organizationId,
        userId: approver.id,
        actorUserId: approver.id,
        savingCardId,
        targetEntityId: phaseChangeRequest.id,
        eventType:
          status === ApprovalStatus.APPROVED
            ? auditEventTypes.PHASE_CHANGE_APPROVED
            : auditEventTypes.PHASE_CHANGE_REJECTED,
        action:
          status === ApprovalStatus.APPROVED
            ? auditEventTypes.PHASE_CHANGE_APPROVED
            : auditEventTypes.PHASE_CHANGE_REJECTED,
        detail:
          status === ApprovalStatus.APPROVED
            ? `Demo approval recorded for phase change to ${requestedPhase}.`
            : `Demo rejection recorded for phase change to ${requestedPhase}.`,
        createdAt: decisionAt,
      };
    });
    const completionAuditRows =
      status === ApprovalStatus.APPROVED
        ? [
            {
              organizationId,
              userId: getApproverByRole(
                users,
                approverRoles.at(-1) ?? Role.HEAD_OF_GLOBAL_PROCUREMENT
              ).id,
              actorUserId: getApproverByRole(
                users,
                approverRoles.at(-1) ?? Role.HEAD_OF_GLOBAL_PROCUREMENT
              ).id,
              savingCardId,
              targetEntityId: phaseChangeRequest.id,
              eventType: auditEventTypes.PHASE_CHANGE_COMPLETED,
              action: auditEventTypes.PHASE_CHANGE_COMPLETED,
              detail: `Demo phase changed from ${transition.fromPhase ?? Phase.IDEA} to ${requestedPhase}.`,
              createdAt: decisionAt,
            },
          ]
        : [];

    await prisma.auditLog.createMany({
      data: [
        {
          organizationId,
          userId: buyerUser.id,
          actorUserId: buyerUser.id,
          savingCardId,
          targetEntityId: phaseChangeRequest.id,
          eventType: auditEventTypes.PHASE_CHANGE_REQUESTED,
          action: auditEventTypes.PHASE_CHANGE_REQUESTED,
          detail: `Demo requested phase change from ${transition.fromPhase ?? Phase.IDEA} to ${requestedPhase}.`,
          createdAt: requestedAt,
        },
        ...approverAuditRows,
        ...completionAuditRows,
      ],
    });

    approvalRecords += approverRoles.length;
  }

  if (card.alternative) {
    const alternativeSeed = card.alternative;
    const alternativeSupplier = suppliers[alternativeSeed.supplierName];
    const alternativeMaterial = materials[alternativeSeed.materialName ?? card.materialName];

    await prisma.savingCardAlternativeSupplier.create({
      data: {
        savingCardId,
        supplierId: alternativeSupplier?.id ?? null,
        supplierNameManual: alternativeSupplier ? null : alternativeSeed.supplierName,
        country: alternativeSeed.country,
        quotedPrice: alternativeSeed.quotedPrice,
        currency: alternativeSeed.currency,
        leadTimeDays: alternativeSeed.leadTimeDays,
        moq: alternativeSeed.moq,
        paymentTerms: alternativeSeed.paymentTerms,
        qualityRating: alternativeSeed.qualityRating,
        riskLevel: alternativeSeed.riskLevel,
        notes: alternativeSeed.notes,
        isSelected: alternativeSeed.isSelected,
        createdAt: addDays(resolveProjectDates(card).startDate, 18),
      },
    });
    alternatives += 1;

    await prisma.savingCardAlternativeMaterial.create({
      data: {
        savingCardId,
        materialId: alternativeMaterial?.id ?? null,
        materialNameManual: alternativeMaterial ? null : alternativeSeed.materialName ?? card.materialName,
        supplierId: alternativeSupplier?.id ?? null,
        supplierNameManual: alternativeSupplier ? null : alternativeSeed.supplierName,
        specification: `${alternativeSeed.materialName ?? card.materialName} qualified equivalent`,
        quotedPrice: alternativeSeed.quotedPrice,
        currency: alternativeSeed.currency,
        performanceImpact: alternativeSeed.performanceImpact,
        qualificationStatus: alternativeSeed.qualificationStatus,
        riskLevel: alternativeSeed.riskLevel,
        notes: alternativeSeed.notes,
        isSelected: alternativeSeed.isSelected,
        createdAt: addDays(resolveProjectDates(card).startDate, 19),
      },
    });
    alternatives += 1;
  }

  for (const item of card.evidence) {
    const storagePath = buildEvidenceStoragePath(
      organizationId,
      savingCardId,
      item.fileName
    );
    const evidenceDocument = [
      `${DEMO_WORKSPACE_NAME} demo evidence`,
      `Saving card: ${card.title}`,
      `Document: ${item.label}`,
      "",
      item.content,
      "",
      "Synthetic demonstration evidence. No customer or production data is included.",
      "Prepared for a controlled finance-validation walkthrough in the UtopiaTrax workspace.",
    ].join("\n");
    const uploaded = await uploadEvidenceObject({
      supabase,
      storageEnabled,
      storagePath,
      content: evidenceDocument,
      warnings,
    });

    if (!shouldPersistUtopiaTraxEvidenceRecord(uploaded)) {
      continue;
    }

    await prisma.savingCardEvidence.create({
      data: {
        savingCardId,
        fileName: item.fileName,
        evidenceType: item.evidenceType,
        storageBucket: DEMO_STORAGE_BUCKET,
        storagePath,
        fileSize: createDemoEvidencePdf(evidenceDocument).length,
        fileType: "application/pdf",
        uploadedById: buyerUser.id,
        uploadedAt: addDays(resolveProjectDates(card).startDate, 25),
      },
    });
    evidenceRecords += 1;
    evidenceFilesUploaded += 1;
  }

  if (card.volumeProfile) {
    const dates = resolveProjectDates(card);
    const periods = monthRange(dates.impactStartDate, dates.impactEndDate);
    const forecastQty = card.annualVolume / periods.length;
    const actualCutoff = new Date("2026-04-01T00:00:00.000Z");

    for (const [index, period] of periods.entries()) {
      await prisma.materialConsumptionForecast.create({
        data: {
          savingCardId,
          materialId: materials[card.materialName].id,
          supplierId: suppliers[card.supplierName].id,
          period,
          forecastQty,
          unit: resolveVolumeUnit(card.materialName),
          source: ForecastSource.MANUAL_ENTRY,
          notes: `Demo monthly forecast ${index + 1}/${periods.length}.`,
          createdById: buyerUser.id,
          createdAt: addDays(dates.startDate, 4),
        },
      });
      volumeForecastRows += 1;

      if (period.getTime() < actualCutoff.getTime()) {
        const multiplier =
          card.volumeProfile === "behind"
            ? 0.86
            : card.volumeProfile === "ahead"
              ? 1.08
              : 1.01;

        await prisma.materialConsumptionActual.create({
          data: {
            savingCardId,
            materialId: materials[card.materialName].id,
            supplierId: suppliers[card.supplierName].id,
            period,
            actualQty: forecastQty * multiplier,
            unit: resolveVolumeUnit(card.materialName),
            source: ForecastSource.MANUAL_ENTRY,
            invoiceRef: `UTX-${period.toISOString().slice(0, 7)}-${index + 1}`,
            confirmedById: financeUser.id,
            createdAt: addDays(period, 20),
          },
        });
        volumeActualRows += 1;
      }
    }
  }

  await prisma.auditLog.createMany({
    data: [
      {
        organizationId,
        userId: buyerUser.id,
        actorUserId: buyerUser.id,
        savingCardId,
        eventType: "demo.saving_card.seeded",
        action: "demo.saving_card.seeded",
        detail: `Seeded ${card.title} in ${card.phase} phase.`,
        payload: {
          phase: card.phase,
          financeLocked: card.financeLocked ?? false,
          evidenceCount: card.evidence.length,
        } as Prisma.InputJsonValue,
        createdAt: addDays(resolveProjectDates(card).startDate, 2),
      },
      ...(card.financeLocked
        ? [
            {
              organizationId,
              userId: financeUser.id,
              actorUserId: financeUser.id,
              savingCardId,
              eventType: "demo.finance_lock.seeded",
              action: "demo.finance_lock.seeded",
              detail: `Finance lock seeded for ${card.title}.`,
              payload: {
                baselinePrice: card.baselinePrice,
                newPrice: card.newPrice,
                annualVolume: card.annualVolume,
                currency: card.currency,
              } as Prisma.InputJsonValue,
              createdAt: addDays(resolveProjectDates(card).startDate, 28),
            },
          ]
        : []),
    ],
  });

  return {
    evidenceRecords,
    evidenceFilesUploaded,
    alternatives,
    phaseHistoryEntries: phaseRows.length,
    approvalRecords,
    phaseChangeRequests,
    volumeForecastRows,
    volumeActualRows,
  };
}

async function seedPendingPhaseRequests(input: {
  prisma: PrismaClient;
  organizationId: string;
  users: UserLookup;
  savingCardsByTitle: Record<string, { id: string; phase: Phase; title: string }>;
}) {
  const { prisma, organizationId, users, savingCardsByTitle } = input;
  let pendingOpenActions = 0;
  let phaseChangeRequests = 0;

  for (const pending of UTOPIATRAX_PENDING_PHASE_REQUESTS) {
    const card = savingCardsByTitle[pending.cardTitle];

    if (!card) {
      continue;
    }

    const requestedBy = users[pending.requestedByEmail];
    const approverRoles = getRequiredApproverRoles(pending.requestedPhase);
    const createdAt = parseDateTime(pending.createdAt);

    const phaseChangeRequest = await prisma.phaseChangeRequest.create({
      data: {
        savingCardId: card.id,
        currentPhase: card.phase,
        requestedPhase: pending.requestedPhase,
        requestedById: requestedBy.id,
        approvalStatus: ApprovalStatus.PENDING,
        comment: pending.comment,
        createdAt,
        updatedAt: createdAt,
        approvals: {
          create: approverRoles.map((role) => {
            const approver = getApproverByRole(users, role);

            return {
              approverId: approver.id,
              role,
              status: ApprovalStatus.PENDING,
              createdAt,
            };
          }),
        },
      },
    });
    pendingOpenActions += approverRoles.length;
    phaseChangeRequests += 1;

    await prisma.auditLog.create({
      data: {
        organizationId,
        userId: requestedBy.id,
        actorUserId: requestedBy.id,
        savingCardId: card.id,
        targetEntityId: phaseChangeRequest.id,
        eventType: auditEventTypes.PHASE_CHANGE_REQUESTED,
        action: auditEventTypes.PHASE_CHANGE_REQUESTED,
        detail: `Demo requested phase change from ${card.phase} to ${pending.requestedPhase}.`,
        createdAt,
      },
    });

    await prisma.notification.createMany({
      data: approverRoles.map((role) => {
        const approver = getApproverByRole(users, role);

        return {
          organizationId,
          userId: approver.id,
          title: "Phase change requested",
          message: `${card.title} requests movement from ${card.phase} to ${pending.requestedPhase}.`,
          href: "/open-actions",
          createdAt,
        };
      }),
    });
  }

  return {
    pendingOpenActions,
    phaseChangeRequests,
  };
}

async function seedSavingCards(input: {
  prisma: PrismaClient;
  organizationId: string;
  users: UserLookup;
  lookups: {
    suppliers: SeedLookup;
    materials: SeedLookup;
    categories: SeedLookup;
    plants: SeedLookup;
    businessUnits: SeedLookup;
    buyers: SeedLookup;
  };
  supabase: SupabaseClient | null;
  storageEnabled: boolean;
  warnings: string[];
}) {
  const { prisma, organizationId, users, lookups, supabase, storageEnabled, warnings } =
    input;
  const savingCardsByTitle: Record<string, { id: string; phase: Phase; title: string }> = {};
  const totals = {
    savingCards: 0,
    evidenceRecords: 0,
    evidenceFilesUploaded: 0,
    alternatives: 0,
    phaseHistoryEntries: 0,
    approvalRecords: 0,
    phaseChangeRequests: 0,
    pendingOpenActions: 0,
    volumeForecastRows: 0,
    volumeActualRows: 0,
  };

  for (const card of UTOPIATRAX_SAVING_CARDS) {
    logSeedStep(`seeding saving card: ${card.title}`);
    const savedCard = await upsertSavingCardShell({
      prisma,
      organizationId,
      card,
      lookups,
    });

    savingCardsByTitle[card.title] = {
      id: savedCard.id,
      phase: savedCard.phase,
      title: savedCard.title,
    };

    const relationTotals = await seedSavingCardRelations({
      prisma,
      organizationId,
      card,
      savingCardId: savedCard.id,
      users,
      suppliers: lookups.suppliers,
      materials: lookups.materials,
      supabase,
      storageEnabled,
      warnings,
    });

    totals.savingCards += 1;
    totals.evidenceRecords += relationTotals.evidenceRecords;
    totals.evidenceFilesUploaded += relationTotals.evidenceFilesUploaded;
    totals.alternatives += relationTotals.alternatives;
    totals.phaseHistoryEntries += relationTotals.phaseHistoryEntries;
    totals.approvalRecords += relationTotals.approvalRecords;
    totals.phaseChangeRequests += relationTotals.phaseChangeRequests;
    totals.volumeForecastRows += relationTotals.volumeForecastRows;
    totals.volumeActualRows += relationTotals.volumeActualRows;
  }

  const pendingTotals = await seedPendingPhaseRequests({
    prisma,
    organizationId,
    users,
    savingCardsByTitle,
  });
  totals.pendingOpenActions += pendingTotals.pendingOpenActions;
  totals.phaseChangeRequests += pendingTotals.phaseChangeRequests;

  return totals;
}

async function seedWorkspaceProfileAudit(
  prisma: PrismaClient,
  organizationId: string,
  actorUserId: string
) {
  await prisma.auditLog.create({
    data: {
      organizationId,
      userId: actorUserId,
      actorUserId,
      targetEntityId: organizationId,
      eventType: "demo.workspace_profile.seeded",
      action: "demo.workspace_profile.seeded",
      detail: "UtopiaTrax demo workspace profile seeded.",
      payload: {
        industry: "Specialty plastics / masterbatch manufacturing",
        companySize: "250 employees",
        reportingCurrency: "USD",
        fiscalYearStartMonth: "January",
        defaultSavingsMethodology:
          "Baseline price minus new price times annual volume",
        demoMode: true,
        onboardingCompleted: true,
        regions: UTOPIATRAX_PLANTS.map((plant) => plant.name),
      } as Prisma.InputJsonValue,
    },
  });
}

export async function seedUtopiaTraxDemo(
  prisma: PrismaClient,
  options: { reset?: boolean } = {}
): Promise<UtopiaTraxSeedResult> {
  assertDemoSeedEnvironment();
  const validationErrors = validateUtopiaTraxDemoDataset();

  if (validationErrors.length) {
    throw new Error(`UtopiaTrax dataset is invalid:\n${validationErrors.join("\n")}`);
  }

  if (options.reset) {
    logSeedStep("reset requested; deleting only the UtopiaTrax demo workspace graph");
    await resetUtopiaTraxDemoWorkspace(prisma);
  }

  const warnings: string[] = [];
  logSeedStep("upserting workspace profile");
  const organization = await upsertDemoOrganization(prisma);

  logSeedStep("clearing generated demo notifications and audit rows");
  await prisma.notification.deleteMany({
    where: { organizationId: organization.id },
  });
  await prisma.auditLog.deleteMany({
    where: { organizationId: organization.id },
  });

  logSeedStep("upserting demo users and memberships");
  const users = await upsertDemoUsers(prisma, organization.id);
  logSeedStep("upserting procurement master data");
  const buyers = await upsertBuyers(prisma, organization.id);
  const suppliers = await upsertSuppliers(prisma, organization.id);
  const materials = await upsertMaterials(prisma, organization.id);
  const categories = await upsertCategories(prisma, organization.id);
  const plants = await upsertPlants(prisma, organization.id);
  const businessUnits = await upsertBusinessUnits(prisma, organization.id);

  logSeedStep("seeding targets, billing access, and workspace profile audit");
  await seedAnnualTargets(prisma, organization.id, categories);
  await seedBillingAccess(prisma, organization.id);
  await seedWorkspaceProfileAudit(
    prisma,
    organization.id,
    users["taylaniscan+4@gmail.com"].id
  );

  const supabaseContext = getSupabaseAdminClientFromEnv();
  if (supabaseContext.warning) {
    warnings.push(supabaseContext.warning);
  }

  logSeedStep("syncing Supabase Auth demo users when service-role access is available");
  const authResult = await syncDemoAuthUsers({
    supabase: supabaseContext.client,
    organizationId: organization.id,
    users,
    warnings,
  });
  logSeedStep("preparing private evidence storage when service-role access is available");
  const storageEnabled = await ensureEvidenceBucket(supabaseContext.client, warnings);

  if (!storageEnabled) {
    warnings.push(
      "Evidence database records were skipped because private storage upload is not available. Configure Supabase service-role storage and rerun the seed to create evidence files."
    );
  }

  logSeedStep("seeding saving cards, evidence, alternatives, approvals, and volume rows");
  const cardTotals = await seedSavingCards({
    prisma,
    organizationId: organization.id,
    users,
    lookups: {
      suppliers,
      materials,
      categories,
      plants,
      businessUnits,
      buyers,
    },
    supabase: supabaseContext.client,
    storageEnabled,
    warnings,
  });

  logSeedStep("invalidating portfolio/readiness caches");
  invalidatePortfolioSurfaceCaches(organization.id);

  return {
    organizationId: organization.id,
    organizationName: organization.name,
    users: UTOPIATRAX_DEMO_USERS.length,
    categories: UTOPIATRAX_DIRECT_CATEGORIES.length,
    suppliers: UTOPIATRAX_SUPPLIERS.length,
    materials: UTOPIATRAX_MATERIALS.length,
    buyers: UTOPIATRAX_BUYERS.length,
    plants: UTOPIATRAX_PLANTS.length,
    businessUnits: UTOPIATRAX_BUSINESS_UNITS.length,
    savingCards: cardTotals.savingCards,
    evidenceRecords: cardTotals.evidenceRecords,
    evidenceFilesUploaded: cardTotals.evidenceFilesUploaded,
    alternatives: cardTotals.alternatives,
    phaseHistoryEntries: cardTotals.phaseHistoryEntries,
    approvalRecords: cardTotals.approvalRecords,
    phaseChangeRequests: cardTotals.phaseChangeRequests,
    pendingOpenActions: cardTotals.pendingOpenActions,
    volumeForecastRows: cardTotals.volumeForecastRows,
    volumeActualRows: cardTotals.volumeActualRows,
    authUsersCreatedOrUpdated: authResult.count,
    authSkipped: authResult.skipped,
    storageSkipped: !storageEnabled,
    warnings,
  };
}

function printSeedSummary(result: UtopiaTraxSeedResult) {
  const summary = getUtopiaTraxDatasetSummary();

  console.info("");
  console.info(`UtopiaTrax demo seed complete for ${result.organizationName}.`);
  console.info(`Workspace id: ${result.organizationId}`);
  console.info(`Users created/updated: ${result.users}`);
  console.info(`Categories created/updated: ${result.categories}`);
  console.info(`Suppliers created/updated: ${result.suppliers}`);
  console.info(`Materials created/updated: ${result.materials}`);
  console.info(`Buyers created/updated: ${result.buyers}`);
  console.info(`Plants created/updated: ${result.plants}`);
  console.info(`Business units created/updated: ${result.businessUnits}`);
  console.info(`Saving cards created/updated: ${result.savingCards}`);
  console.info(`Phase distribution: ${JSON.stringify(summary.phaseCounts)}`);
  console.info(`Evidence records created: ${result.evidenceRecords}`);
  console.info(`Evidence files uploaded: ${result.evidenceFilesUploaded}`);
  console.info(`Alternatives created: ${result.alternatives}`);
  console.info(`Phase history rows created: ${result.phaseHistoryEntries}`);
  console.info(`Approval records created: ${result.approvalRecords}`);
  console.info(`Phase change requests created: ${result.phaseChangeRequests}`);
  console.info(`Pending open actions created: ${result.pendingOpenActions}`);
  console.info(`Forecast rows created: ${result.volumeForecastRows}`);
  console.info(`Actual rows created: ${result.volumeActualRows}`);
  console.info(`Auth users created/updated: ${result.authUsersCreatedOrUpdated}`);
  console.info("");
  console.info("Demo login credentials:");
  for (const user of UTOPIATRAX_DEMO_USERS) {
    console.info(`- ${user.email} / ${DEMO_PASSWORD} / ${user.name}`);
  }

  if (result.authSkipped) {
    console.info("");
    console.info(
      "Auth users were not fully created. Create or update the four Supabase Auth users above with the listed password and app_metadata userId/activeOrganizationId values printed in the Prisma database."
    );
  }

  if (result.warnings.length) {
    console.info("");
    console.info("Warnings:");
    for (const warning of result.warnings) {
      console.info(`- ${warning}`);
    }
  }
}

async function runCli() {
  const prisma = new PrismaClient();
  const reset = process.argv.includes("--reset");

  try {
    const result = await seedUtopiaTraxDemo(prisma, { reset });
    printSeedSummary(result);
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "UtopiaTrax demo seed failed."
    );
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

const isCliExecution =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCliExecution) {
  runCli();
}
