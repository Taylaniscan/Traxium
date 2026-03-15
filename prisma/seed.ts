import { ApprovalStatus, Currency, Frequency, Phase, PrismaClient, Role } from "@prisma/client";
import { calculateSavings } from "../lib/calculations";

const prisma = new PrismaClient();

const usersSeed = [
  {
    key: "sophie",
    name: "Sophie Laurent",
    email: "sophie@traxium.local",
    role: Role.HEAD_OF_GLOBAL_PROCUREMENT
  },
  {
    key: "marco",
    name: "Marco Stein",
    email: "marco@traxium.local",
    role: Role.FINANCIAL_CONTROLLER
  },
  {
    key: "luca",
    name: "Luca Voss",
    email: "luca@traxium.local",
    role: Role.TACTICAL_BUYER
  }
] as const;

const businessUnitsSeed = [
  { key: "coatings", name: "Coatings" },
  { key: "polymers", name: "Polymers" }
] as const;

const categoriesSeed = [
  { key: "raw-materials", name: "Raw Materials", annualTarget: 2400000 },
  { key: "logistics", name: "Logistics", annualTarget: 900000 },
  { key: "packaging", name: "Packaging", annualTarget: 650000 }
] as const;

const plantsSeed = [
  { key: "rotterdam", name: "Rotterdam Plant", region: "EMEA" },
  { key: "antwerp", name: "Antwerp Plant", region: "EMEA" }
] as const;

const suppliersSeed = [
  { key: "kronos", name: "Kronos Europe" },
  { key: "tronox", name: "Tronox Holdings" },
  { key: "orion", name: "Orion Engineered Carbons" },
  { key: "sabic", name: "SABIC Polymers" },
  { key: "dhl", name: "DHL Freight" }
] as const;

const materialsSeed = [
  { key: "tio2", name: "Titanium Dioxide Rutile" },
  { key: "carbon-black", name: "Carbon Black N330" },
  { key: "pp-carrier", name: "PP Carrier Resin" },
  { key: "freight-lane", name: "Freight Lane EMEA" },
  { key: "stretch-film", name: "Stretch Film 23um" }
] as const;

type UserKey = (typeof usersSeed)[number]["key"];
type BusinessUnitKey = (typeof businessUnitsSeed)[number]["key"];
type CategoryKey = (typeof categoriesSeed)[number]["key"];
type PlantKey = (typeof plantsSeed)[number]["key"];
type SupplierKey = (typeof suppliersSeed)[number]["key"];
type MaterialKey = (typeof materialsSeed)[number]["key"];
type IdLookup<TKey extends string> = Record<TKey, { id: string }>;
type AnnualTargetSeed = {
  year: number;
  targetValue: number;
  categoryKey?: CategoryKey;
};
type SavingCardSeed = {
  title: string;
  description: string;
  savingType: string;
  phase: Phase;
  supplierKey: SupplierKey;
  materialKey: MaterialKey;
  alternativeSupplierKey?: SupplierKey;
  alternativeMaterialManualName?: string;
  categoryKey: CategoryKey;
  plantKey: PlantKey;
  businessUnitKey: BusinessUnitKey;
  buyerKey: UserKey;
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
  stakeholderKeys: UserKey[];
  evidenceFileName: string;
  evidenceType: string;
  cancellationReason?: string;
};

const fxRatesSeed = [
  { currency: Currency.EUR, rateToEUR: 1, validFrom: date("2026-01-01") },
  { currency: Currency.USD, rateToEUR: 0.92, validFrom: date("2026-01-01") }
] as const;

const annualTargetsSeed: AnnualTargetSeed[] = [
  { year: 2026, targetValue: 3950000 },
  { year: 2026, targetValue: 2400000, categoryKey: "raw-materials" },
  { year: 2026, targetValue: 900000, categoryKey: "logistics" },
  { year: 2026, targetValue: 650000, categoryKey: "packaging" }
] as const;

const savingCardsSeed: SavingCardSeed[] = [
  {
    title: "Titanium dioxide renegotiation",
    description: "Reopen annual TiO2 pricing with Kronos for the Rotterdam decorative coatings portfolio.",
    savingType: "Price renegotiation",
    phase: Phase.IDEA,
    supplierKey: "kronos",
    materialKey: "tio2",
    categoryKey: "raw-materials",
    plantKey: "rotterdam",
    businessUnitKey: "coatings",
    buyerKey: "luca",
    baselinePrice: 2860,
    newPrice: 2715,
    annualVolume: 420,
    currency: Currency.EUR,
    fxRate: 1,
    frequency: Frequency.RECURRING,
    savingDriver: "Negotiation",
    implementationComplexity: "Medium",
    qualificationStatus: "Not Started",
    startDate: date("2026-01-10"),
    endDate: date("2026-09-30"),
    impactStartDate: date("2026-04-01"),
    impactEndDate: date("2026-12-31"),
    stakeholderKeys: ["sophie", "marco"],
    evidenceFileName: "titanium-dioxide-renegotiation.pdf",
    evidenceType: "commercial_quote"
  },
  {
    title: "Carbon black dual sourcing",
    description: "Qualify a second carbon black source to reduce dependency on a single supplier for black masterbatch.",
    savingType: "Dual sourcing",
    phase: Phase.IDEA,
    supplierKey: "orion",
    materialKey: "carbon-black",
    categoryKey: "raw-materials",
    plantKey: "antwerp",
    businessUnitKey: "polymers",
    buyerKey: "luca",
    baselinePrice: 1450,
    newPrice: 1360,
    annualVolume: 680,
    currency: Currency.EUR,
    fxRate: 1,
    frequency: Frequency.MULTI_YEAR,
    savingDriver: "Supplier Change",
    implementationComplexity: "High",
    qualificationStatus: "Lab Testing",
    startDate: date("2026-02-01"),
    endDate: date("2026-11-30"),
    impactStartDate: date("2026-07-01"),
    impactEndDate: date("2027-06-30"),
    stakeholderKeys: ["sophie"],
    evidenceFileName: "carbon-black-dual-sourcing.pdf",
    evidenceType: "qualification_plan"
  },
  {
    title: "PP carrier resin optimization",
    description: "Optimize PP carrier resin specification and price ladder for standard white masterbatch formulations.",
    savingType: "Specification optimization",
    phase: Phase.VALIDATED,
    supplierKey: "sabic",
    materialKey: "pp-carrier",
    categoryKey: "raw-materials",
    plantKey: "rotterdam",
    businessUnitKey: "polymers",
    buyerKey: "luca",
    baselinePrice: 1325,
    newPrice: 1240,
    annualVolume: 950,
    currency: Currency.EUR,
    fxRate: 1,
    frequency: Frequency.RECURRING,
    savingDriver: "Specification Optimization",
    implementationComplexity: "Medium",
    qualificationStatus: "Approved",
    startDate: date("2025-12-15"),
    endDate: date("2026-10-31"),
    impactStartDate: date("2026-03-01"),
    impactEndDate: date("2026-12-31"),
    stakeholderKeys: ["sophie", "marco"],
    evidenceFileName: "pp-carrier-resin-optimization.pdf",
    evidenceType: "sourcing_analysis"
  },
  {
    title: "Logistics optimization",
    description: "Consolidate inbound freight lanes into weekly milk runs between Antwerp and Rotterdam.",
    savingType: "Logistics optimization",
    phase: Phase.VALIDATED,
    supplierKey: "dhl",
    materialKey: "freight-lane",
    categoryKey: "logistics",
    plantKey: "antwerp",
    businessUnitKey: "coatings",
    buyerKey: "luca",
    baselinePrice: 1180,
    newPrice: 1035,
    annualVolume: 520,
    currency: Currency.EUR,
    fxRate: 1,
    frequency: Frequency.ONE_TIME,
    savingDriver: "Logistics Optimization",
    implementationComplexity: "Low",
    qualificationStatus: "Approved",
    startDate: date("2026-01-05"),
    endDate: date("2026-06-30"),
    impactStartDate: date("2026-03-15"),
    impactEndDate: date("2026-12-31"),
    stakeholderKeys: ["marco"],
    evidenceFileName: "logistics-optimization.pdf",
    evidenceType: "logistics_tender"
  },
  {
    title: "Payment terms improvement",
    description: "Extend payment terms on titanium dioxide contracts from net 45 to net 75 days.",
    savingType: "Payment terms improvement",
    phase: Phase.REALISED,
    supplierKey: "kronos",
    materialKey: "tio2",
    categoryKey: "raw-materials",
    plantKey: "rotterdam",
    businessUnitKey: "coatings",
    buyerKey: "luca",
    baselinePrice: 2780,
    newPrice: 2705,
    annualVolume: 380,
    currency: Currency.EUR,
    fxRate: 1,
    frequency: Frequency.RECURRING,
    savingDriver: "Payment Term Improvement",
    implementationComplexity: "Low",
    qualificationStatus: "Approved",
    startDate: date("2025-11-01"),
    endDate: date("2026-12-31"),
    impactStartDate: date("2026-01-01"),
    impactEndDate: date("2026-12-31"),
    stakeholderKeys: ["sophie", "marco"],
    evidenceFileName: "payment-terms-improvement.pdf",
    evidenceType: "signed_amendment"
  },
  {
    title: "Demand reduction",
    description: "Reduce stretch film consumption per pallet through revised wrapping patterns and operator standards.",
    savingType: "Demand reduction",
    phase: Phase.REALISED,
    supplierKey: "sabic",
    materialKey: "stretch-film",
    categoryKey: "packaging",
    plantKey: "antwerp",
    businessUnitKey: "coatings",
    buyerKey: "luca",
    baselinePrice: 2.84,
    newPrice: 2.43,
    annualVolume: 190000,
    currency: Currency.EUR,
    fxRate: 1,
    frequency: Frequency.RECURRING,
    savingDriver: "Demand Reduction",
    implementationComplexity: "Medium",
    qualificationStatus: "Approved",
    startDate: date("2025-10-01"),
    endDate: date("2026-09-30"),
    impactStartDate: date("2026-01-15"),
    impactEndDate: date("2026-12-31"),
    stakeholderKeys: ["marco"],
    evidenceFileName: "demand-reduction.pdf",
    evidenceType: "plant_trial"
  },
  {
    title: "Material substitution",
    description: "Substitute the standard carbon black grade with a lower-cost equivalent approved for non-critical shades.",
    savingType: "Material substitution",
    phase: Phase.REALISED,
    supplierKey: "orion",
    materialKey: "carbon-black",
    alternativeMaterialManualName: "Carbon Black N326",
    categoryKey: "raw-materials",
    plantKey: "rotterdam",
    businessUnitKey: "polymers",
    buyerKey: "luca",
    baselinePrice: 1485,
    newPrice: 1375,
    annualVolume: 340,
    currency: Currency.EUR,
    fxRate: 1,
    frequency: Frequency.MULTI_YEAR,
    savingDriver: "Material Substitution",
    implementationComplexity: "High",
    qualificationStatus: "Plant Trial",
    startDate: date("2025-09-01"),
    endDate: date("2027-03-31"),
    impactStartDate: date("2026-02-01"),
    impactEndDate: date("2027-03-31"),
    stakeholderKeys: ["sophie", "marco"],
    evidenceFileName: "material-substitution.pdf",
    evidenceType: "technical_evaluation"
  },
  {
    title: "Supplier switch",
    description: "Shift titanium dioxide demand from Kronos to Tronox on approved architectural white grades.",
    savingType: "Supplier switch",
    phase: Phase.ACHIEVED,
    supplierKey: "kronos",
    materialKey: "tio2",
    alternativeSupplierKey: "tronox",
    categoryKey: "raw-materials",
    plantKey: "antwerp",
    businessUnitKey: "coatings",
    buyerKey: "luca",
    baselinePrice: 2925,
    newPrice: 2635,
    annualVolume: 240,
    currency: Currency.USD,
    fxRate: 0.92,
    frequency: Frequency.MULTI_YEAR,
    savingDriver: "Supplier Change",
    implementationComplexity: "Strategic",
    qualificationStatus: "Approved",
    startDate: date("2025-06-01"),
    endDate: date("2026-12-31"),
    impactStartDate: date("2025-11-01"),
    impactEndDate: date("2026-12-31"),
    stakeholderKeys: ["sophie", "marco"],
    evidenceFileName: "supplier-switch.pdf",
    evidenceType: "award_decision"
  },
  {
    title: "Index decrease pass-through",
    description: "Pass through lower propylene index levels into the PP carrier resin formula pricing.",
    savingType: "Index decrease pass-through",
    phase: Phase.ACHIEVED,
    supplierKey: "sabic",
    materialKey: "pp-carrier",
    categoryKey: "raw-materials",
    plantKey: "rotterdam",
    businessUnitKey: "polymers",
    buyerKey: "luca",
    baselinePrice: 1385,
    newPrice: 1270,
    annualVolume: 880,
    currency: Currency.USD,
    fxRate: 0.92,
    frequency: Frequency.RECURRING,
    savingDriver: "Index Reduction",
    implementationComplexity: "Medium",
    qualificationStatus: "Approved",
    startDate: date("2025-07-01"),
    endDate: date("2026-12-31"),
    impactStartDate: date("2026-01-01"),
    impactEndDate: date("2026-12-31"),
    stakeholderKeys: ["marco"],
    evidenceFileName: "index-decrease-pass-through.pdf",
    evidenceType: "index_formula"
  },
  {
    title: "Packaging specification optimization",
    description: "Downgauge pallet stretch film after warehouse trials without compromising load stability.",
    savingType: "Packaging specification optimization",
    phase: Phase.CANCELLED,
    supplierKey: "sabic",
    materialKey: "stretch-film",
    alternativeMaterialManualName: "Stretch Film 20um",
    categoryKey: "packaging",
    plantKey: "antwerp",
    businessUnitKey: "coatings",
    buyerKey: "luca",
    baselinePrice: 2.82,
    newPrice: 2.36,
    annualVolume: 150000,
    currency: Currency.EUR,
    fxRate: 1,
    frequency: Frequency.RECURRING,
    savingDriver: "Specification Optimization",
    implementationComplexity: "Medium",
    qualificationStatus: "Rejected",
    startDate: date("2026-01-01"),
    endDate: date("2026-08-31"),
    impactStartDate: date("2026-05-01"),
    impactEndDate: date("2026-12-31"),
    stakeholderKeys: ["sophie"],
    evidenceFileName: "packaging-specification-optimization.pdf",
    evidenceType: "trial_report",
    cancellationReason: "Warehouse trial showed unacceptable pallet instability during export shipments."
  }
];

async function main() {
  await clearExistingData();

  const users = await upsertUsers();
  const businessUnits = await upsertBusinessUnits();
  const categories = await upsertCategories();
  const plants = await upsertPlants();
  const suppliers = await upsertSuppliers();
  const materials = await upsertMaterials();

  await prisma.fxRate.createMany({ data: fxRatesSeed.map((rate) => ({ ...rate })) });
  await prisma.annualTarget.createMany({
    data: annualTargetsSeed.map((target) => ({
      year: target.year,
      targetValue: target.targetValue,
      categoryId: target.categoryKey ? categories[target.categoryKey].id : null
    }))
  });

  const createdCards: Record<string, { id: string }> = {};

  for (const card of savingCardsSeed) {
    const savings = calculateSavings({
      baselinePrice: card.baselinePrice,
      newPrice: card.newPrice,
      annualVolume: card.annualVolume,
      currency: card.currency,
      fxRate: card.fxRate
    });

    const created = await prisma.savingCard.create({
      data: {
        title: card.title,
        description: card.description,
        savingType: card.savingType,
        phase: card.phase,
        supplierId: suppliers[card.supplierKey].id,
        materialId: materials[card.materialKey].id,
        alternativeSupplierId: card.alternativeSupplierKey ? suppliers[card.alternativeSupplierKey].id : null,
        alternativeSupplierManualName: null,
        alternativeMaterialId: null,
        alternativeMaterialManualName: card.alternativeMaterialManualName ?? null,
        categoryId: categories[card.categoryKey].id,
        plantId: plants[card.plantKey].id,
        businessUnitId: businessUnits[card.businessUnitKey].id,
        buyerId: users[card.buyerKey].id,
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
        financeLocked: isFinanceLocked(card.phase),
        cancellationReason: card.cancellationReason ?? null,
        stakeholders: {
          create: card.stakeholderKeys.map((stakeholderKey) => ({
            userId: users[stakeholderKey].id
          }))
        },
        evidence: {
          create: {
            fileName: card.evidenceFileName,
            fileUrl: `/demo/${card.evidenceFileName}`,
            fileSize: 245760,
            fileType: card.evidenceType,
            uploadedById: users.luca.id
          }
        },
        comments: {
          create: {
            authorId: users.luca.id,
            body: `Seeded demo case for ${card.title.toLowerCase()}.`
          }
        },
        phaseHistory: {
          create: buildPhaseHistory(card.phase, users)
        },
        auditLogs: {
          create: {
            userId: users.luca.id,
            action: "saving_card.seeded",
            detail: `Seeded demo saving card in ${card.phase} phase`
          }
        }
      }
    });

    createdCards[card.title] = { id: created.id };

    const approvals = buildApprovals(created.id, card.phase, users);
    if (approvals.length) {
      await prisma.approval.createMany({ data: approvals });
    }
  }

  await createPendingWorkflow(createdCards, users);

  console.log("Seed completed with 10 saving cards.");
}

async function clearExistingData() {
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.phaseChangeRequestApproval.deleteMany();
  await prisma.phaseChangeRequest.deleteMany();
  await prisma.approval.deleteMany();
  await prisma.phaseHistory.deleteMany();
  await prisma.savingCardComment.deleteMany();
  await prisma.savingCardEvidence.deleteMany();
  await prisma.savingCardAlternativeMaterial.deleteMany();
  await prisma.savingCardAlternativeSupplier.deleteMany();
  await prisma.savingCardStakeholder.deleteMany();
  await prisma.savingCard.deleteMany();
  await prisma.annualTarget.deleteMany();
  await prisma.fxRate.deleteMany();
  await prisma.businessUnit.deleteMany();
  await prisma.plant.deleteMany();
  await prisma.category.deleteMany();
  await prisma.material.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.user.deleteMany();
}

async function upsertUsers(): Promise<IdLookup<UserKey>> {
  const records = await Promise.all(
    usersSeed.map((user) =>
      prisma.user.upsert({
        where: { email: user.email },
        update: { name: user.name, role: user.role },
        create: { name: user.name, email: user.email, role: user.role }
      })
    )
  );

  return buildIdLookup(usersSeed, records, (seedItem, record) => seedItem.email === record.email);
}

async function upsertBusinessUnits(): Promise<IdLookup<BusinessUnitKey>> {
  const records = await Promise.all(
    businessUnitsSeed.map((businessUnit) =>
      prisma.businessUnit.upsert({
        where: { name: businessUnit.name },
        update: {},
        create: { name: businessUnit.name }
      })
    )
  );

  return buildIdLookup(businessUnitsSeed, records, (seedItem, record) => seedItem.name === record.name);
}

async function upsertCategories(): Promise<IdLookup<CategoryKey>> {
  const records = await Promise.all(
    categoriesSeed.map((category) =>
      prisma.category.upsert({
        where: { name: category.name },
        update: { annualTarget: category.annualTarget },
        create: { name: category.name, annualTarget: category.annualTarget }
      })
    )
  );

  return buildIdLookup(categoriesSeed, records, (seedItem, record) => seedItem.name === record.name);
}

async function upsertPlants(): Promise<IdLookup<PlantKey>> {
  const records = await Promise.all(
    plantsSeed.map((plant) =>
      prisma.plant.upsert({
        where: { name: plant.name },
        update: { region: plant.region },
        create: { name: plant.name, region: plant.region }
      })
    )
  );

  return buildIdLookup(plantsSeed, records, (seedItem, record) => seedItem.name === record.name);
}

async function upsertSuppliers(): Promise<IdLookup<SupplierKey>> {
  const records = await Promise.all(
    suppliersSeed.map((supplier) =>
      prisma.supplier.upsert({
        where: { name: supplier.name },
        update: {},
        create: { name: supplier.name }
      })
    )
  );

  return buildIdLookup(suppliersSeed, records, (seedItem, record) => seedItem.name === record.name);
}

async function upsertMaterials(): Promise<IdLookup<MaterialKey>> {
  const records = await Promise.all(
    materialsSeed.map((material) =>
      prisma.material.upsert({
        where: { name: material.name },
        update: {},
        create: { name: material.name }
      })
    )
  );

  return buildIdLookup(materialsSeed, records, (seedItem, record) => seedItem.name === record.name);
}

function buildPhaseHistory(phase: Phase, users: IdLookup<UserKey>) {
  const orderedPhases = historyPhasesFor(phase);

  return orderedPhases.map((currentPhase, index) => ({
    fromPhase: index === 0 ? null : orderedPhases[index - 1],
    toPhase: currentPhase,
    changedById: currentPhase === Phase.IDEA ? users.luca.id : currentPhase === Phase.CANCELLED ? users.sophie.id : users.marco.id
  }));
}

function historyPhasesFor(phase: Phase) {
  switch (phase) {
    case Phase.IDEA:
      return [Phase.IDEA];
    case Phase.VALIDATED:
      return [Phase.IDEA, Phase.VALIDATED];
    case Phase.REALISED:
      return [Phase.IDEA, Phase.VALIDATED, Phase.REALISED];
    case Phase.ACHIEVED:
      return [Phase.IDEA, Phase.VALIDATED, Phase.REALISED, Phase.ACHIEVED];
    case Phase.CANCELLED:
      return [Phase.IDEA, Phase.CANCELLED];
  }
}

function buildApprovals(savingCardId: string, phase: Phase, users: IdLookup<UserKey>) {
  const approvals: Array<{
    savingCardId: string;
    approverId: string;
    phase: Phase;
    approved: boolean;
    status: ApprovalStatus;
    comment: string;
  }> = [];

  if (phase !== Phase.IDEA && phase !== Phase.CANCELLED) {
    approvals.push({
      savingCardId,
      approverId: users.sophie.id,
      phase: Phase.IDEA,
      approved: true,
      status: ApprovalStatus.APPROVED,
      comment: "Idea phase approved during portfolio review."
    });
  }

  if (phase === Phase.VALIDATED || phase === Phase.REALISED || phase === Phase.ACHIEVED) {
    approvals.push(
      {
        savingCardId,
        approverId: users.sophie.id,
        phase: Phase.VALIDATED,
        approved: true,
        status: ApprovalStatus.APPROVED,
        comment: "Commercial case validated."
      },
      {
        savingCardId,
        approverId: users.marco.id,
        phase: Phase.VALIDATED,
        approved: true,
        status: ApprovalStatus.APPROVED,
        comment: "Finance assumptions validated."
      }
    );
  }

  if (phase === Phase.REALISED || phase === Phase.ACHIEVED) {
    approvals.push({
      savingCardId,
      approverId: users.marco.id,
      phase: Phase.REALISED,
      approved: true,
      status: ApprovalStatus.APPROVED,
      comment: "Savings realised in the monthly result."
    });
  }

  if (phase === Phase.ACHIEVED) {
    approvals.push({
      savingCardId,
      approverId: users.marco.id,
      phase: Phase.ACHIEVED,
      approved: true,
      status: ApprovalStatus.APPROVED,
      comment: "Savings fully achieved and closed."
    });
  }

  return approvals;
}

async function createPendingWorkflow(createdCards: Record<string, { id: string }>, users: IdLookup<UserKey>) {
  const titaniumRequest = await prisma.phaseChangeRequest.create({
    data: {
      savingCardId: createdCards["Titanium dioxide renegotiation"].id,
      currentPhase: Phase.IDEA,
      requestedPhase: Phase.VALIDATED,
      requestedById: users.luca.id,
      approvalStatus: ApprovalStatus.PENDING,
      comment: "Supplier meeting completed. Ready for leadership and finance validation.",
      approvals: {
        create: [
          {
            approverId: users.sophie.id,
            role: Role.HEAD_OF_GLOBAL_PROCUREMENT,
            status: ApprovalStatus.PENDING
          },
          {
            approverId: users.marco.id,
            role: Role.FINANCIAL_CONTROLLER,
            status: ApprovalStatus.PENDING
          }
        ]
      }
    }
  });

  const logisticsRequest = await prisma.phaseChangeRequest.create({
    data: {
      savingCardId: createdCards["Logistics optimization"].id,
      currentPhase: Phase.VALIDATED,
      requestedPhase: Phase.REALISED,
      requestedById: users.luca.id,
      approvalStatus: ApprovalStatus.PENDING,
      comment: "Lane consolidation is live and first invoices are booked.",
      approvals: {
        create: [
          {
            approverId: users.marco.id,
            role: Role.FINANCIAL_CONTROLLER,
            status: ApprovalStatus.PENDING
          }
        ]
      }
    }
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: users.sophie.id,
        title: "Approval required",
        message: `Titanium dioxide renegotiation is waiting for your validated-phase approval (${titaniumRequest.id}).`
      },
      {
        userId: users.marco.id,
        title: "Approval required",
        message: `Titanium dioxide renegotiation is waiting for your validated-phase approval (${titaniumRequest.id}).`
      },
      {
        userId: users.marco.id,
        title: "Approval required",
        message: `Logistics optimization is waiting for your realised-phase approval (${logisticsRequest.id}).`
      }
    ]
  });
}

function isFinanceLocked(phase: Phase) {
  return phase === Phase.VALIDATED || phase === Phase.REALISED || phase === Phase.ACHIEVED;
}

function buildIdLookup<
  TSeed extends readonly { key: string }[],
  TRecord extends { id: string }
>(seed: TSeed, records: TRecord[], matches: (seedItem: TSeed[number], record: TRecord) => boolean) {
  const lookup = {} as Record<TSeed[number]["key"], { id: string }>;

  for (const seedItem of seed) {
    const record = records.find((item) => matches(seedItem, item));
    if (!record) {
      throw new Error(`Unable to build lookup for ${String(seedItem.key)}.`);
    }
    lookup[seedItem.key as TSeed[number]["key"]] = { id: record.id };
  }

  return lookup;
}

function date(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
