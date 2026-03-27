import "server-only";

import { Prisma } from "@prisma/client";
import Stripe from "stripe";

import {
  getStripeBillingConfig,
  type StripeBillingConfig,
  type StripePlanCatalogKey,
} from "@/lib/billing/config";
import { getStripeClient } from "@/lib/billing/stripe";
import { prisma } from "@/lib/prisma";
import { billingCustomerSelect, type BillingCustomerRecord } from "@/lib/types";

type BillingCustomerClient = Pick<typeof prisma, "billingCustomer">;

type StripeBillingClient = Pick<Stripe, "billingPortal" | "checkout" | "customers">;

export type CreateCheckoutSessionInput = {
  organizationId: string;
  userId: string;
  customerEmail?: string | null;
  customerName?: string | null;
  planCode: StripePlanCatalogKey;
  priceId: string;
};

export type CreateBillingPortalSessionInput = {
  organizationId: string;
};

export type CheckoutPlanSelection = {
  planCode: StripePlanCatalogKey;
  productId: string;
  priceId: string;
  meteredPriceId: string;
};

export type CheckoutSessionResult = {
  sessionId: string;
  url: string;
  organizationId: string;
  stripeCustomerId: string;
  planCode: StripePlanCatalogKey;
  priceId: string;
};

export type BillingPortalSessionResult = {
  url: string;
  organizationId: string;
  stripeCustomerId: string;
};

export class BillingCheckoutError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 | 422 | 500 = 400
  ) {
    super(message);
    this.name = "BillingCheckoutError";
  }
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) || (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

function normalizeRequiredString(value: string, fieldName: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new BillingCheckoutError(`${fieldName} is required.`, 422);
  }

  return normalized;
}

function normalizeOptionalString(value?: string | null) {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

function normalizeStripeMetadata(metadata: Stripe.Metadata) {
  const entries = Object.entries(metadata).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string"
  );

  if (!entries.length) {
    return undefined;
  }

  return Object.fromEntries(entries);
}

export function resolveCheckoutPlanSelection(
  input: Pick<CreateCheckoutSessionInput, "planCode" | "priceId">,
  config: StripeBillingConfig = getStripeBillingConfig()
): CheckoutPlanSelection {
  const priceId = normalizeRequiredString(input.priceId, "Price id");
  const plan = config.plans[input.planCode];

  if (!plan) {
    throw new BillingCheckoutError("Requested billing plan is invalid.", 422);
  }

  if (priceId !== plan.basePriceId) {
    throw new BillingCheckoutError("Requested billing price is invalid.", 422);
  }

  return {
    planCode: input.planCode,
    productId: plan.stripeProductId,
    priceId: plan.basePriceId,
    meteredPriceId: plan.meteredPriceId,
  };
}

export async function getOrganizationBillingCustomer(
  organizationId: string,
  client: BillingCustomerClient = prisma
): Promise<BillingCustomerRecord | null> {
  return client.billingCustomer.findUnique({
    where: {
      organizationId: normalizeRequiredString(
        organizationId,
        "Organization id"
      ),
    },
    select: billingCustomerSelect,
  });
}

export async function getOrCreateOrganizationBillingCustomer(
  input: Pick<
    CreateCheckoutSessionInput,
    "organizationId" | "userId" | "customerEmail" | "customerName"
  >,
  dependencies: {
    prismaClient?: BillingCustomerClient;
    stripeClient?: StripeBillingClient;
  } = {}
): Promise<BillingCustomerRecord> {
  const organizationId = normalizeRequiredString(
    input.organizationId,
    "Organization id"
  );
  const userId = normalizeRequiredString(input.userId, "User id");
  const customerEmail = normalizeOptionalString(input.customerEmail);
  const customerName = normalizeOptionalString(input.customerName);
  const prismaClient = dependencies.prismaClient ?? prisma;
  const stripeClient = dependencies.stripeClient ?? getStripeClient();
  const existing = await getOrganizationBillingCustomer(organizationId, prismaClient);

  if (existing) {
    return existing;
  }

  const stripeCustomer = await stripeClient.customers.create(
    {
      email: customerEmail ?? undefined,
      name: customerName ?? undefined,
      metadata: {
        organizationId,
        createdByUserId: userId,
      },
    },
    {
      idempotencyKey: `billing-customer:${organizationId}`,
    }
  );

  try {
    return await prismaClient.billingCustomer.create({
      data: {
        organizationId,
        stripeCustomerId: stripeCustomer.id,
        email: stripeCustomer.email ?? customerEmail,
        name: stripeCustomer.name ?? customerName,
        ...(normalizeStripeMetadata(stripeCustomer.metadata)
          ? { metadata: normalizeStripeMetadata(stripeCustomer.metadata) }
          : {}),
      },
      select: billingCustomerSelect,
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const concurrentRecord = await getOrganizationBillingCustomer(
      organizationId,
      prismaClient
    );

    if (!concurrentRecord) {
      throw error;
    }

    return concurrentRecord;
  }
}

export async function createCheckoutSessionForOrganization(
  input: CreateCheckoutSessionInput,
  dependencies: {
    prismaClient?: BillingCustomerClient;
    stripeClient?: StripeBillingClient;
    config?: StripeBillingConfig;
  } = {}
): Promise<CheckoutSessionResult> {
  const organizationId = normalizeRequiredString(
    input.organizationId,
    "Organization id"
  );
  const userId = normalizeRequiredString(input.userId, "User id");
  const config = dependencies.config ?? getStripeBillingConfig();
  const stripeClient = dependencies.stripeClient ?? getStripeClient();
  const prismaClient = dependencies.prismaClient ?? prisma;
  const selection = resolveCheckoutPlanSelection(input, config);
  const billingCustomer = await getOrCreateOrganizationBillingCustomer(
    {
      organizationId,
      userId,
      customerEmail: input.customerEmail,
      customerName: input.customerName,
    },
    {
      prismaClient,
      stripeClient,
    }
  );
  const session = await stripeClient.checkout.sessions.create({
    mode: "subscription",
    customer: billingCustomer.stripeCustomerId,
    client_reference_id: organizationId,
    success_url: config.checkoutSuccessUrl,
    cancel_url: config.checkoutCancelUrl,
    allow_promotion_codes: true,
    line_items: [
      {
        price: selection.priceId,
        quantity: 1,
      },
      {
        price: selection.meteredPriceId,
      },
    ],
    metadata: {
      organizationId,
      requestedByUserId: userId,
      planCode: selection.planCode,
    },
    subscription_data: {
      metadata: {
        organizationId,
        requestedByUserId: userId,
        planCode: selection.planCode,
      },
    },
  });

  if (!session.url) {
    throw new BillingCheckoutError(
      "Stripe checkout session URL is unavailable.",
      500
    );
  }

  return {
    sessionId: session.id,
    url: session.url,
    organizationId,
    stripeCustomerId: billingCustomer.stripeCustomerId,
    planCode: selection.planCode,
    priceId: selection.priceId,
  };
}

export async function createBillingPortalSessionForOrganization(
  input: CreateBillingPortalSessionInput,
  dependencies: {
    prismaClient?: BillingCustomerClient;
    stripeClient?: StripeBillingClient;
    config?: StripeBillingConfig;
  } = {}
): Promise<BillingPortalSessionResult> {
  const organizationId = normalizeRequiredString(
    input.organizationId,
    "Organization id"
  );
  const config = dependencies.config ?? getStripeBillingConfig();
  const stripeClient = dependencies.stripeClient ?? getStripeClient();
  const prismaClient = dependencies.prismaClient ?? prisma;
  const billingCustomer = await getOrganizationBillingCustomer(
    organizationId,
    prismaClient
  );

  if (!billingCustomer) {
    throw new BillingCheckoutError(
      "Billing portal is unavailable because the organization does not have a billing customer.",
      404
    );
  }

  const session = await stripeClient.billingPortal.sessions.create({
    customer: billingCustomer.stripeCustomerId,
    return_url: config.portalReturnUrl,
  });

  return {
    url: session.url,
    organizationId,
    stripeCustomerId: billingCustomer.stripeCustomerId,
  };
}
