import "server-only";

import { Prisma } from "@prisma/client";
import Stripe from "stripe";

import {
  getStripeBillingRuntimeConfig,
  type StripeBillingRuntimeConfig,
  type StripePlanCatalogKey,
} from "@/lib/billing/config";
import { getStripeClient } from "@/lib/billing/stripe";
import { resolveAppEnvironment } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { billingCustomerSelect, type BillingCustomerRecord } from "@/lib/types";

type BillingCustomerClient = Pick<typeof prisma, "billingCustomer">;

type StripeBillingClient = Pick<Stripe, "billingPortal" | "checkout" | "customers">;

const MAX_STRIPE_CHECKOUT_TRIAL_DAYS = 14;

export type CreateCheckoutSessionInput = {
  organizationId: string;
  userId: string;
  customerEmail?: string | null;
  customerName?: string | null;
  planCode: StripePlanCatalogKey;
  priceId: string;
  trialEnd?: Date | null;
};

export type CreateBillingPortalSessionInput = {
  organizationId: string;
};

export type CheckoutPlanSelection = {
  planCode: StripePlanCatalogKey;
  productId: string;
  priceId: string;
  meteredPriceId: string | null;
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
    readonly status: 400 | 404 | 409 | 422 | 500 | 503 = 400
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

function readStripeErrorString(error: unknown, field: "code" | "message") {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  const directValue = (error as Record<string, unknown>)[field];

  if (typeof directValue === "string") {
    return directValue;
  }

  const raw = (error as { raw?: unknown }).raw;

  if (typeof raw !== "object" || raw === null) {
    return null;
  }

  const rawValue = (raw as Record<string, unknown>)[field];
  return typeof rawValue === "string" ? rawValue : null;
}

function readStripeErrorStatus(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  const directValue = (error as { statusCode?: unknown }).statusCode;

  if (typeof directValue === "number") {
    return directValue;
  }

  const raw = (error as { raw?: unknown }).raw;

  if (typeof raw !== "object" || raw === null) {
    return null;
  }

  const rawValue = (raw as { statusCode?: unknown }).statusCode;
  return typeof rawValue === "number" ? rawValue : null;
}

function isStripeCustomerMissingError(error: unknown) {
  const statusCode = readStripeErrorStatus(error);
  const code = readStripeErrorString(error, "code");
  const message = readStripeErrorString(error, "message") ?? "";

  return (
    statusCode === 404 &&
    (code === "resource_missing" ||
      message.toLowerCase().includes("no such customer"))
  );
}

function looksLikePlaceholderStripeCustomerId(value: string) {
  const normalized = value.trim().toLowerCase();

  return (
    normalized.startsWith("cus_demo") ||
    normalized.startsWith("cus_fake") ||
    normalized.startsWith("cus_local") ||
    normalized.startsWith("cus_preview") ||
    normalized.startsWith("cus_sample")
  );
}

function createBillingConfigurationError() {
  if (resolveAppEnvironment() === "development") {
    return new BillingCheckoutError(
      "Billing is not configured for local development yet. Add the local Stripe settings before starting a subscription.",
      503
    );
  }

  return new BillingCheckoutError(
    "Billing is not available right now. Please try again later.",
    503
  );
}

function toStripeTrialEndTimestamp(value?: Date | null) {
  const now = Date.now();

  if (!value || value.getTime() <= now) {
    return undefined;
  }

  const maxTrialEnd = now + MAX_STRIPE_CHECKOUT_TRIAL_DAYS * 24 * 60 * 60 * 1000;
  return Math.floor(Math.min(value.getTime(), maxTrialEnd) / 1000);
}

function resolveStripeBillingConfig(
  config?: StripeBillingRuntimeConfig
) {
  if (config) {
    return config;
  }

  try {
    return getStripeBillingRuntimeConfig();
  } catch {
    throw createBillingConfigurationError();
  }
}

async function createStripeCustomerForOrganization(
  input: Pick<
    CreateCheckoutSessionInput,
    "organizationId" | "userId" | "customerEmail" | "customerName"
  >,
  stripeClient: StripeBillingClient
) {
  const organizationId = normalizeRequiredString(
    input.organizationId,
    "Organization id"
  );
  const userId = normalizeRequiredString(input.userId, "User id");
  const customerEmail = normalizeOptionalString(input.customerEmail);
  const customerName = normalizeOptionalString(input.customerName);

  return stripeClient.customers.create(
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
}

async function replaceOrganizationBillingCustomer(
  input: Pick<
    CreateCheckoutSessionInput,
    "organizationId" | "userId" | "customerEmail" | "customerName"
  >,
  dependencies: {
    prismaClient: BillingCustomerClient;
    stripeClient: StripeBillingClient;
  }
): Promise<BillingCustomerRecord> {
  const organizationId = normalizeRequiredString(
    input.organizationId,
    "Organization id"
  );
  const customerEmail = normalizeOptionalString(input.customerEmail);
  const customerName = normalizeOptionalString(input.customerName);
  const stripeCustomer = await createStripeCustomerForOrganization(
    input,
    dependencies.stripeClient
  );

  return dependencies.prismaClient.billingCustomer.update({
    where: {
      organizationId,
    },
    data: {
      stripeCustomerId: stripeCustomer.id,
      email: stripeCustomer.email ?? customerEmail,
      name: stripeCustomer.name ?? customerName,
      ...(normalizeStripeMetadata(stripeCustomer.metadata)
        ? { metadata: normalizeStripeMetadata(stripeCustomer.metadata) }
        : {}),
    },
    select: billingCustomerSelect,
  });
}

export function resolveCheckoutPlanSelection(
  input: Pick<CreateCheckoutSessionInput, "planCode" | "priceId">,
  config: StripeBillingRuntimeConfig = resolveStripeBillingConfig()
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
  const customerEmail = normalizeOptionalString(input.customerEmail);
  const customerName = normalizeOptionalString(input.customerName);
  const prismaClient = dependencies.prismaClient ?? prisma;
  const stripeClient = dependencies.stripeClient ?? getStripeClient();
  const existing = await getOrganizationBillingCustomer(organizationId, prismaClient);

  if (existing) {
    if (looksLikePlaceholderStripeCustomerId(existing.stripeCustomerId)) {
      return replaceOrganizationBillingCustomer(input, {
        prismaClient,
        stripeClient,
      });
    }

    return existing;
  }

  const stripeCustomer = await createStripeCustomerForOrganization(
    input,
    stripeClient
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
    config?: StripeBillingRuntimeConfig;
  } = {}
): Promise<CheckoutSessionResult> {
  const organizationId = normalizeRequiredString(
    input.organizationId,
    "Organization id"
  );
  const userId = normalizeRequiredString(input.userId, "User id");
  const config = resolveStripeBillingConfig(dependencies.config);
  const stripeClient = dependencies.stripeClient ?? getStripeClient();
  const prismaClient = dependencies.prismaClient ?? prisma;
  const selection = resolveCheckoutPlanSelection(input, config);
  let billingCustomer = await getOrCreateOrganizationBillingCustomer(
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
  const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
    metadata: {
      organizationId,
      requestedByUserId: userId,
      planCode: selection.planCode,
    },
  };
  const trialEnd = toStripeTrialEndTimestamp(input.trialEnd);

  if (trialEnd) {
    subscriptionData.trial_end = trialEnd;
  }

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      price: selection.priceId,
      quantity: 1,
    },
  ];

  if (selection.meteredPriceId) {
    lineItems.push({
      price: selection.meteredPriceId,
    });
  }

  const createSession = () =>
    stripeClient.checkout.sessions.create({
      mode: "subscription",
      customer: billingCustomer.stripeCustomerId,
      client_reference_id: organizationId,
      success_url: config.checkoutSuccessUrl,
      cancel_url: config.checkoutCancelUrl,
      allow_promotion_codes: true,
      line_items: lineItems,
      metadata: {
        organizationId,
        requestedByUserId: userId,
        planCode: selection.planCode,
      },
      subscription_data: subscriptionData,
    });

  let session: Awaited<ReturnType<typeof createSession>>;

  try {
    session = await createSession();
  } catch (error) {
    if (!isStripeCustomerMissingError(error)) {
      throw error;
    }

    billingCustomer = await replaceOrganizationBillingCustomer(
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
    session = await createSession();
  }

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
    config?: StripeBillingRuntimeConfig;
  } = {}
): Promise<BillingPortalSessionResult> {
  const organizationId = normalizeRequiredString(
    input.organizationId,
    "Organization id"
  );
  const prismaClient = dependencies.prismaClient ?? prisma;
  const billingCustomer = await getOrganizationBillingCustomer(
    organizationId,
    prismaClient
  );

  if (!billingCustomer) {
    throw new BillingCheckoutError(
      "Billing portal is unavailable because this workspace does not have a billing customer yet. Start a subscription first.",
      404
    );
  }

  const config = resolveStripeBillingConfig(dependencies.config);
  const stripeClient = dependencies.stripeClient ?? getStripeClient();
  let session: Awaited<
    ReturnType<typeof stripeClient.billingPortal.sessions.create>
  >;

  try {
    session = await stripeClient.billingPortal.sessions.create({
      customer: billingCustomer.stripeCustomerId,
      return_url: config.portalReturnUrl,
    });
  } catch (error) {
    if (!isStripeCustomerMissingError(error)) {
      throw error;
    }

    throw new BillingCheckoutError(
      "Billing portal is unavailable because this workspace does not have a valid Stripe customer yet. Start a subscription first.",
      404
    );
  }

  return {
    url: session.url,
    organizationId,
    stripeCustomerId: billingCustomer.stripeCustomerId,
  };
}
