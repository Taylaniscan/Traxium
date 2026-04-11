import { SubscriptionStatus } from "@prisma/client";
import {
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    subscription: {
      findMany: vi.fn(),
    },
  },
}));

import {
  getOrganizationAccessState,
  getOrganizationSubscriptionState,
  isOrganizationAccessBlocked,
  resolveOrganizationAccessState,
} from "@/lib/billing/access";
import type {
  OrganizationAccessStateResult,
  OrganizationAccessSubscriptionRecord,
} from "@/lib/billing/types";

const TEST_ORGANIZATION_ID = "org_access_state";
const NOW = new Date("2026-03-28T12:00:00.000Z");

function createSubscription(
  overrides: Partial<OrganizationAccessSubscriptionRecord> = {}
): OrganizationAccessSubscriptionRecord {
  return {
    id: "subrec_1",
    organizationId: TEST_ORGANIZATION_ID,
    billingCustomerId: "bc_1",
    productPlanId: "plan_growth",
    planPriceId: "price_growth_monthly",
    stripeSubscriptionId: "sub_1",
    status: SubscriptionStatus.ACTIVE,
    currencyCode: "usd",
    quantity: 1,
    cancelAtPeriodEnd: false,
    currentPeriodStart: new Date("2026-03-01T00:00:00.000Z"),
    currentPeriodEnd: new Date("2026-04-01T00:00:00.000Z"),
    trialStart: null,
    trialEnd: null,
    canceledAt: null,
    endedAt: null,
    metadata: {
      source: "test",
    },
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
    updatedAt: new Date("2026-03-28T00:00:00.000Z"),
    productPlan: {
      id: "plan_growth",
      code: "growth",
      name: "Growth",
      stripeProductId: "prod_growth",
      metadata: {
        seatsIncluded: 10,
      },
    },
    planPrice: {
      id: "price_growth_monthly",
      stripePriceId: "price_growth_monthly",
      type: "LICENSED",
      interval: "MONTH",
      intervalCount: 1,
      currencyCode: "usd",
      unitAmount: 29900,
      metadata: {
        kind: "base",
      },
    },
    ...overrides,
  };
}

function createConfiguredBillingEnv(
  overrides: Record<string, string | undefined> = {}
) {
  return {
    APP_ENV: "production",
    STRIPE_SECRET_KEY:
      "sk_live_FAKE",
    STRIPE_WEBHOOK_SECRET:
      "whsec_FAKE",
    STRIPE_PORTAL_RETURN_URL: "https://app.traxium.com/settings/billing",
    STRIPE_CHECKOUT_SUCCESS_URL:
      "https://app.traxium.com/settings/billing?checkout=success",
    STRIPE_CHECKOUT_CANCEL_URL:
      "https://app.traxium.com/settings/billing?checkout=cancelled",
    STRIPE_STARTER_PRODUCT_ID: "prod_1starterlivecatalog2026",
    STRIPE_STARTER_BASE_PRICE_ID: "price_1starterlivecatalog2026",
    STRIPE_STARTER_METERED_PRICE_ID: "price_1starterlivelogusage2026",
    STRIPE_GROWTH_PRODUCT_ID: "prod_1growthlivecatalog2026",
    STRIPE_GROWTH_BASE_PRICE_ID: "price_1growthlivecatalog2026",
    STRIPE_GROWTH_METERED_PRICE_ID: "price_1growthlivelogusage2026",
    ...overrides,
  };
}

describe("billing access state", () => {
  it("maps active and trialing subscriptions to allowed access states", () => {
    const active = resolveOrganizationAccessState({
      organizationId: TEST_ORGANIZATION_ID,
      subscription: createSubscription(),
      now: NOW,
    });
    const trialing = resolveOrganizationAccessState({
      organizationId: TEST_ORGANIZATION_ID,
      subscription: createSubscription({
        id: "subrec_2",
        stripeSubscriptionId: "sub_2",
        status: SubscriptionStatus.TRIALING,
        trialStart: new Date("2026-03-20T00:00:00.000Z"),
        trialEnd: new Date("2026-04-05T00:00:00.000Z"),
      }),
      now: NOW,
    });

    expect(active).toMatchObject({
      rawSubscriptionStatus: SubscriptionStatus.ACTIVE,
      accessState: "active",
      isBlocked: false,
      reasonCode: "active",
      currentPeriodEnd: new Date("2026-04-01T00:00:00.000Z"),
    });
    expect(trialing).toMatchObject({
      rawSubscriptionStatus: SubscriptionStatus.TRIALING,
      accessState: "trialing",
      isBlocked: false,
      reasonCode: "trialing",
    });
    expect(active.plan).toEqual({
      productPlanId: "plan_growth",
      planCode: "growth",
      planName: "Growth",
      stripeProductId: "prod_growth",
      planMetadata: {
        seatsIncluded: 10,
      },
      planPriceId: "price_growth_monthly",
      stripePriceId: "price_growth_monthly",
      priceType: "LICENSED",
      billingInterval: "MONTH",
      intervalCount: 1,
      currencyCode: "usd",
      unitAmount: 29900,
      priceMetadata: {
        kind: "base",
      },
    });
  });

  it("maps canceled and unpaid subscriptions to blocked access states", () => {
    const canceled = resolveOrganizationAccessState({
      organizationId: TEST_ORGANIZATION_ID,
      subscription: createSubscription({
        status: SubscriptionStatus.CANCELED,
        canceledAt: new Date("2026-03-25T00:00:00.000Z"),
        endedAt: new Date("2026-03-25T00:00:00.000Z"),
      }),
      now: NOW,
    });
    const unpaid = resolveOrganizationAccessState({
      organizationId: TEST_ORGANIZATION_ID,
      subscription: createSubscription({
        id: "subrec_3",
        stripeSubscriptionId: "sub_3",
        status: SubscriptionStatus.UNPAID,
      }),
      now: NOW,
    });

    expect(canceled).toMatchObject({
      rawSubscriptionStatus: SubscriptionStatus.CANCELED,
      accessState: "blocked_canceled",
      isBlocked: true,
      reasonCode: "canceled",
    });
    expect(unpaid).toMatchObject({
      rawSubscriptionStatus: SubscriptionStatus.UNPAID,
      accessState: "blocked_unpaid",
      isBlocked: true,
      reasonCode: "unpaid",
    });
    expect(isOrganizationAccessBlocked(canceled)).toBe(true);
    expect(isOrganizationAccessBlocked(unpaid)).toBe(true);
  });

  it("treats past due subscriptions as grace period before the period end and blocked afterward", () => {
    const gracePeriod = resolveOrganizationAccessState({
      organizationId: TEST_ORGANIZATION_ID,
      subscription: createSubscription({
        status: SubscriptionStatus.PAST_DUE,
        currentPeriodEnd: new Date("2026-03-30T00:00:00.000Z"),
      }),
      now: NOW,
    });
    const blocked = resolveOrganizationAccessState({
      organizationId: TEST_ORGANIZATION_ID,
      subscription: createSubscription({
        id: "subrec_4",
        stripeSubscriptionId: "sub_4",
        status: SubscriptionStatus.PAST_DUE,
        currentPeriodEnd: new Date("2026-03-20T00:00:00.000Z"),
      }),
      now: NOW,
    });

    expect(gracePeriod).toMatchObject({
      rawSubscriptionStatus: SubscriptionStatus.PAST_DUE,
      accessState: "grace_period",
      isBlocked: false,
      reasonCode: "past_due_grace_period",
    });
    expect(blocked).toMatchObject({
      rawSubscriptionStatus: SubscriptionStatus.PAST_DUE,
      accessState: "blocked_past_due",
      isBlocked: true,
      reasonCode: "past_due_blocked",
    });
  });

  it("treats a missing subscription as an explicit blocked no-subscription policy", () => {
    const result = resolveOrganizationAccessState({
      organizationId: TEST_ORGANIZATION_ID,
      subscription: null,
      now: NOW,
    });

    expect(result).toEqual({
      organizationId: TEST_ORGANIZATION_ID,
      subscriptionId: null,
      stripeSubscriptionId: null,
      rawSubscriptionStatus: null,
      accessState: "no_subscription",
      isBlocked: true,
      reasonCode: "no_subscription",
      currentPeriodEnd: null,
      plan: null,
    });
  });

  it("fails open in local development when Stripe billing is not configured so workspace access stays usable", async () => {
    const consoleInfoMock = vi
      .spyOn(console, "info")
      .mockImplementation(() => undefined);
    const findMany = vi.fn(async () => []);

    try {
      const result = await getOrganizationSubscriptionState(
        TEST_ORGANIZATION_ID,
        {
          envSource: {
            APP_ENV: "development",
          },
          prismaClient: {
            subscription: {
              findMany,
            },
          },
          now: NOW,
        }
      );

      expect(result).toEqual({
        organizationId: TEST_ORGANIZATION_ID,
        subscriptionId: null,
        stripeSubscriptionId: null,
        rawSubscriptionStatus: null,
        accessState: "active",
        isBlocked: false,
        reasonCode: "active",
        currentPeriodEnd: null,
        plan: null,
      });
      expect(findMany).not.toHaveBeenCalled();
      expect(consoleInfoMock).toHaveBeenCalledWith(
        expect.stringContaining('"event":"billing.access.fail_open"')
      );
    } finally {
      consoleInfoMock.mockRestore();
    }
  });

  it("fails closed for unknown subscription statuses instead of crashing", () => {
    const result = resolveOrganizationAccessState({
      organizationId: TEST_ORGANIZATION_ID,
      subscription: createSubscription({
        status: "LEGACY_UNKNOWN" as SubscriptionStatus,
      }),
      now: NOW,
    });

    expect(result).toMatchObject({
      rawSubscriptionStatus: "LEGACY_UNKNOWN",
      accessState: "blocked_canceled",
      isBlocked: true,
      reasonCode: "unknown",
    });
  });

  it("returns a stable typed shape and resolves through the Prisma-backed helper", async () => {
    const findMany = vi.fn(async () => [
      createSubscription({
        id: "subrec_old",
        stripeSubscriptionId: "sub_old",
        status: SubscriptionStatus.CANCELED,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-03-27T00:00:00.000Z"),
      }),
      createSubscription({
        id: "subrec_new",
        stripeSubscriptionId: "sub_new",
        status: SubscriptionStatus.ACTIVE,
        createdAt: new Date("2026-03-15T00:00:00.000Z"),
        updatedAt: new Date("2026-03-16T00:00:00.000Z"),
      }),
    ]);

    const result = await getOrganizationSubscriptionState(TEST_ORGANIZATION_ID, {
      prismaClient: {
        subscription: {
          findMany,
        },
      },
      now: NOW,
    });

    expect(findMany).toHaveBeenCalledWith({
      where: {
        organizationId: TEST_ORGANIZATION_ID,
      },
      orderBy: [
        {
          createdAt: "desc",
        },
        {
          updatedAt: "desc",
        },
        {
          currentPeriodEnd: "desc",
        },
      ],
      select: expect.any(Object),
    });
    expect(result).toMatchObject({
      organizationId: TEST_ORGANIZATION_ID,
      subscriptionId: "subrec_new",
      stripeSubscriptionId: "sub_new",
      rawSubscriptionStatus: SubscriptionStatus.ACTIVE,
      accessState: "active",
      isBlocked: false,
      reasonCode: "active",
    });
    expect(getOrganizationAccessState).toBe(getOrganizationSubscriptionState);

    expectTypeOf(result).toMatchTypeOf<OrganizationAccessStateResult>();
  });

  it("still enforces subscription blocking outside local fail-open mode", async () => {
    const findMany = vi.fn(async () => []);

    const result = await getOrganizationSubscriptionState(TEST_ORGANIZATION_ID, {
      envSource: createConfiguredBillingEnv(),
      prismaClient: {
        subscription: {
          findMany,
        },
      },
      now: NOW,
    });

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      organizationId: TEST_ORGANIZATION_ID,
      subscriptionId: null,
      stripeSubscriptionId: null,
      rawSubscriptionStatus: null,
      accessState: "no_subscription",
      isBlocked: true,
      reasonCode: "no_subscription",
      currentPeriodEnd: null,
      plan: null,
    });
  });
});
