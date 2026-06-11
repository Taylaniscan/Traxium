import {
  ApprovalStatus,
  MembershipStatus,
  OrganizationRole,
  Phase,
  Role,
  SavingsImpactType,
  SubscriptionStatus,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  validateUtopiaTraxDemoHealth,
  type UtopiaTraxDemoReadClient,
} from "@/scripts/validate-utopiatrax-demo";
import {
  UTOPIATRAX_EXPECTED_CATEGORIES,
  UTOPIATRAX_EXPECTED_USERS,
  UTOPIATRAX_SHOWCASE_CARD_TITLE,
} from "@/scripts/utopiatrax-demo-contract";

function createCompleteOrganization() {
  const organizationId = "org-utopiatrax";
  const phases = [
    Phase.IDEA,
    Phase.VALIDATED,
    Phase.REALISED,
    Phase.ACHIEVED,
    Phase.CANCELLED,
  ];
  const savingCards = Array.from({ length: 25 }, (_, index) => {
    const isShowcase = index === 0;
    const phase = isShowcase ? Phase.ACHIEVED : phases[index % phases.length];
    const pendingRequest = index < 5;
    const pendingApprovals = index < 2 ? 2 : pendingRequest ? 1 : 0;
    const evidenceCount = isShowcase ? 2 : index < 11 ? 1 : 0;

    return {
      id: `card-${index + 1}`,
      title: isShowcase
        ? UTOPIATRAX_SHOWCASE_CARD_TITLE
        : `Manufacturing saving card ${index + 1}`,
      phase,
      impactType:
        index === 3 || index === 4
          ? SavingsImpactType.COST_AVOIDANCE
          : SavingsImpactType.HARD_SAVINGS,
      referencePrice: index === 3 || index === 4 ? 99 : null,
      calculatedSavings: 25000 + index * 1000,
      annualizedRunRate: 25000 + index * 1000,
      inYearValue: 25000 + index * 1000,
      financeLocked: index === 1,
      cancellationReason:
        phase === Phase.CANCELLED ? "Qualification did not meet tolerance." : null,
      category: {
        name:
          UTOPIATRAX_EXPECTED_CATEGORIES[
            index % UTOPIATRAX_EXPECTED_CATEGORIES.length
          ],
      },
      evidence: Array.from({ length: evidenceCount }, (_, evidenceIndex) => ({
        id: `evidence-${index}-${evidenceIndex}`,
        storageBucket: "evidence-private",
        storagePath: `organizations/${organizationId}/saving-cards/card-${index + 1}/evidence/document-${evidenceIndex}.txt`,
      })),
      alternativeSuppliers: index < 8 ? [{ id: `alt-supplier-${index}` }] : [],
      alternativeMaterials: isShowcase ? [{ id: "alt-material-showcase" }] : [],
      phaseHistory: [{ id: `history-${index}-1` }, { id: `history-${index}-2` }],
      approvals: [{ id: `approval-${index}` }],
      phaseChangeRequests: pendingRequest
        ? [
            {
              id: `request-${index}`,
              approvalStatus: ApprovalStatus.PENDING,
              approvals: Array.from({ length: pendingApprovals }, (_, approvalIndex) => ({
                id: `pending-${index}-${approvalIndex}`,
                status: ApprovalStatus.PENDING,
              })),
            },
          ]
        : [],
      forecasts: index < 10 ? [{ id: `forecast-${index}` }] : [],
      actuals: index < 10 ? [{ id: `actual-${index}` }] : [],
    };
  });

  savingCards[1].phase = Phase.VALIDATED;

  return {
    id: organizationId,
    name: "UtopiaTrax",
    slug: "utopiatrax",
    workspaceTrialEndsAt: new Date("2028-12-31T23:59:59.000Z"),
    users: UTOPIATRAX_EXPECTED_USERS.map((user, index) => ({
      id: `user-${index + 1}`,
      name: `Demo User ${index + 1}`,
      email: user.email,
      role: user.role,
      memberships: [
        {
          organizationId,
          role: user.membershipRole,
          status: MembershipStatus.ACTIVE,
        },
      ],
    })),
    categories: UTOPIATRAX_EXPECTED_CATEGORIES.map((name, index) => ({
      id: `category-${index + 1}`,
      name,
    })),
    savingCards,
    billingCustomer: {
      id: "billing-customer",
    },
    subscriptions: [
      {
        status: SubscriptionStatus.TRIALING,
        trialEnd: new Date("2028-12-31T23:59:59.000Z"),
        currentPeriodEnd: new Date("2028-12-31T23:59:59.000Z"),
      },
    ],
    auditLogs: [{ id: "audit-1" }],
  };
}

function createClient(organization: ReturnType<typeof createCompleteOrganization> | null) {
  const findUnique = vi.fn().mockResolvedValue(organization);
  const count = vi.fn().mockResolvedValue(3);
  const mutationSpies = {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    upsert: vi.fn(),
    transaction: vi.fn(),
  };
  const client = {
    organization: {
      findUnique,
      count,
      create: mutationSpies.create,
      update: mutationSpies.update,
      delete: mutationSpies.delete,
      deleteMany: mutationSpies.deleteMany,
      upsert: mutationSpies.upsert,
    },
    $transaction: mutationSpies.transaction,
  } as unknown as UtopiaTraxDemoReadClient;

  return {
    client,
    findUnique,
    count,
    mutationSpies,
  };
}

describe("UtopiaTrax demo health validator", () => {
  it("fails clearly when the workspace is missing", async () => {
    const { client } = createClient(null);
    const result = await validateUtopiaTraxDemoHealth(client);

    expect(result.passed).toBe(false);
    expect(result.checks).toEqual([
      expect.objectContaining({
        key: "workspace",
        status: "FAIL",
        detail: expect.stringContaining("npm run db:seed:utopiatrax"),
      }),
    ]);
  });

  it("passes when the read model contains a complete demo workspace", async () => {
    const { client } = createClient(createCompleteOrganization());
    const result = await validateUtopiaTraxDemoHealth(client);

    expect(result.passed).toBe(true);
    expect(result.checks.every((check) => check.status === "PASS")).toBe(true);
    expect(result.snapshot.cards).toHaveLength(25);
    expect(
      result.snapshot.cards.find(
        (card) => card.title === UTOPIATRAX_SHOWCASE_CARD_TITLE
      )
    ).toBeTruthy();
  });

  it("reports missing stored evidence", async () => {
    const organization = createCompleteOrganization();
    organization.savingCards.forEach((card) => {
      card.evidence = [];
    });
    const { client } = createClient(organization);
    const result = await validateUtopiaTraxDemoHealth(client);

    expect(result.passed).toBe(false);
    expect(result.checks).toContainEqual(
      expect.objectContaining({
        key: "evidence",
        status: "FAIL",
      })
    );
  });

  it("reports missing alternative scenarios", async () => {
    const organization = createCompleteOrganization();
    organization.savingCards.forEach((card) => {
      card.alternativeSuppliers = [];
      card.alternativeMaterials = [];
    });
    const { client } = createClient(organization);
    const result = await validateUtopiaTraxDemoHealth(client);

    expect(result.passed).toBe(false);
    expect(result.checks).toContainEqual(
      expect.objectContaining({
        key: "alternatives",
        status: "FAIL",
      })
    );
  });

  it("reports missing billing access", async () => {
    const organization = createCompleteOrganization();
    organization.billingCustomer = null as never;
    organization.subscriptions = [];
    const { client } = createClient(organization);
    const result = await validateUtopiaTraxDemoHealth(client);

    expect(result.passed).toBe(false);
    expect(result.checks).toContainEqual(
      expect.objectContaining({
        key: "billing",
        status: "FAIL",
      })
    );
  });

  it("reports empty route-critical datasets", async () => {
    const organization = createCompleteOrganization();
    organization.savingCards = [];
    const { client } = createClient(organization);
    const result = await validateUtopiaTraxDemoHealth(client);

    expect(result.passed).toBe(false);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "cards", status: "FAIL" }),
        expect.objectContaining({ key: "phases", status: "FAIL" }),
        expect.objectContaining({ key: "open-actions", status: "FAIL" }),
        expect.objectContaining({ key: "volume", status: "FAIL" }),
        expect.objectContaining({ key: "showcase-card", status: "FAIL" }),
      ])
    );
  });

  it("uses read-only organization queries and never invokes mutations", async () => {
    const { client, findUnique, count, mutationSpies } = createClient(
      createCompleteOrganization()
    );

    await validateUtopiaTraxDemoHealth(client);

    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(count).toHaveBeenCalledTimes(1);
    for (const spy of Object.values(mutationSpies)) {
      expect(spy).not.toHaveBeenCalled();
    }
  });
});
