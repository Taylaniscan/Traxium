import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const TEST_STRIPE_SECRET_KEY =
  "sk_test_FAKE";
const TEST_WEBHOOK_SECRET =
  "whsec_FAKE";
const TEST_ORGANIZATION_ID = "org_atlas_procurement";

const retrieveSubscriptionMock = vi.hoisted(() => vi.fn());

const prismaState = vi.hoisted(() => ({
  billingCustomers: [] as Array<Record<string, unknown>>,
  subscriptions: [] as Array<Record<string, unknown>>,
  webhookEvents: [] as Array<Record<string, unknown>>,
  productPlans: [] as Array<Record<string, unknown>>,
  planPrices: [] as Array<Record<string, unknown>>,
}));

const prismaMock = vi.hoisted(() => {
  function cloneRecord<T>(record: T): T {
    return { ...(record as Record<string, unknown>) } as T;
  }

  function selectRecord<T extends Record<string, unknown>>(
    record: T | null | undefined,
    select?: Record<string, boolean>
  ) {
    if (!record) {
      return null;
    }

    if (!select) {
      return cloneRecord(record);
    }

    return Object.fromEntries(
      Object.entries(select)
        .filter((entry) => entry[1])
        .map(([key]) => [key, record[key]])
    );
  }

  function findByWhere(
    records: Array<Record<string, unknown>>,
    where: Record<string, unknown>
  ) {
    return (
      records.find((record) =>
        Object.entries(where).every(([key, value]) => record[key] === value)
      ) ?? null
    );
  }

  function applyUpdate(
    record: Record<string, unknown>,
    data: Record<string, unknown>
  ) {
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        record[key] = value;
      }
    }

    if ("updatedAt" in record) {
      record.updatedAt = new Date();
    }

    return record;
  }

  const prisma = {
    __state: prismaState,
    $transaction: vi.fn(async (callback: (client: typeof prisma) => unknown) =>
      callback(prisma)
    ),
    billingCustomer: {
      findUnique: vi.fn(async ({ where, select }: { where: Record<string, unknown>; select?: Record<string, boolean> }) =>
        selectRecord(findByWhere(prismaState.billingCustomers, where), select)
      ),
      update: vi.fn(async ({
        where,
        data,
        select,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
        select?: Record<string, boolean>;
      }) => {
        const record = findByWhere(prismaState.billingCustomers, where);

        if (!record) {
          throw new Error("Billing customer not found.");
        }

        return selectRecord(applyUpdate(record, data), select);
      }),
      upsert: vi.fn(async ({
        where,
        update,
        create,
        select,
      }: {
        where: Record<string, unknown>;
        update: Record<string, unknown>;
        create: Record<string, unknown>;
        select?: Record<string, boolean>;
      }) => {
        const existing = findByWhere(prismaState.billingCustomers, where);

        if (existing) {
          return selectRecord(applyUpdate(existing, update), select);
        }

        const created = {
          id: `bc_${prismaState.billingCustomers.length + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...create,
        };
        prismaState.billingCustomers.push(created);

        return selectRecord(created, select);
      }),
    },
    subscription: {
      findUnique: vi.fn(async ({ where, select }: { where: Record<string, unknown>; select?: Record<string, boolean> }) =>
        selectRecord(findByWhere(prismaState.subscriptions, where), select)
      ),
      upsert: vi.fn(async ({
        where,
        update,
        create,
      }: {
        where: Record<string, unknown>;
        update: Record<string, unknown>;
        create: Record<string, unknown>;
      }) => {
        const existing = findByWhere(prismaState.subscriptions, where);

        if (existing) {
          return cloneRecord(applyUpdate(existing, update));
        }

        const created = {
          id: `subrec_${prismaState.subscriptions.length + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...create,
        };
        prismaState.subscriptions.push(created);

        return cloneRecord(created);
      }),
    },
    productPlan: {
      findUnique: vi.fn(async ({ where, select }: { where: Record<string, unknown>; select?: Record<string, boolean> }) =>
        selectRecord(findByWhere(prismaState.productPlans, where), select)
      ),
    },
    planPrice: {
      findUnique: vi.fn(async ({ where, select }: { where: Record<string, unknown>; select?: Record<string, boolean> }) =>
        selectRecord(findByWhere(prismaState.planPrices, where), select)
      ),
    },
    webhookEvent: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const existing = findByWhere(prismaState.webhookEvents, {
          stripeEventId: data.stripeEventId,
        });

        if (existing) {
          const error = new Error("Unique constraint failed.");
          (error as { code?: string }).code = "P2002";
          throw error;
        }

        const created = {
          id: `whe_${prismaState.webhookEvents.length + 1}`,
          organizationId: null,
          receivedAt: new Date(),
          processedAt: null,
          processingError: null,
          updatedAt: new Date(),
          ...data,
        };
        prismaState.webhookEvents.push(created);

        return cloneRecord(created);
      }),
      findUnique: vi.fn(async ({
        where,
        select,
      }: {
        where: Record<string, unknown>;
        select?: Record<string, boolean>;
      }) => selectRecord(findByWhere(prismaState.webhookEvents, where), select)),
      update: vi.fn(async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        const record = findByWhere(prismaState.webhookEvents, where);

        if (!record) {
          throw new Error("Webhook event not found.");
        }

        return cloneRecord(applyUpdate(record, data));
      }),
      updateMany: vi.fn(async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        const record = findByWhere(prismaState.webhookEvents, where);

        if (!record) {
          return { count: 0 };
        }

        applyUpdate(record, data);
        return { count: 1 };
      }),
    },
  };

  return prisma;
});

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/billing/stripe", async () => {
  const StripeModule = await import("stripe");
  const StripeClient = StripeModule.default;
  const verificationClient = new StripeClient(
    "sk_test_FAKE"
  );
  const mockStripeClient = {
    webhooks: {
      constructEvent: (
        payload: string,
        signature: string,
        secret: string
      ) => verificationClient.webhooks.constructEvent(payload, signature, secret),
    },
    subscriptions: {
      retrieve: retrieveSubscriptionMock,
    },
  };

  return {
    createStripeClient: vi.fn(() => mockStripeClient),
    getStripeClient: vi.fn(() => mockStripeClient),
    resetStripeClientForTests: vi.fn(),
  };
});

import { POST as stripeWebhookRoute } from "@/app/api/billing/webhook/route";

const signatureClient = new Stripe(TEST_STRIPE_SECRET_KEY);

function createStripeEvent(
  input: {
    id: string;
    type:
      | "customer.created"
      | "customer.updated"
      | "checkout.session.completed"
      | "customer.subscription.created"
      | "customer.subscription.updated"
      | "customer.subscription.deleted";
    object: Record<string, unknown>;
  }
) {
  return {
    id: input.id,
    object: "event",
    api_version: "2025-02-24.acacia",
    created: 1_774_606_400,
    data: {
      object: input.object,
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: null,
      idempotency_key: null,
    },
    type: input.type,
  };
}

function createCustomerObject(
  overrides: Record<string, unknown> = {}
) {
  return {
    id: "cus_atlas_001",
    object: "customer",
    email: "billing@atlas.example",
    name: "Atlas Procurement",
    metadata: {
      organizationId: TEST_ORGANIZATION_ID,
    },
    ...overrides,
  };
}

function createSubscriptionObject(
  overrides: Record<string, unknown> = {}
) {
  return {
    id: "sub_atlas_001",
    object: "subscription",
    customer: "cus_atlas_001",
    metadata: {
      organizationId: TEST_ORGANIZATION_ID,
    },
    status: "active",
    cancel_at_period_end: false,
    current_period_start: 1_774_606_400,
    current_period_end: 1_777_196_800,
    trial_start: null,
    trial_end: null,
    canceled_at: null,
    ended_at: null,
    items: {
      object: "list",
      data: [
        {
          id: "si_atlas_001",
          object: "subscription_item",
          quantity: 3,
          current_period_start: 1_774_606_400,
          current_period_end: 1_777_196_800,
          price: {
            id: "price_localdevstartermonthly2026",
            object: "price",
            currency: "usd",
            product: "prod_localdevstarter2026",
            recurring: {
              usage_type: "licensed",
            },
          },
        },
      ],
      has_more: false,
      total_count: 1,
      url: "/v1/subscription_items?subscription=sub_atlas_001",
    },
    ...overrides,
  };
}

function createCheckoutSessionObject(
  overrides: Record<string, unknown> = {}
) {
  return {
    id: "cs_atlas_001",
    object: "checkout.session",
    mode: "subscription",
    customer: "cus_atlas_checkout",
    subscription: "sub_checkout_001",
    metadata: {
      organizationId: TEST_ORGANIZATION_ID,
    },
    customer_details: {
      email: "finance@atlas.example",
      name: "Atlas Finance",
    },
    ...overrides,
  };
}

function createSignedWebhookRequest(event: Record<string, unknown>) {
  const payload = JSON.stringify(event);
  const signature = signatureClient.webhooks.generateTestHeaderString({
    payload,
    secret: TEST_WEBHOOK_SECRET,
  });

  return new Request("http://localhost/api/billing/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": signature,
    },
    body: payload,
  });
}

describe("Stripe webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    prismaState.billingCustomers.length = 0;
    prismaState.subscriptions.length = 0;
    prismaState.webhookEvents.length = 0;
    prismaState.productPlans.length = 0;
    prismaState.planPrices.length = 0;

    prismaState.productPlans.push({
      id: "plan_starter",
      code: "starter",
      name: "Starter",
      stripeProductId: "prod_localdevstarter2026",
    });
    prismaState.planPrices.push({
      id: "price_starter_base",
      productPlanId: "plan_starter",
      stripePriceId: "price_localdevstartermonthly2026",
    });

    process.env.APP_ENV = "development";
    process.env.STRIPE_SECRET_KEY = TEST_STRIPE_SECRET_KEY;
    process.env.STRIPE_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
    process.env.STRIPE_PORTAL_RETURN_URL = "http://localhost:3000/settings/billing";
    process.env.STRIPE_CHECKOUT_SUCCESS_URL =
      "http://localhost:3000/settings/billing?checkout=success";
    process.env.STRIPE_CHECKOUT_CANCEL_URL =
      "http://localhost:3000/settings/billing?checkout=cancelled";
    process.env.STRIPE_STARTER_PRODUCT_ID = "prod_localdevstarter2026";
    process.env.STRIPE_STARTER_BASE_PRICE_ID = "price_localdevstartermonthly2026";
    process.env.STRIPE_STARTER_METERED_PRICE_ID = "price_localdevstarterusage2026";
    process.env.STRIPE_GROWTH_PRODUCT_ID = "prod_localdevgrowth2026";
    process.env.STRIPE_GROWTH_BASE_PRICE_ID = "price_localdevgrowthmonthly2026";
    process.env.STRIPE_GROWTH_METERED_PRICE_ID = "price_localdevgrowthusage2026";

    retrieveSubscriptionMock.mockReset();
  });

  it("rejects webhook requests with an invalid Stripe signature", async () => {
    const response = await stripeWebhookRoute(
      new Request("http://localhost/api/billing/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "stripe-signature": "t=123,v1=invalid",
        },
        body: JSON.stringify(
          createStripeEvent({
            id: "evt_invalid_signature",
            type: "customer.created",
            object: createCustomerObject(),
          })
        ),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid Stripe webhook signature.",
    });
    expect(prismaState.webhookEvents).toHaveLength(0);
  });

  it("handles the same Stripe event idempotently without duplicating data", async () => {
    const event = createStripeEvent({
      id: "evt_duplicate_customer",
      type: "customer.created",
      object: createCustomerObject(),
    });

    const firstResponse = await stripeWebhookRoute(createSignedWebhookRequest(event));
    const secondResponse = await stripeWebhookRoute(createSignedWebhookRequest(event));

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    await expect(firstResponse.json()).resolves.toEqual({
      received: true,
      duplicate: false,
      status: "processed",
    });
    await expect(secondResponse.json()).resolves.toEqual({
      received: true,
      duplicate: true,
      status: "duplicate",
    });
    expect(prismaState.billingCustomers).toHaveLength(1);
    expect(prismaState.webhookEvents).toHaveLength(1);
  });

  it("syncs billing customers for customer.created and customer.updated events", async () => {
    await stripeWebhookRoute(
      createSignedWebhookRequest(
        createStripeEvent({
          id: "evt_customer_created",
          type: "customer.created",
          object: createCustomerObject(),
        })
      )
    );

    await stripeWebhookRoute(
      createSignedWebhookRequest(
        createStripeEvent({
          id: "evt_customer_updated",
          type: "customer.updated",
          object: createCustomerObject({
            email: "procurement.finance@atlas.example",
            name: "Atlas Procurement Finance",
          }),
        })
      )
    );

    expect(prismaState.billingCustomers).toEqual([
      expect.objectContaining({
        organizationId: TEST_ORGANIZATION_ID,
        stripeCustomerId: "cus_atlas_001",
        email: "procurement.finance@atlas.example",
        name: "Atlas Procurement Finance",
      }),
    ]);
  });

  it("syncs checkout.session.completed by linking the customer and retrieving the subscription", async () => {
    retrieveSubscriptionMock.mockResolvedValueOnce(
      createSubscriptionObject({
        id: "sub_checkout_001",
        customer: {
          ...createCustomerObject({
            id: "cus_atlas_checkout",
            email: "finance@atlas.example",
            name: "Atlas Finance",
          }),
        },
      })
    );

    const response = await stripeWebhookRoute(
      createSignedWebhookRequest(
        createStripeEvent({
          id: "evt_checkout_completed",
          type: "checkout.session.completed",
          object: createCheckoutSessionObject(),
        })
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      received: true,
      duplicate: false,
      status: "processed",
    });
    expect(retrieveSubscriptionMock).toHaveBeenCalledWith("sub_checkout_001", {
      expand: ["customer", "items.data.price.product"],
    });
    expect(prismaState.billingCustomers).toEqual([
      expect.objectContaining({
        organizationId: TEST_ORGANIZATION_ID,
        stripeCustomerId: "cus_atlas_checkout",
        email: "finance@atlas.example",
        name: "Atlas Finance",
      }),
    ]);
    expect(prismaState.subscriptions).toEqual([
      expect.objectContaining({
        organizationId: TEST_ORGANIZATION_ID,
        stripeSubscriptionId: "sub_checkout_001",
        status: "ACTIVE",
        billingCustomerId: "bc_1",
        productPlanId: "plan_starter",
        planPriceId: "price_starter_base",
      }),
    ]);
  });

  it("syncs subscription created, updated, and deleted events to the organization record", async () => {
    await stripeWebhookRoute(
      createSignedWebhookRequest(
        createStripeEvent({
          id: "evt_subscription_created",
          type: "customer.subscription.created",
          object: createSubscriptionObject(),
        })
      )
    );

    await stripeWebhookRoute(
      createSignedWebhookRequest(
        createStripeEvent({
          id: "evt_subscription_updated",
          type: "customer.subscription.updated",
          object: createSubscriptionObject({
            status: "past_due",
            cancel_at_period_end: true,
            items: {
              object: "list",
              data: [
                {
                  id: "si_atlas_001",
                  object: "subscription_item",
                  quantity: 7,
                  current_period_start: 1_774_606_400,
                  current_period_end: 1_777_196_800,
                  price: {
                    id: "price_localdevstartermonthly2026",
                    object: "price",
                    currency: "usd",
                    product: "prod_localdevstarter2026",
                    recurring: {
                      usage_type: "licensed",
                    },
                  },
                },
              ],
              has_more: false,
              total_count: 1,
              url: "/v1/subscription_items?subscription=sub_atlas_001",
            },
          }),
        })
      )
    );

    await stripeWebhookRoute(
      createSignedWebhookRequest(
        createStripeEvent({
          id: "evt_subscription_deleted",
          type: "customer.subscription.deleted",
          object: createSubscriptionObject({
            status: "canceled",
            cancel_at_period_end: false,
            canceled_at: 1_774_700_000,
            ended_at: 1_774_700_000,
            items: {
              object: "list",
              data: [
                {
                  id: "si_atlas_001",
                  object: "subscription_item",
                  quantity: 7,
                  current_period_start: 1_774_606_400,
                  current_period_end: 1_777_196_800,
                  price: {
                    id: "price_localdevstartermonthly2026",
                    object: "price",
                    currency: "usd",
                    product: "prod_localdevstarter2026",
                    recurring: {
                      usage_type: "licensed",
                    },
                  },
                },
              ],
              has_more: false,
              total_count: 1,
              url: "/v1/subscription_items?subscription=sub_atlas_001",
            },
          }),
        })
      )
    );

    expect(prismaState.subscriptions).toHaveLength(1);
    expect(prismaState.subscriptions[0]).toEqual(
      expect.objectContaining({
        organizationId: TEST_ORGANIZATION_ID,
        stripeSubscriptionId: "sub_atlas_001",
        billingCustomerId: "bc_1",
        status: "CANCELED",
        quantity: 7,
        cancelAtPeriodEnd: false,
        productPlanId: "plan_starter",
        planPriceId: "price_starter_base",
      })
    );
    expect(prismaState.webhookEvents).toHaveLength(3);
    expect(prismaState.webhookEvents.every((event) => event.processedAt instanceof Date)).toBe(
      true
    );
  });

  it("fails explicitly when Stripe sends an unknown subscription status", async () => {
    const response = await stripeWebhookRoute(
      createSignedWebhookRequest(
        createStripeEvent({
          id: "evt_subscription_unknown_status",
          type: "customer.subscription.updated",
          object: createSubscriptionObject({
            status: "future_status",
          }),
        })
      )
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error:
        'Unsupported Stripe subscription status "future_status". Update the billing sync before processing this event.',
    });
    expect(prismaState.subscriptions).toHaveLength(0);
    expect(prismaState.webhookEvents).toEqual([
      expect.objectContaining({
        stripeEventId: "evt_subscription_unknown_status",
        processedAt: null,
        processingError:
          'Unsupported Stripe subscription status "future_status". Update the billing sync before processing this event.',
      }),
    ]);
  });
});
