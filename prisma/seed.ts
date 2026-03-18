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
} as const;

const supplierSeeds = {
  basf: { name: "BASF" },
  cabot: { name: "Cabot" },
  clariant: { name: "Clariant" },
} as const;

const materialSeeds = {
  tio2: { name: "Titanium Dioxide" },
  carbonBlack: { name: "Carbon Black" },
  peCarrier: { name: "PE Carrier" },
} as const;

const categorySeeds = {
  rawMaterials: { name: "Raw Materials" },
  packaging: { name: "Packaging" },
} as const;

const plantSeeds = {
  almere: { name: "Almere Plant", region: "NL" },
  antwerp: { name: "Antwerp Plant", region: "BE" },
} as const;

const businessUnitSeeds = {
  coatings: { name: "Coatings" },
  masterbatch: { name: "Masterbatch" },
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
  const entries = await Promise.all(
    (Object.entries(userSeeds) as [UserKey, (typeof userSeeds)[UserKey]][]).map(async ([key, user]) => {
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

      return [key, { id: created.id, name: created.name }] as const;
    })
  );

  return Object.fromEntries(entries) as IdLookup<UserKey>;
}

async function upsertBuyers(organizationId: string): Promise<IdLookup<BuyerKey>> {
  const entries = await Promise.all(
    (Object.entries(buyerSeeds) as [BuyerKey, (typeof buyerSeeds)[BuyerKey]][]).map(async ([key, buyer]) => {
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

      return [key, { id: created.id, name: created.name }] as const;
    })
  );

  return Object.fromEntries(entries) as IdLookup<BuyerKey>;
}

async function upsertSuppliers(organizationId: string): Promise<IdLookup<SupplierKey>> {
  const entries = await Promise.all(
    (Object.entries(supplierSeeds) as [SupplierKey, (typeof supplierSeeds)[SupplierKey]][]).map(async ([key, supplier]) => {
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

      return [key, { id: created.id, name: created.name }] as const;
    })
  );

  return Object.fromEntries(entries) as IdLookup<SupplierKey>;
}

async function upsertMaterials(organizationId: string): Promise<IdLookup<MaterialKey>> {
  const entries = await Promise.all(
    (Object.entries(materialSeeds) as [MaterialKey, (typeof materialSeeds)[MaterialKey]][]).map(async ([key, material]) => {
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

      return [key, { id: created.id, name: created.name }] as const;
    })
  );

  return Object.fromEntries(entries) as IdLookup<MaterialKey>;
}

async function upsertCategories(organizationId: string): Promise<IdLookup<CategoryKey>> {
  const entries = await Promise.all(
    (Object.entries(categorySeeds) as [CategoryKey, (typeof categorySeeds)[CategoryKey]][]).map(async ([key, category]) => {
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

      return [key, { id: created.id, name: created.name }] as const;
    })
  );

  return Object.fromEntries(entries) as IdLookup<CategoryKey>;
}

async function upsertPlants(organizationId: string): Promise<IdLookup<PlantKey>> {
  const entries = await Promise.all(
    (Object.entries(plantSeeds) as [PlantKey, (typeof plantSeeds)[PlantKey]][]).map(async ([key, plant]) => {
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

      return [key, { id: created.id, name: created.name }] as const;
    })
  );

  return Object.fromEntries(entries) as IdLookup<PlantKey>;
}

async function upsertBusinessUnits(organizationId: string): Promise<IdLookup<BusinessUnitKey>> {
  const entries = await Promise.all(
    (Object.entries(businessUnitSeeds) as [BusinessUnitKey, (typeof businessUnitSeeds)[BusinessUnitKey]][]).map(async ([key, unit]) => {
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

      return [key, { id: created.id, name: created.name }] as const;
    })
  );

  return Object.fromEntries(entries) as IdLookup<BusinessUnitKey>;
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
