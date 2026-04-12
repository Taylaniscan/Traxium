import { SubscriptionStatus } from "@prisma/client";

import { isStripeBillingConfigured } from "@/lib/billing/config";
import { prisma } from "@/lib/prisma";
import { resolveAppEnvironment } from "@/lib/env";
import type {
  OrganizationAccessPlanMetadata,
  OrganizationAccessReasonCode,
  OrganizationAccessState,
  OrganizationAccessStateResult,
  OrganizationAccessSubscriptionRecord,
} from "@/lib/billing/types";

export const organizationAccessSubscriptionSelect = {
  id: true,
  organizationId: true,
  billingCustomerId: true,
  productPlanId: true,
  planPriceId: true,
  stripeSubscriptionId: true,
  status: true,
  currencyCode: true,
  quantity: true,
  cancelAtPeriodEnd: true,
  currentPeriodStart: true,
  currentPeriodEnd: true,
  trialStart: true,
  trialEnd: true,
  canceledAt: true,
  endedAt: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
  productPlan: {
    select: {
      id: true,
      code: true,
      name: true,
      stripeProductId: true,
      metadata: true,
    },
  },
  planPrice: {
    select: {
      id: true,
      stripePriceId: true,
      type: true,
      interval: true,
      intervalCount: true,
      currencyCode: true,
      unitAmount: true,
      metadata: true,
    },
  },
} as const;

type SubscriptionLookupClient = {
  subscription: {
    findMany(args: {
      where: {
        organizationId: string;
      };
      orderBy: Array<Record<string, "asc" | "desc">>;
      select: typeof organizationAccessSubscriptionSelect;
    }): Promise<OrganizationAccessSubscriptionRecord[]>;
  };
};

type ResolveOrganizationAccessStateInput = {
  organizationId: string;
  subscription: OrganizationAccessSubscriptionRecord | null;
  now?: Date;
};

type BillingEnvSource = Record<string, string | undefined>;

function normalizeRequiredString(value: string, fieldName: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${fieldName} is required.`);
  }

  return normalized;
}

function compareDatesDescending(
  left: Date | null,
  right: Date | null
) {
  const leftTime = left?.getTime() ?? Number.NEGATIVE_INFINITY;
  const rightTime = right?.getTime() ?? Number.NEGATIVE_INFINITY;

  return rightTime - leftTime;
}

function getStatusTieBreaker(status: SubscriptionStatus) {
  switch (status) {
    case SubscriptionStatus.ACTIVE:
      return 80;
    case SubscriptionStatus.TRIALING:
      return 70;
    case SubscriptionStatus.PAST_DUE:
      return 60;
    case SubscriptionStatus.UNPAID:
      return 50;
    case SubscriptionStatus.CANCELED:
      return 40;
    case SubscriptionStatus.PAUSED:
      return 30;
    case SubscriptionStatus.INCOMPLETE:
      return 20;
    case SubscriptionStatus.INCOMPLETE_EXPIRED:
      return 10;
    default:
      return 0;
  }
}

function selectCurrentSubscription(
  subscriptions: readonly OrganizationAccessSubscriptionRecord[]
) {
  if (!subscriptions.length) {
    return null;
  }

  // Webhook sync upserts by Stripe subscription id, so the most recently
  // created subscription row represents the newest billing contract.
  return [...subscriptions].sort((left, right) => {
    return (
      compareDatesDescending(left.createdAt, right.createdAt) ||
      compareDatesDescending(left.updatedAt, right.updatedAt) ||
      compareDatesDescending(left.currentPeriodEnd, right.currentPeriodEnd) ||
      compareDatesDescending(left.trialEnd, right.trialEnd) ||
      getStatusTieBreaker(right.status) - getStatusTieBreaker(left.status) ||
      right.id.localeCompare(left.id)
    );
  })[0];
}

function mapPlanMetadata(
  subscription: OrganizationAccessSubscriptionRecord
): OrganizationAccessPlanMetadata | null {
  if (
    !subscription.productPlan &&
    !subscription.planPrice &&
    !subscription.productPlanId &&
    !subscription.planPriceId
  ) {
    return null;
  }

  return {
    productPlanId: subscription.productPlanId,
    planCode: subscription.productPlan?.code ?? null,
    planName: subscription.productPlan?.name ?? null,
    stripeProductId: subscription.productPlan?.stripeProductId ?? null,
    planMetadata: subscription.productPlan?.metadata ?? null,
    planPriceId: subscription.planPriceId,
    stripePriceId: subscription.planPrice?.stripePriceId ?? null,
    priceType: subscription.planPrice?.type ?? null,
    billingInterval: subscription.planPrice?.interval ?? null,
    intervalCount: subscription.planPrice?.intervalCount ?? null,
    currencyCode:
      subscription.planPrice?.currencyCode ?? subscription.currencyCode ?? null,
    unitAmount: subscription.planPrice?.unitAmount ?? null,
    priceMetadata: subscription.planPrice?.metadata ?? null,
  };
}

function resolveAccessPolicy(
  subscription: OrganizationAccessSubscriptionRecord,
  now: Date
): Pick<
  OrganizationAccessStateResult,
  "accessState" | "isBlocked" | "reasonCode"
> {
  const isPastDueGracePeriod =
    subscription.status === SubscriptionStatus.PAST_DUE &&
    subscription.currentPeriodEnd !== null &&
    subscription.currentPeriodEnd.getTime() > now.getTime();

  if (isPastDueGracePeriod) {
    return {
      accessState: "grace_period",
      isBlocked: false,
      reasonCode: "past_due_grace_period",
    };
  }

  switch (subscription.status) {
    case SubscriptionStatus.ACTIVE:
      return {
        accessState: "active",
        isBlocked: false,
        reasonCode: "active",
      };
    case SubscriptionStatus.TRIALING:
      return {
        accessState: "trialing",
        isBlocked: false,
        reasonCode: "trialing",
      };
    case SubscriptionStatus.PAST_DUE:
      return {
        accessState: "blocked_past_due",
        isBlocked: true,
        reasonCode: "past_due_blocked",
      };
    case SubscriptionStatus.UNPAID:
      return {
        accessState: "blocked_unpaid",
        isBlocked: true,
        reasonCode: "unpaid",
      };
    case SubscriptionStatus.CANCELED:
      return {
        accessState: "blocked_canceled",
        isBlocked: true,
        reasonCode: "canceled",
      };
    case SubscriptionStatus.PAUSED:
      return {
        accessState: "blocked_canceled",
        isBlocked: true,
        reasonCode: "paused",
      };
    case SubscriptionStatus.INCOMPLETE:
      return {
        accessState: "no_subscription",
        isBlocked: true,
        reasonCode: "incomplete",
      };
    case SubscriptionStatus.INCOMPLETE_EXPIRED:
      return {
        accessState: "no_subscription",
        isBlocked: true,
        reasonCode: "incomplete_expired",
      };
    default:
      return {
        accessState: "blocked_canceled",
        isBlocked: true,
        reasonCode: "unknown",
      };
  }
}

export function resolveOrganizationAccessState(
  input: ResolveOrganizationAccessStateInput
): OrganizationAccessStateResult {
  const organizationId = normalizeRequiredString(
    input.organizationId,
    "Organization id"
  );
  const now = input.now ?? new Date();

  if (!input.subscription) {
    return {
      organizationId,
      subscriptionId: null,
      stripeSubscriptionId: null,
      rawSubscriptionStatus: null,
      accessState: "no_subscription",
      isBlocked: true,
      reasonCode: "no_subscription",
      currentPeriodEnd: null,
      plan: null,
    };
  }

  const policy = resolveAccessPolicy(input.subscription, now);

  return {
    organizationId,
    subscriptionId: input.subscription.id,
    stripeSubscriptionId: input.subscription.stripeSubscriptionId,
    rawSubscriptionStatus: input.subscription.status,
    accessState: policy.accessState,
    isBlocked: policy.isBlocked,
    reasonCode: policy.reasonCode,
    currentPeriodEnd: input.subscription.currentPeriodEnd,
    plan: mapPlanMetadata(input.subscription),
  };
}

export async function getOrganizationSubscriptionState(
  organizationId: string,
  dependencies: {
    envSource?: BillingEnvSource;
    prismaClient?: SubscriptionLookupClient;
    now?: Date;
  } = {}
) {
  const normalizedOrganizationId = normalizeRequiredString(
    organizationId,
    "Organization id"
  );
  const envSource = dependencies.envSource ?? process.env;

  if (
    resolveAppEnvironment(envSource) === "development" &&
    !isStripeBillingConfigured(envSource)
  ) {
    console.info(
      JSON.stringify({
        event: "billing.access.fail_open",
        appEnvironment: "development",
        organizationId: normalizedOrganizationId,
        reason: "stripe_billing_unconfigured",
      })
    );

    return {
      organizationId: normalizedOrganizationId,
      subscriptionId: null,
      stripeSubscriptionId: null,
      rawSubscriptionStatus: null,
      accessState: "active" as const,
      isBlocked: false,
      reasonCode: "active" as const,
      currentPeriodEnd: null,
      plan: null,
    };
  }

  const prismaClient =
    dependencies.prismaClient ?? (prisma as unknown as SubscriptionLookupClient);
  const subscriptions = await prismaClient.subscription.findMany({
    where: {
      organizationId: normalizedOrganizationId,
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
    select: organizationAccessSubscriptionSelect,
  });

  return resolveOrganizationAccessState({
    organizationId: normalizedOrganizationId,
    subscription: selectCurrentSubscription(subscriptions),
    now: dependencies.now,
  });
}

export const getOrganizationAccessState = getOrganizationSubscriptionState;

export function isOrganizationAccessBlocked(
  accessState: Pick<OrganizationAccessStateResult, "isBlocked">
) {
  return accessState.isBlocked;
}

export type {
  OrganizationAccessPlanMetadata,
  OrganizationAccessReasonCode,
  OrganizationAccessState,
  OrganizationAccessStateResult,
  OrganizationAccessSubscriptionRecord,
};
