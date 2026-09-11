import { pathToFileURL } from "node:url";

import {
  ApprovalStatus,
  PrismaClient,
} from "@prisma/client";

import {
  getUtopiaTraxDatasetSummary,
  validateUtopiaTraxDemoDataset,
} from "./seed-utopiatrax-demo";
import {
  UTOPIATRAX_DEMO_SLUG,
  UTOPIATRAX_EXPECTED_USERS,
  UTOPIATRAX_SHOWCASE_CARD_TITLE,
  type UtopiaTraxPersistedSnapshot,
  validateUtopiaTraxPersistedSnapshot,
} from "./utopiatrax-demo-contract";

export type UtopiaTraxDemoReadClient = {
  organization: {
    findUnique(args: object): Promise<unknown>;
    count(args: object): Promise<number>;
  };
};

type PersistedOrganizationRecord = {
  id: string;
  name: string;
  slug: string;
  workspaceTrialEndsAt: Date | null;
  users: Array<{
    id: string;
    name: string;
    email: string;
    role: UtopiaTraxPersistedSnapshot["users"][number]["role"];
    memberships: Array<{
      organizationId: string;
      role: NonNullable<
        UtopiaTraxPersistedSnapshot["users"][number]["membershipRole"]
      >;
      status: NonNullable<
        UtopiaTraxPersistedSnapshot["users"][number]["membershipStatus"]
      >;
    }>;
  }>;
  categories: Array<{ id: string; name: string }>;
  savingCards: Array<{
    id: string;
    title: string;
    phase: UtopiaTraxPersistedSnapshot["cards"][number]["phase"];
    currency: UtopiaTraxPersistedSnapshot["cards"][number]["currency"];
    impactType: UtopiaTraxPersistedSnapshot["cards"][number]["impactType"];
    referencePrice: number | null;
    calculatedSavings: number;
    annualizedRunRate: number;
    inYearValue: number;
    financeLocked: boolean;
    cancellationReason: string | null;
    category: { name: string };
    evidence: Array<{
      id: string;
      storageBucket: string;
      storagePath: string;
    }>;
    alternativeSuppliers: Array<{ id: string }>;
    alternativeMaterials: Array<{ id: string }>;
    phaseHistory: Array<{ id: string }>;
    approvals: Array<{ id: string }>;
    phaseChangeRequests: Array<{
      id: string;
      approvalStatus: ApprovalStatus;
      approvals: Array<{
        id: string;
        status: ApprovalStatus;
      }>;
    }>;
    forecasts: Array<{ id: string }>;
    actuals: Array<{ id: string }>;
  }>;
  billingCustomer: { id: string } | null;
  subscriptions: Array<{
    status: UtopiaTraxPersistedSnapshot["billing"]["subscriptionStatus"];
    trialEnd: Date | null;
    currentPeriodEnd: Date | null;
  }>;
  auditLogs: Array<{ id: string }>;
};

const UTOPIATRAX_DEMO_HEALTH_SELECT = {
  id: true,
  name: true,
  slug: true,
  workspaceTrialEndsAt: true,
  users: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      memberships: {
        select: {
          organizationId: true,
          role: true,
          status: true,
        },
      },
    },
    orderBy: {
      email: "asc",
    },
  },
  categories: {
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  },
  savingCards: {
    select: {
      id: true,
      title: true,
      phase: true,
      currency: true,
      impactType: true,
      referencePrice: true,
      calculatedSavings: true,
      annualizedRunRate: true,
      inYearValue: true,
      financeLocked: true,
      cancellationReason: true,
      category: {
        select: {
          name: true,
        },
      },
      evidence: {
        select: {
          id: true,
          storageBucket: true,
          storagePath: true,
        },
      },
      alternativeSuppliers: {
        select: {
          id: true,
        },
      },
      alternativeMaterials: {
        select: {
          id: true,
        },
      },
      phaseHistory: {
        select: {
          id: true,
        },
      },
      approvals: {
        select: {
          id: true,
        },
      },
      phaseChangeRequests: {
        select: {
          id: true,
          approvalStatus: true,
          approvals: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      },
      forecasts: {
        select: {
          id: true,
        },
      },
      actuals: {
        select: {
          id: true,
        },
      },
    },
    orderBy: {
      title: "asc",
    },
  },
  billingCustomer: {
    select: {
      id: true,
    },
  },
  subscriptions: {
    select: {
      status: true,
      trialEnd: true,
      currentPeriodEnd: true,
    },
    orderBy: [{ createdAt: "desc" }, { updatedAt: "desc" }],
  },
  auditLogs: {
    select: {
      id: true,
    },
  },
} as const;

function mapPersistedOrganization(
  organization: PersistedOrganizationRecord | null,
  unrelatedWorkspaceCount: number
): UtopiaTraxPersistedSnapshot {
  if (!organization) {
    return {
      workspace: null,
      users: [],
      categories: [],
      cards: [],
      billing: {
        customerPresent: false,
        subscriptionStatus: null,
        trialEnd: null,
        currentPeriodEnd: null,
      },
      adminActivityCount: 0,
      unrelatedWorkspaceCount,
    };
  }

  const subscription = organization.subscriptions[0] ?? null;

  return {
    workspace: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      workspaceTrialEndsAt: organization.workspaceTrialEndsAt,
    },
    users: organization.users.map((user) => {
      const membership = user.memberships.find(
        (item) => item.organizationId === organization.id
      );

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        membershipRole: membership?.role ?? null,
        membershipStatus: membership?.status ?? null,
      };
    }),
    categories: organization.categories,
    cards: organization.savingCards.map((card) => ({
      id: card.id,
      title: card.title,
      phase: card.phase,
      currency: card.currency,
      impactType: card.impactType,
      referencePrice:
        card.referencePrice === null ? null : Number(card.referencePrice),
      calculatedSavings: Number(card.calculatedSavings),
      annualizedRunRate: Number(card.annualizedRunRate),
      inYearValue: Number(card.inYearValue),
      financeLocked: card.financeLocked,
      cancellationReason: card.cancellationReason,
      categoryName: card.category.name,
      evidence: card.evidence,
      alternativeSupplierCount: card.alternativeSuppliers.length,
      alternativeMaterialCount: card.alternativeMaterials.length,
      phaseHistoryCount: card.phaseHistory.length,
      approvalCount: card.approvals.length,
      pendingPhaseRequestCount: card.phaseChangeRequests.filter(
        (request) => request.approvalStatus === ApprovalStatus.PENDING
      ).length,
      pendingApprovalCount: card.phaseChangeRequests.reduce(
        (sum, request) =>
          sum +
          request.approvals.filter(
            (approval) => approval.status === ApprovalStatus.PENDING
          ).length,
        0
      ),
      forecastCount: card.forecasts.length,
      actualCount: card.actuals.length,
    })),
    billing: {
      customerPresent: Boolean(organization.billingCustomer),
      subscriptionStatus: subscription?.status ?? null,
      trialEnd: subscription?.trialEnd ?? null,
      currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
    },
    adminActivityCount: organization.auditLogs.length,
    unrelatedWorkspaceCount,
  };
}

export async function collectUtopiaTraxDemoSnapshot(
  client: UtopiaTraxDemoReadClient
) {
  const [organization, unrelatedWorkspaceCount] = await Promise.all([
    client.organization.findUnique({
      where: {
        slug: UTOPIATRAX_DEMO_SLUG,
      },
      select: UTOPIATRAX_DEMO_HEALTH_SELECT,
    }),
    client.organization.count({
      where: {
        slug: {
          not: UTOPIATRAX_DEMO_SLUG,
        },
      },
    }),
  ]);

  return mapPersistedOrganization(
    organization as PersistedOrganizationRecord | null,
    unrelatedWorkspaceCount
  );
}

export async function validateUtopiaTraxDemoHealth(
  client: UtopiaTraxDemoReadClient
) {
  const snapshot = await collectUtopiaTraxDemoSnapshot(client);
  const checks = validateUtopiaTraxPersistedSnapshot(snapshot);

  return {
    snapshot,
    checks,
    passed: checks.every((check) => check.status !== "FAIL"),
  };
}

function printHealthResult(
  result: Awaited<ReturnType<typeof validateUtopiaTraxDemoHealth>>
) {
  const staticErrors = validateUtopiaTraxDemoDataset();
  const staticSummary = getUtopiaTraxDatasetSummary();
  const staticPassed = staticErrors.length === 0;
  const persistedPassed = result.passed;
  const showcase = result.snapshot.cards.find(
    (card) => card.title === UTOPIATRAX_SHOWCASE_CARD_TITLE
  );

  console.info("UtopiaTrax demo health");
  console.info("======================");
  console.info(
    `${staticPassed ? "PASS" : "FAIL"} Static dataset contract: ${staticSummary.savingCardCount} cards, ${staticSummary.directCategoryCount} categories, ${staticSummary.evidenceCount} evidence definitions`
  );
  for (const error of staticErrors) {
    console.info(`  - ${error}`);
  }

  for (const check of result.checks) {
    console.info(`${check.status} ${check.label}: ${check.detail}`);
  }

  console.info("");
  console.info(
    `Recommended showcase card: ${showcase?.title ?? UTOPIATRAX_SHOWCASE_CARD_TITLE}${showcase ? ` (${showcase.id})` : ""}`
  );
  console.info("Recommended demo logins:");
  for (const user of UTOPIATRAX_EXPECTED_USERS) {
    console.info(`- ${user.email}: ${user.recommendedUse}`);
  }

  console.info("");
  console.info("Provider-dependent warnings:");
  console.info(
    "- Storage metadata and managed paths are checked here; run npm run supabase:validate and manually download showcase evidence before clicking it in a buyer meeting."
  );
  console.info(
    "- Trialing billing access is checked here; Stripe Checkout, Portal, and webhook delivery require npm run stripe:validate and separate provider proof."
  );
  console.info(
    "- Prisma users and memberships are checked here; Supabase Auth login for all four users requires an authenticated browser check."
  );

  console.info("");
  console.info(
    `${staticPassed && persistedPassed ? "PASS" : "FAIL"} Overall UtopiaTrax demo health`
  );

  return staticPassed && persistedPassed;
}

async function runCli() {
  const prisma = new PrismaClient();

  try {
    const result = await validateUtopiaTraxDemoHealth(prisma);
    const passed = printHealthResult(result);
    if (!passed) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("FAIL UtopiaTrax demo health could not be checked.");
    console.error(
      error instanceof Error
        ? error.message
        : "Database connection or schema validation failed."
    );
    console.error(
      "Check DATABASE_URL, apply pending Prisma migrations, then run npm run demo:utopiatrax:validate again."
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
  void runCli();
}
