import "server-only";

import {
  Prisma,
  SubscriptionStatus,
  type ProductPlan,
} from "@prisma/client";
import Stripe from "stripe";

import { getStripeBillingConfig } from "@/lib/billing/config";
import { getStripeClient } from "@/lib/billing/stripe";
import { prisma } from "@/lib/prisma";

const WEBHOOK_PROCESSING_SENTINEL = "__processing__";

export const supportedStripeWebhookEventTypes = [
  "checkout.session.completed",
  "customer.created",
  "customer.updated",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
] as const;

export type SupportedStripeWebhookEventType =
  (typeof supportedStripeWebhookEventTypes)[number];

type BillingWebhookClient = Pick<
  typeof prisma,
  | "$transaction"
  | "billingCustomer"
  | "subscription"
  | "productPlan"
  | "planPrice"
  | "webhookEvent"
>;

type BillingWebhookTransactionClient = Prisma.TransactionClient;

export type StripeWebhookProcessResult = {
  eventId: string;
  eventType: string;
  organizationId: string | null;
  status: "processed" | "duplicate" | "ignored";
};

export class StripeWebhookSignatureError extends Error {
  readonly status = 400;

  constructor(message: string) {
    super(message);
    this.name = "StripeWebhookSignatureError";
  }
}

function isSupportedStripeWebhookEventType(
  value: string
): value is SupportedStripeWebhookEventType {
  return (
    supportedStripeWebhookEventTypes as readonly string[]
  ).includes(value);
}

function isPrismaUniqueConstraintError(error: unknown) {
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

function serializeForJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function normalizeMetadata(
  metadata: Stripe.Metadata | Record<string, string> | null | undefined
) {
  if (!metadata) {
    return undefined;
  }

  const entries = Object.entries(metadata).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string"
  );

  if (!entries.length) {
    return undefined;
  }

  return Object.fromEntries(entries);
}

function getMetadataOrganizationId(
  metadata: Stripe.Metadata | Record<string, string> | null | undefined
) {
  const organizationId = metadata?.organizationId?.trim();
  return organizationId ? organizationId : null;
}

function getExpandableId(value: string | Stripe.Customer | Stripe.DeletedCustomer | null) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  return value.id;
}

function getCustomerFromSubscription(subscription: Stripe.Subscription) {
  if (!subscription.customer || typeof subscription.customer === "string") {
    return null;
  }

  if ("deleted" in subscription.customer && subscription.customer.deleted) {
    return null;
  }

  return subscription.customer;
}

function getCustomerEmailFromCheckoutSession(session: Stripe.Checkout.Session) {
  return session.customer_details?.email?.trim() || null;
}

function getCustomerNameFromCheckoutSession(session: Stripe.Checkout.Session) {
  return session.customer_details?.name?.trim() || null;
}

function fromUnixTimestamp(value: number | null | undefined) {
  return typeof value === "number" ? new Date(value * 1000) : null;
}

function mapSubscriptionStatus(
  status: Stripe.Subscription.Status
): SubscriptionStatus {
  switch (status) {
    case "incomplete":
      return SubscriptionStatus.INCOMPLETE;
    case "incomplete_expired":
      return SubscriptionStatus.INCOMPLETE_EXPIRED;
    case "trialing":
      return SubscriptionStatus.TRIALING;
    case "active":
      return SubscriptionStatus.ACTIVE;
    case "past_due":
      return SubscriptionStatus.PAST_DUE;
    case "canceled":
      return SubscriptionStatus.CANCELED;
    case "unpaid":
      return SubscriptionStatus.UNPAID;
    case "paused":
      return SubscriptionStatus.PAUSED;
  }
}

function selectPrimarySubscriptionItem(subscription: Stripe.Subscription) {
  return (
    subscription.items.data.find(
      (item) => item.price.recurring?.usage_type === "licensed"
    ) ??
    subscription.items.data[0] ??
    null
  );
}

async function findOrganizationIdForStripeCustomer(
  stripeCustomerId: string | null,
  client: BillingWebhookClient | BillingWebhookTransactionClient
) {
  if (!stripeCustomerId) {
    return null;
  }

  const record = await client.billingCustomer.findUnique({
    where: {
      stripeCustomerId,
    },
    select: {
      organizationId: true,
    },
  });

  return record?.organizationId ?? null;
}

async function upsertBillingCustomerRecord(
  input: {
    organizationId?: string | null;
    stripeCustomerId: string;
    email?: string | null;
    name?: string | null;
    metadata?: Stripe.Metadata | Record<string, string> | null;
  },
  client: BillingWebhookClient | BillingWebhookTransactionClient
) {
  const existingByStripeId = await client.billingCustomer.findUnique({
    where: {
      stripeCustomerId: input.stripeCustomerId,
    },
    select: {
      id: true,
      organizationId: true,
    },
  });

  const resolvedOrganizationId =
    input.organizationId?.trim() ||
    existingByStripeId?.organizationId ||
    null;

  if (existingByStripeId) {
    return client.billingCustomer.update({
      where: {
        stripeCustomerId: input.stripeCustomerId,
      },
      data: {
        organizationId: resolvedOrganizationId ?? existingByStripeId.organizationId,
        email: input.email ?? null,
        name: input.name ?? null,
        ...(normalizeMetadata(input.metadata)
          ? { metadata: normalizeMetadata(input.metadata) }
          : {}),
      },
      select: {
        id: true,
        organizationId: true,
        stripeCustomerId: true,
      },
    });
  }

  if (!resolvedOrganizationId) {
    return null;
  }

  return client.billingCustomer.upsert({
    where: {
      organizationId: resolvedOrganizationId,
    },
    update: {
      stripeCustomerId: input.stripeCustomerId,
      email: input.email ?? null,
      name: input.name ?? null,
      ...(normalizeMetadata(input.metadata)
        ? { metadata: normalizeMetadata(input.metadata) }
        : {}),
    },
    create: {
      organizationId: resolvedOrganizationId,
      stripeCustomerId: input.stripeCustomerId,
      email: input.email ?? null,
      name: input.name ?? null,
      ...(normalizeMetadata(input.metadata)
        ? { metadata: normalizeMetadata(input.metadata) }
        : {}),
    },
    select: {
      id: true,
      organizationId: true,
      stripeCustomerId: true,
    },
  });
}

async function syncStripeCustomer(
  customer: Stripe.Customer,
  client: BillingWebhookClient | BillingWebhookTransactionClient
) {
  const organizationId =
    getMetadataOrganizationId(customer.metadata) ??
    (await findOrganizationIdForStripeCustomer(customer.id, client));

  const record = await upsertBillingCustomerRecord(
    {
      organizationId,
      stripeCustomerId: customer.id,
      email: customer.email ?? null,
      name: customer.name ?? null,
      metadata: customer.metadata,
    },
    client
  );

  return record?.organizationId ?? organizationId ?? null;
}

async function resolveCatalogReferences(
  subscription: Stripe.Subscription,
  client: BillingWebhookClient | BillingWebhookTransactionClient
) {
  const primaryItem = selectPrimarySubscriptionItem(subscription);
  const stripePriceId = primaryItem?.price.id ?? null;
  const stripeProductId =
    typeof primaryItem?.price.product === "string"
      ? primaryItem.price.product
      : primaryItem?.price.product?.id ?? null;

  const [productPlan, planPrice] = await Promise.all([
    stripeProductId
      ? client.productPlan.findUnique({
          where: {
            stripeProductId,
          },
          select: {
            id: true,
          },
        })
      : Promise.resolve<Pick<ProductPlan, "id"> | null>(null),
    stripePriceId
      ? client.planPrice.findUnique({
          where: {
            stripePriceId,
          },
          select: {
            id: true,
          },
        })
      : Promise.resolve<{ id: string } | null>(null),
  ]);

  return {
    primaryItem,
    productPlanId: productPlan?.id ?? null,
    planPriceId: planPrice?.id ?? null,
  };
}

async function syncStripeSubscription(
  subscription: Stripe.Subscription,
  client: BillingWebhookClient | BillingWebhookTransactionClient,
  preferredOrganizationId?: string | null
) {
  const existingSubscription = await client.subscription.findUnique({
    where: {
      stripeSubscriptionId: subscription.id,
    },
    select: {
      organizationId: true,
    },
  });
  const expandedCustomer = getCustomerFromSubscription(subscription);
  const stripeCustomerId = getExpandableId(subscription.customer);
  const organizationId =
    preferredOrganizationId?.trim() ??
    getMetadataOrganizationId(subscription.metadata) ??
    getMetadataOrganizationId(expandedCustomer?.metadata) ??
    (await findOrganizationIdForStripeCustomer(stripeCustomerId, client)) ??
    existingSubscription?.organizationId ??
    null;

  if (!stripeCustomerId || !organizationId) {
    return organizationId;
  }

  const billingCustomer = await upsertBillingCustomerRecord(
    {
      organizationId,
      stripeCustomerId,
      email: expandedCustomer?.email ?? null,
      name: expandedCustomer?.name ?? null,
      metadata: expandedCustomer?.metadata ?? subscription.metadata,
    },
    client
  );

  if (!billingCustomer) {
    return organizationId;
  }

  const { primaryItem, productPlanId, planPriceId } =
    await resolveCatalogReferences(subscription, client);

  await client.subscription.upsert({
    where: {
      stripeSubscriptionId: subscription.id,
    },
    update: {
      organizationId,
      billingCustomerId: billingCustomer.id,
      productPlanId,
      planPriceId,
      status: mapSubscriptionStatus(subscription.status),
      currencyCode: primaryItem?.price.currency?.toUpperCase() ?? null,
      quantity: primaryItem?.quantity ?? 1,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodStart: fromUnixTimestamp(primaryItem?.current_period_start),
      currentPeriodEnd: fromUnixTimestamp(primaryItem?.current_period_end),
      trialStart: fromUnixTimestamp(subscription.trial_start),
      trialEnd: fromUnixTimestamp(subscription.trial_end),
      canceledAt: fromUnixTimestamp(subscription.canceled_at),
      endedAt: fromUnixTimestamp(subscription.ended_at),
      ...(normalizeMetadata(subscription.metadata)
        ? { metadata: normalizeMetadata(subscription.metadata) }
        : {}),
    },
    create: {
      organizationId,
      billingCustomerId: billingCustomer.id,
      productPlanId,
      planPriceId,
      stripeSubscriptionId: subscription.id,
      status: mapSubscriptionStatus(subscription.status),
      currencyCode: primaryItem?.price.currency?.toUpperCase() ?? null,
      quantity: primaryItem?.quantity ?? 1,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodStart: fromUnixTimestamp(primaryItem?.current_period_start),
      currentPeriodEnd: fromUnixTimestamp(primaryItem?.current_period_end),
      trialStart: fromUnixTimestamp(subscription.trial_start),
      trialEnd: fromUnixTimestamp(subscription.trial_end),
      canceledAt: fromUnixTimestamp(subscription.canceled_at),
      endedAt: fromUnixTimestamp(subscription.ended_at),
      ...(normalizeMetadata(subscription.metadata)
        ? { metadata: normalizeMetadata(subscription.metadata) }
        : {}),
    },
  });

  return organizationId;
}

async function syncCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  client: BillingWebhookClient | BillingWebhookTransactionClient,
  stripeClient: Stripe
) {
  const organizationId =
    getMetadataOrganizationId(session.metadata) ??
    (await findOrganizationIdForStripeCustomer(
      getExpandableId(session.customer),
      client
    ));
  const stripeCustomerId = getExpandableId(session.customer);

  if (stripeCustomerId && organizationId) {
    await upsertBillingCustomerRecord(
      {
        organizationId,
        stripeCustomerId,
        email: getCustomerEmailFromCheckoutSession(session),
        name: getCustomerNameFromCheckoutSession(session),
        metadata: session.metadata ?? undefined,
      },
      client
    );
  }

  if (
    session.mode === "subscription" &&
    typeof session.subscription === "string"
  ) {
    const subscription = await stripeClient.subscriptions.retrieve(
      session.subscription,
      {
        expand: ["customer", "items.data.price.product"],
      }
    );

    return syncStripeSubscription(subscription, client, organizationId);
  }

  return organizationId;
}

async function claimWebhookEvent(
  event: Stripe.Event,
  client: BillingWebhookClient
) {
  try {
    await client.webhookEvent.create({
      data: {
        stripeEventId: event.id,
        source: "stripe",
        eventType: event.type,
        apiVersion: event.api_version ?? null,
        livemode: event.livemode,
        payload: serializeForJson(event),
        processingError: WEBHOOK_PROCESSING_SENTINEL,
      },
    });

    return {
      status: "claimed" as const,
      organizationId: null,
    };
  } catch (error) {
    if (!isPrismaUniqueConstraintError(error)) {
      throw error;
    }

    const existing = await client.webhookEvent.findUnique({
      where: {
        stripeEventId: event.id,
      },
      select: {
        processedAt: true,
        processingError: true,
        organizationId: true,
      },
    });

    if (!existing) {
      throw error;
    }

    if (existing.processedAt || existing.processingError === WEBHOOK_PROCESSING_SENTINEL) {
      return {
        status: "duplicate" as const,
        organizationId: existing.organizationId,
      };
    }

    const claimed = await client.webhookEvent.updateMany({
      where: {
        stripeEventId: event.id,
        processedAt: null,
        processingError: existing.processingError,
      },
      data: {
        processingError: WEBHOOK_PROCESSING_SENTINEL,
      },
    });

    if (!claimed.count) {
      return {
        status: "duplicate" as const,
        organizationId: existing.organizationId,
      };
    }

    return {
      status: "claimed" as const,
      organizationId: existing.organizationId,
    };
  }
}

export function constructStripeWebhookEvent(
  rawBody: string,
  signature: string,
  stripeClient: Stripe = getStripeClient(),
  webhookSecret = getStripeBillingConfig().webhookSecret
) {
  const normalizedSignature = signature.trim();

  if (!normalizedSignature) {
    throw new StripeWebhookSignatureError("Missing Stripe signature.");
  }

  try {
    return stripeClient.webhooks.constructEvent(
      rawBody,
      normalizedSignature,
      webhookSecret
    );
  } catch {
    throw new StripeWebhookSignatureError("Invalid Stripe webhook signature.");
  }
}

export async function processStripeWebhookEvent(
  event: Stripe.Event,
  input: {
    prismaClient?: BillingWebhookClient;
    stripeClient?: Stripe;
  } = {}
): Promise<StripeWebhookProcessResult> {
  const prismaClient = input.prismaClient ?? prisma;
  const stripeClient = input.stripeClient ?? getStripeClient();
  const claim = await claimWebhookEvent(event, prismaClient);

  if (claim.status === "duplicate") {
    return {
      eventId: event.id,
      eventType: event.type,
      organizationId: claim.organizationId,
      status: "duplicate",
    };
  }

  let organizationId = claim.organizationId;
  let status: StripeWebhookProcessResult["status"] = "processed";

  try {
    await prismaClient.$transaction(async (transactionClient) => {
      if (!isSupportedStripeWebhookEventType(event.type)) {
        status = "ignored";
      } else {
        switch (event.type) {
          case "customer.created":
          case "customer.updated":
            organizationId = await syncStripeCustomer(
              event.data.object as Stripe.Customer,
              transactionClient
            );
            break;
          case "checkout.session.completed":
            organizationId = await syncCheckoutSessionCompleted(
              event.data.object as Stripe.Checkout.Session,
              transactionClient,
              stripeClient
            );
            break;
          case "customer.subscription.created":
          case "customer.subscription.updated":
          case "customer.subscription.deleted":
            organizationId = await syncStripeSubscription(
              event.data.object as Stripe.Subscription,
              transactionClient
            );
            break;
        }
      }

      await transactionClient.webhookEvent.update({
        where: {
          stripeEventId: event.id,
        },
        data: {
          organizationId,
          processedAt: new Date(),
          processingError: null,
        },
      });
    });
  } catch (error) {
    await prismaClient.webhookEvent.update({
      where: {
        stripeEventId: event.id,
      },
      data: {
        organizationId,
        processedAt: null,
        processingError:
          error instanceof Error
            ? error.message
            : "Stripe webhook processing failed.",
      },
    });

    throw error;
  }

  return {
    eventId: event.id,
    eventType: event.type,
    organizationId,
    status,
  };
}
