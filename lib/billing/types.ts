import {
  BillingInterval,
  PriceType,
  SubscriptionStatus,
} from "@prisma/client";

export const organizationAccessStates = [
  "active",
  "trialing",
  "trial_expired",
  "grace_period",
  "blocked_unpaid",
  "blocked_past_due",
  "blocked_canceled",
  "no_subscription",
] as const;

export type OrganizationAccessState = (typeof organizationAccessStates)[number];

export const organizationAccessReasonCodes = [
  "active",
  "trialing",
  "workspace_trial",
  "trial_expired",
  "past_due_grace_period",
  "past_due_blocked",
  "unpaid",
  "canceled",
  "paused",
  "incomplete",
  "incomplete_expired",
  "no_subscription",
  "unknown",
] as const;

export type OrganizationAccessReasonCode =
  (typeof organizationAccessReasonCodes)[number];

export type OrganizationAccessTrialSource = "subscription" | "workspace";

export type OrganizationAccessPlanMetadata = {
  productPlanId: string | null;
  planCode: string | null;
  planName: string | null;
  stripeProductId: string | null;
  planMetadata: unknown | null;
  planPriceId: string | null;
  stripePriceId: string | null;
  priceType: PriceType | null;
  billingInterval: BillingInterval | null;
  intervalCount: number | null;
  currencyCode: string | null;
  unitAmount: number | null;
  priceMetadata: unknown | null;
};

export type OrganizationAccessSubscriptionRecord = {
  id: string;
  organizationId: string;
  billingCustomerId: string;
  productPlanId: string | null;
  planPriceId: string | null;
  stripeSubscriptionId: string;
  status: SubscriptionStatus;
  currencyCode: string | null;
  quantity: number;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  trialStart: Date | null;
  trialEnd: Date | null;
  canceledAt: Date | null;
  endedAt: Date | null;
  metadata: unknown | null;
  createdAt: Date;
  updatedAt: Date;
  productPlan: null | {
    id: string;
    code: string;
    name: string;
    stripeProductId: string | null;
    metadata: unknown | null;
  };
  planPrice: null | {
    id: string;
    stripePriceId: string | null;
    type: PriceType;
    interval: BillingInterval;
    intervalCount: number;
    currencyCode: string;
    unitAmount: number;
    metadata: unknown | null;
  };
};

export type OrganizationAccessWorkspaceRecord = {
  id: string;
  workspaceTrialEndsAt: Date | null;
};

export type OrganizationAccessStateResult = {
  organizationId: string;
  subscriptionId: string | null;
  stripeSubscriptionId: string | null;
  rawSubscriptionStatus: SubscriptionStatus | string | null;
  accessState: OrganizationAccessState;
  isBlocked: boolean;
  reasonCode: OrganizationAccessReasonCode;
  currentPeriodEnd: Date | null;
  trialEndsAt: Date | null;
  trialSource: OrganizationAccessTrialSource | null;
  plan: OrganizationAccessPlanMetadata | null;
};
