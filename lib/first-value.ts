import { prisma } from "@/lib/prisma";
import {
  createSavingCard,
  invalidatePortfolioSurfaceCaches,
} from "@/lib/data";
import { buildTenantScopeWhere, resolveTenantScope } from "@/lib/tenant-scope";
import type { TenantContextSource } from "@/lib/types";

export class FirstValueError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 401 | 403 | 404 | 409 = 400
  ) {
    super(message);
    this.name = "FirstValueError";
  }
}

type SampleSavingCardInput = {
  title: string;
  description: string;
  savingType: string;
  phase: "IDEA" | "VALIDATED";
  supplier: {
    name: string;
  };
  material: {
    name: string;
  };
  category: {
    name: string;
  };
  plant: {
    name: string;
  };
  businessUnit: {
    name: string;
  };
  buyer: {
    name: string;
  };
  baselinePrice: number;
  newPrice: number;
  annualVolume: number;
  currency: "EUR";
  fxRate: number;
  frequency: "RECURRING";
  savingDriver: string;
  implementationComplexity: string;
  qualificationStatus: string;
  startDate: Date;
  endDate: Date;
  impactStartDate: Date;
  impactEndDate: Date;
  stakeholderIds: string[];
  evidence: [];
};

const SAMPLE_SAVING_CARDS: readonly SampleSavingCardInput[] = [
  {
    title: "PET Resin Renegotiation Wave 1",
    description:
      "Renegotiate the PET resin baseline across the Western Europe beverage footprint to reduce unit cost while preserving quality, service level, and approved supply continuity.",
    savingType: "Commercial renegotiation",
    phase: "VALIDATED",
    supplier: {
      name: "Nordic Polymers",
    },
    material: {
      name: "PET Resin",
    },
    category: {
      name: "Packaging",
    },
    plant: {
      name: "Amsterdam Bottling",
    },
    businessUnit: {
      name: "Beverages Europe",
    },
    buyer: {
      name: "Strategic Packaging Buyer",
    },
    baselinePrice: 1.24,
    newPrice: 1.12,
    annualVolume: 240000,
    currency: "EUR",
    fxRate: 1,
    frequency: "RECURRING",
    savingDriver: "Negotiation",
    implementationComplexity: "Medium",
    qualificationStatus: "Approved",
    startDate: new Date("2026-04-01T00:00:00.000Z"),
    endDate: new Date("2026-12-31T00:00:00.000Z"),
    impactStartDate: new Date("2026-05-01T00:00:00.000Z"),
    impactEndDate: new Date("2026-12-31T00:00:00.000Z"),
    stakeholderIds: [],
    evidence: [],
  },
  {
    title: "Secondary Label Stock Harmonization",
    description:
      "Standardize secondary label stock specifications across nutrition lines to simplify sourcing, improve run-rate pricing, and remove avoidable variant complexity from the packaging base.",
    savingType: "Specification harmonization",
    phase: "IDEA",
    supplier: {
      name: "Delta Print Solutions",
    },
    material: {
      name: "Label Stock",
    },
    category: {
      name: "Direct Materials",
    },
    plant: {
      name: "Rotterdam Packaging Hub",
    },
    businessUnit: {
      name: "Nutrition Europe",
    },
    buyer: {
      name: "Regional Sourcing Lead",
    },
    baselinePrice: 0.41,
    newPrice: 0.36,
    annualVolume: 180000,
    currency: "EUR",
    fxRate: 1,
    frequency: "RECURRING",
    savingDriver: "Specification Optimization",
    implementationComplexity: "Low",
    qualificationStatus: "Plant Trial",
    startDate: new Date("2026-06-01T00:00:00.000Z"),
    endDate: new Date("2027-03-31T00:00:00.000Z"),
    impactStartDate: new Date("2026-08-01T00:00:00.000Z"),
    impactEndDate: new Date("2027-03-31T00:00:00.000Z"),
    stakeholderIds: [],
    evidence: [],
  },
] as const;

export async function loadFirstValueSampleData(
  actorId: string,
  context: TenantContextSource
) {
  const scope = resolveTenantScope(context);
  const existingSavingCardCount = await prisma.savingCard.count({
    where: buildTenantScopeWhere(scope),
  });

  if (existingSavingCardCount > 0) {
    throw new FirstValueError(
      "Sample data can only be loaded into a workspace with no saving cards yet.",
      409
    );
  }

  const createdSavingCards: Array<{
    id: string;
    title: string;
    phase: "IDEA" | "VALIDATED" | "REALISED" | "ACHIEVED" | "CANCELLED";
  }> = [];

  for (const payload of SAMPLE_SAVING_CARDS) {
    const card = await createSavingCard(payload, actorId, scope.organizationId, {
      skipViewInvalidation: true,
    });
    createdSavingCards.push({
      id: card.id,
      title: card.title,
      phase: card.phase,
    });
  }

  invalidatePortfolioSurfaceCaches(scope.organizationId);

  return {
    organizationId: scope.organizationId,
    createdCardsCount: createdSavingCards.length,
    createdSavingCards,
  };
}
