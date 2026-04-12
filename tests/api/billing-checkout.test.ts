import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_ORGANIZATION_ID,
  DEFAULT_USER_ID,
  OTHER_ORGANIZATION_ID,
  MockAuthGuardError,
  createAuthGuardJsonResponse,
  createSessionUser,
} from "../helpers/security-fixtures";

vi.mock("server-only", () => ({}));

const requireOrganizationMock = vi.hoisted(() => vi.fn());
const createAuthGuardErrorResponseMock = vi.hoisted(() => vi.fn());
const customersCreateMock = vi.hoisted(() => vi.fn());
const checkoutSessionsCreateMock = vi.hoisted(() => vi.fn());
const billingPortalSessionsCreateMock = vi.hoisted(() => vi.fn());

const prismaState = vi.hoisted(() => ({
  billingCustomers: [] as Array<Record<string, unknown>>,
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

  return {
    billingCustomer: {
      findUnique: vi.fn(
        async ({
          where,
          select,
        }: {
          where: Record<string, unknown>;
          select?: Record<string, boolean>;
        }) => selectRecord(findByWhere(prismaState.billingCustomers, where), select)
      ),
      create: vi.fn(
        async ({
          data,
          select,
        }: {
          data: Record<string, unknown>;
          select?: Record<string, boolean>;
        }) => {
          const existingByOrganization = findByWhere(prismaState.billingCustomers, {
            organizationId: data.organizationId,
          });
          const existingByStripeId = findByWhere(prismaState.billingCustomers, {
            stripeCustomerId: data.stripeCustomerId,
          });

          if (existingByOrganization || existingByStripeId) {
            const error = new Error("Unique constraint failed.");
            (error as { code?: string }).code = "P2002";
            throw error;
          }

          const created = {
            id: `bc_${prismaState.billingCustomers.length + 1}`,
            createdAt: new Date(),
            updatedAt: new Date(),
            metadata: null,
            ...data,
          };
          prismaState.billingCustomers.push(created);

          return selectRecord(created, select);
        }
      ),
    },
  };
});

vi.mock("@/lib/auth", () => ({
  requireOrganization: requireOrganizationMock,
  createAuthGuardErrorResponse: createAuthGuardErrorResponseMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/billing/stripe", () => ({
  getStripeClient: vi.fn(() => ({
    customers: {
      create: customersCreateMock,
    },
    checkout: {
      sessions: {
        create: checkoutSessionsCreateMock,
      },
    },
    billingPortal: {
      sessions: {
        create: billingPortalSessionsCreateMock,
      },
    },
  })),
}));

import { POST as billingCheckoutRoute } from "@/app/api/billing/checkout/route";
import { POST as billingPortalRoute } from "@/app/api/billing/portal/route";

function createCheckoutRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/billing/checkout", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function clearStripeBillingEnv() {
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  delete process.env.STRIPE_PORTAL_RETURN_URL;
  delete process.env.STRIPE_CHECKOUT_SUCCESS_URL;
  delete process.env.STRIPE_CHECKOUT_CANCEL_URL;
  delete process.env.STRIPE_STARTER_PRODUCT_ID;
  delete process.env.STRIPE_STARTER_BASE_PRICE_ID;
  delete process.env.STRIPE_STARTER_METERED_PRICE_ID;
  delete process.env.STRIPE_GROWTH_PRODUCT_ID;
  delete process.env.STRIPE_GROWTH_BASE_PRICE_ID;
  delete process.env.STRIPE_GROWTH_METERED_PRICE_ID;
}

describe("billing checkout routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    prismaState.billingCustomers.length = 0;

    process.env.APP_ENV = "development";
    process.env.STRIPE_SECRET_KEY =
      "sk_test_FAKE";
    process.env.STRIPE_WEBHOOK_SECRET =
      "whsec_FAKE";
    process.env.STRIPE_PORTAL_RETURN_URL =
      "http://localhost:3000/settings/billing";
    process.env.STRIPE_CHECKOUT_SUCCESS_URL =
      "http://localhost:3000/settings/billing?checkout=success";
    process.env.STRIPE_CHECKOUT_CANCEL_URL =
      "http://localhost:3000/settings/billing?checkout=cancelled";
    process.env.STRIPE_STARTER_PRODUCT_ID = "prod_localdevstarter2026";
    process.env.STRIPE_STARTER_BASE_PRICE_ID =
      "price_localdevstartermonthly2026";
    process.env.STRIPE_STARTER_METERED_PRICE_ID =
      "price_localdevstarterusage2026";
    process.env.STRIPE_GROWTH_PRODUCT_ID = "prod_localdevgrowth2026";
    process.env.STRIPE_GROWTH_BASE_PRICE_ID =
      "price_localdevgrowthmonthly2026";
    process.env.STRIPE_GROWTH_METERED_PRICE_ID =
      "price_localdevgrowthusage2026";

    requireOrganizationMock.mockResolvedValue(
      createSessionUser({
        id: DEFAULT_USER_ID,
        email: "buyer@atlas.example",
        organizationId: DEFAULT_ORGANIZATION_ID,
        activeOrganizationId: DEFAULT_ORGANIZATION_ID,
        activeOrganization: {
          membershipId: "membership-org-1",
          organizationId: DEFAULT_ORGANIZATION_ID,
          membershipRole: "ADMIN",
          membershipStatus: "ACTIVE",
        },
      })
    );
    createAuthGuardErrorResponseMock.mockImplementation(createAuthGuardJsonResponse);
    customersCreateMock.mockResolvedValue({
      id: "cus_atlas_001",
      email: "buyer@atlas.example",
      name: null,
      metadata: {
        organizationId: DEFAULT_ORGANIZATION_ID,
        createdByUserId: DEFAULT_USER_ID,
      },
    });
    checkoutSessionsCreateMock.mockResolvedValue({
      id: "cs_test_001",
      url: "https://checkout.stripe.com/c/pay/cs_test_001",
    });
    billingPortalSessionsCreateMock.mockResolvedValue({
      url: "https://billing.stripe.com/p/session/test_001",
    });
  });

  it("creates a tenant-scoped checkout session and initializes the organization billing customer when missing", async () => {
    const response = await billingCheckoutRoute(
      createCheckoutRequest({
        planCode: "starter",
        priceId: process.env.STRIPE_STARTER_BASE_PRICE_ID,
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      sessionId: "cs_test_001",
      url: "https://checkout.stripe.com/c/pay/cs_test_001",
    });
    expect(customersCreateMock).toHaveBeenCalledWith(
      {
        email: "buyer@atlas.example",
        name: undefined,
        metadata: {
          organizationId: DEFAULT_ORGANIZATION_ID,
          createdByUserId: DEFAULT_USER_ID,
        },
      },
      {
        idempotencyKey: `billing-customer:${DEFAULT_ORGANIZATION_ID}`,
      }
    );
    expect(checkoutSessionsCreateMock).toHaveBeenCalledWith({
      mode: "subscription",
      customer: "cus_atlas_001",
      client_reference_id: DEFAULT_ORGANIZATION_ID,
      success_url: "http://localhost:3000/settings/billing?checkout=success",
      cancel_url: "http://localhost:3000/settings/billing?checkout=cancelled",
      allow_promotion_codes: true,
      line_items: [
        {
          price: "price_localdevstartermonthly2026",
          quantity: 1,
        },
        {
          price: "price_localdevstarterusage2026",
        },
      ],
      metadata: {
        organizationId: DEFAULT_ORGANIZATION_ID,
        requestedByUserId: DEFAULT_USER_ID,
        planCode: "starter",
      },
      subscription_data: {
        metadata: {
          organizationId: DEFAULT_ORGANIZATION_ID,
          requestedByUserId: DEFAULT_USER_ID,
          planCode: "starter",
        },
      },
    });
    expect(prismaState.billingCustomers).toEqual([
      expect.objectContaining({
        organizationId: DEFAULT_ORGANIZATION_ID,
        stripeCustomerId: "cus_atlas_001",
        email: "buyer@atlas.example",
      }),
    ]);
    expect(requireOrganizationMock).toHaveBeenCalledWith({
      redirectTo: null,
      allowBillingBlocked: true,
    });
  });

  it("rejects unauthorized checkout requests with the shared auth guard response", async () => {
    requireOrganizationMock.mockRejectedValueOnce(
      new MockAuthGuardError("Authenticated session is required.", 401, "UNAUTHENTICATED")
    );

    const response = await billingCheckoutRoute(
      createCheckoutRequest({
        planCode: "starter",
        priceId: process.env.STRIPE_STARTER_BASE_PRICE_ID,
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized.",
    });
    expect(customersCreateMock).not.toHaveBeenCalled();
    expect(checkoutSessionsCreateMock).not.toHaveBeenCalled();
  });

  it("rejects checkout when the submitted price id does not match the configured plan catalog", async () => {
    const response = await billingCheckoutRoute(
      createCheckoutRequest({
        planCode: "starter",
        priceId: "price_invalid_catalog_entry",
      })
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "Requested billing price is invalid.",
    });
    expect(customersCreateMock).not.toHaveBeenCalled();
    expect(checkoutSessionsCreateMock).not.toHaveBeenCalled();
    expect(prismaState.billingCustomers).toHaveLength(0);
  });

  it("returns a controlled local-development error when Stripe billing is not configured for checkout", async () => {
    clearStripeBillingEnv();

    const response = await billingCheckoutRoute(
      createCheckoutRequest({
        planCode: "starter",
        priceId: "price_localdevstartermonthly2026",
      })
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error:
        "Billing is not configured for local development yet. Add the local Stripe settings before starting a subscription.",
    });
    expect(customersCreateMock).not.toHaveBeenCalled();
    expect(checkoutSessionsCreateMock).not.toHaveBeenCalled();
    expect(prismaState.billingCustomers).toHaveLength(0);
  });

  it("reuses the existing organization billing customer instead of creating a new Stripe customer", async () => {
    prismaState.billingCustomers.push({
      id: "bc_existing",
      organizationId: DEFAULT_ORGANIZATION_ID,
      stripeCustomerId: "cus_existing_org_1",
      email: "billing@atlas.example",
      name: "Atlas Procurement",
      metadata: null,
      createdAt: new Date("2026-03-27T12:00:00.000Z"),
      updatedAt: new Date("2026-03-27T12:00:00.000Z"),
    });

    const response = await billingCheckoutRoute(
      createCheckoutRequest({
        planCode: "starter",
        priceId: process.env.STRIPE_STARTER_BASE_PRICE_ID,
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      sessionId: "cs_test_001",
      url: "https://checkout.stripe.com/c/pay/cs_test_001",
    });
    expect(customersCreateMock).not.toHaveBeenCalled();
    expect(checkoutSessionsCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_existing_org_1",
      })
    );
  });

  it("opens the billing portal with the active organization's billing customer only", async () => {
    prismaState.billingCustomers.push(
      {
        id: "bc_org_1",
        organizationId: DEFAULT_ORGANIZATION_ID,
        stripeCustomerId: "cus_org_1",
        email: "billing@atlas.example",
        name: "Atlas Procurement",
        metadata: null,
        createdAt: new Date("2026-03-27T12:00:00.000Z"),
        updatedAt: new Date("2026-03-27T12:00:00.000Z"),
      },
      {
        id: "bc_org_2",
        organizationId: OTHER_ORGANIZATION_ID,
        stripeCustomerId: "cus_org_2",
        email: "billing@other.example",
        name: "Other Workspace",
        metadata: null,
        createdAt: new Date("2026-03-27T12:00:00.000Z"),
        updatedAt: new Date("2026-03-27T12:00:00.000Z"),
      }
    );

    const response = await billingPortalRoute();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      url: "https://billing.stripe.com/p/session/test_001",
    });
    expect(billingPortalSessionsCreateMock).toHaveBeenCalledWith({
      customer: "cus_org_1",
      return_url: "http://localhost:3000/settings/billing",
    });
    expect(customersCreateMock).not.toHaveBeenCalled();
    expect(checkoutSessionsCreateMock).not.toHaveBeenCalled();
    expect(requireOrganizationMock).toHaveBeenCalledWith({
      redirectTo: null,
      allowBillingBlocked: true,
    });
  });

  it("returns a controlled 404 when the organization has no billing customer for portal access", async () => {
    clearStripeBillingEnv();

    const response = await billingPortalRoute();

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error:
        "Billing portal is unavailable because this workspace does not have a billing customer yet. Start a subscription first.",
    });
    expect(billingPortalSessionsCreateMock).not.toHaveBeenCalled();
  });
});
