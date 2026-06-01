import type { OrganizationAccessStateResult } from "@/lib/billing/types";

export type BillingRecoveryIntent =
  | "open_billing_portal"
  | "resume_subscription"
  | "update_payment_method";

export type BillingCommercialHighlight = {
  label: string;
  value: string;
};

export type BillingCommercialSummary = {
  currentPlan: {
    value: string;
    detail: string;
  };
  trialState: {
    value: string;
    detail: string;
  };
  accessState: {
    value: string;
    detail: string;
  };
  nextAction: {
    value: string;
    detail: string;
  };
  highlights: BillingCommercialHighlight[];
};

export type BillingWorkspacePresentation = {
  statusLabel: string;
  statusTone:
    | "amber"
    | "blue"
    | "emerald"
    | "orange"
    | "rose"
    | "slate";
  planLabel: string;
  planDetail: string;
  billingStateLabel: string;
  stateDescription: string;
  currentPeriodEndLabel: string;
  trialEndLabel: string;
  recommendedIntent: BillingRecoveryIntent;
  recommendedActionLabel: string;
  recommendedActionDetail: string;
};

function humanizeToken(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return value
    .split(/[_-]+/u)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function formatDateLabel(value: Date | null) {
  if (!value) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

function formatMoney(accessState: OrganizationAccessStateResult) {
  const currencyCode = accessState.plan?.currencyCode?.toUpperCase() ?? null;
  const unitAmount = accessState.plan?.unitAmount ?? null;

  if (!currencyCode || unitAmount === null) {
    return null;
  }

  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: currencyCode,
  }).format(unitAmount / 100);
}

function getPlanLabel(accessState: OrganizationAccessStateResult) {
  const planName = accessState.plan?.planName?.trim() ?? "";

  if (planName) {
    return planName;
  }

  const planCode = humanizeToken(accessState.plan?.planCode ?? null);
  return planCode || "No paid plan yet";
}

function getPlanDetail(accessState: OrganizationAccessStateResult) {
  if (!accessState.plan) {
    return accessState.trialSource === "workspace"
      ? "The workspace is still using trial access before a paid subscription is started."
      : "No paid subscription metadata is synced for this workspace yet.";
  }

  const moneyLabel = formatMoney(accessState);
  const intervalLabel = accessState.plan.billingInterval
    ? humanizeToken(accessState.plan.billingInterval)
    : "";
  const cadence = moneyLabel && intervalLabel
    ? `${moneyLabel} per ${intervalLabel.toLowerCase()}`
    : moneyLabel ?? intervalLabel;

  return cadence || "Commercial plan metadata is available, but price details are not synced.";
}

function getTrialStateSummary(
  accessState: OrganizationAccessStateResult,
  now: Date
) {
  if (!accessState.trialEndsAt) {
    return {
      value: "No active trial",
      detail: "This workspace is currently operating outside a trial window.",
    };
  }

  const msRemaining = accessState.trialEndsAt.getTime() - now.getTime();
  const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
  const sourceLabel =
    accessState.trialSource === "subscription" ? "Subscription trial" : "Workspace trial";

  if (accessState.reasonCode === "trial_expired" || msRemaining <= 0) {
    return {
      value: "Expired",
      detail: `${sourceLabel} ended on ${formatDateLabel(accessState.trialEndsAt)}.`,
    };
  }

  return {
    value: `${sourceLabel} active`,
    detail: `${Math.max(daysRemaining, 1)} day${daysRemaining === 1 ? "" : "s"} remaining, until ${formatDateLabel(accessState.trialEndsAt)}.`,
  };
}

function getAccessStateSummary(accessState: OrganizationAccessStateResult) {
  switch (accessState.reasonCode) {
    case "workspace_trial":
      return {
        value: "Allowed during workspace trial",
        detail: "Protected routes stay open because the workspace trial is still valid.",
      };
    case "trialing":
      return {
        value: "Allowed during subscription trial",
        detail: "Access is tied to an active Stripe subscription trial.",
      };
    case "active":
      return {
        value: "Allowed",
        detail: "The workspace has active paid billing access.",
      };
    case "past_due_grace_period":
      return {
        value: "Allowed in grace period",
        detail: "Access is still open temporarily while billing is past due.",
      };
    case "past_due_blocked":
      return {
        value: "Blocked",
        detail: "Access is paused because the grace period has ended with a past-due subscription.",
      };
    case "unpaid":
      return {
        value: "Blocked",
        detail: "Access is paused because the latest subscription payment did not complete.",
      };
    case "canceled":
      return {
        value: "Blocked",
        detail: "Access is paused because the subscription was canceled.",
      };
    case "paused":
      return {
        value: "Blocked",
        detail: "Access is paused because the subscription is paused.",
      };
    case "trial_expired":
      return {
        value: "Blocked",
        detail: "The workspace trial has ended and there is no paid subscription yet.",
      };
    case "incomplete":
    case "incomplete_expired":
    case "no_subscription":
      return {
        value: "Blocked",
        detail: "The workspace still needs an active subscription before protected product access can continue.",
      };
    case "unknown":
      return {
        value: "Needs review",
        detail: "Billing could not be verified safely, so admin review is required.",
      };
  }
}

function getRecommendedActionSummary(
  accessState: OrganizationAccessStateResult,
  canManageBilling: boolean
) {
  switch (accessState.reasonCode) {
    case "workspace_trial":
      return canManageBilling
        ? {
            value: "Connect Stripe trial",
            detail: "Select a plan in Stripe Checkout while keeping the remaining workspace trial before paid billing starts.",
          }
        : {
            value: "Trial active",
            detail: "Workspace owners or admins can connect Stripe billing while the trial remains active.",
          };
    case "trialing":
      return canManageBilling
        ? {
            value: "Prepare trial conversion",
            detail: "Confirm the paid plan is correct before the Stripe subscription trial ends.",
          }
        : {
            value: "Monitor with your admin",
            detail: "Coordinate with a workspace admin so the subscription converts cleanly.",
          };
    case "active":
      return canManageBilling
        ? {
            value: "No immediate action",
            detail: "Review billing only when plan, payment method, or workspace needs change.",
          }
        : {
            value: "No action required",
            detail: "Billing access is active and no recovery step is needed.",
          };
    case "past_due_grace_period":
      return canManageBilling
        ? {
            value: "Update payment method",
            detail: "Resolve the billing issue before the grace period ends and access is blocked.",
          }
        : {
            value: "Notify an admin",
            detail: "A workspace owner or admin should resolve billing before access is interrupted.",
          };
    case "past_due_blocked":
    case "unpaid":
      return canManageBilling
        ? {
            value: "Resolve payment failure",
            detail: "Open the billing portal or update the payment method in Stripe, then refresh access.",
          }
        : {
            value: "Contact an admin",
            detail: "Billing recovery is restricted to workspace owners and admins.",
          };
    case "canceled":
    case "paused":
      return canManageBilling
        ? {
            value: "Reactivate subscription",
            detail: "Resume paid billing in Stripe to reopen workspace access.",
          }
        : {
            value: "Contact an admin",
            detail: "A workspace owner or admin needs to reactivate billing.",
          };
    case "trial_expired":
    case "incomplete":
    case "incomplete_expired":
    case "no_subscription":
      return canManageBilling
        ? {
            value: "Complete billing setup",
            detail: "Start checkout and activate a paid subscription for this workspace.",
          }
        : {
            value: "Ask an admin to finish billing",
            detail: "Workspace owners or admins need to complete subscription setup.",
          };
    case "unknown":
      return canManageBilling
        ? {
            value: "Review Stripe billing",
            detail: "Confirm the subscription state in Stripe and refresh access after it is corrected.",
          }
        : {
            value: "Ask an admin to review billing",
            detail: "Billing needs admin review before access can be restored.",
          };
  }
}

export function getRecommendedBillingRecoveryIntent(
  accessState: OrganizationAccessStateResult
): BillingRecoveryIntent {
  switch (accessState.reasonCode) {
    case "trial_expired":
    case "incomplete":
    case "incomplete_expired":
    case "no_subscription":
      return "resume_subscription";
    case "past_due_grace_period":
    case "past_due_blocked":
    case "unpaid":
      return "update_payment_method";
    default:
      return "open_billing_portal";
  }
}

function readMetadataRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function formatScalar(value: string | number | boolean) {
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return String(value);
}

function getMetadataHighlight(
  metadata: Record<string, unknown> | null,
  keys: readonly string[],
  label: string
) {
  if (!metadata) {
    return null;
  }

  for (const key of keys) {
    const rawValue = metadata[key];

    if (
      typeof rawValue === "string" ||
      typeof rawValue === "number" ||
      typeof rawValue === "boolean"
    ) {
      return {
        label,
        value: formatScalar(rawValue),
      };
    }
  }

  return null;
}

function getCommercialHighlights(accessState: OrganizationAccessStateResult) {
  const highlights: BillingCommercialHighlight[] = [];

  if (accessState.plan?.priceType) {
    highlights.push({
      label: "Billing model",
      value: humanizeToken(accessState.plan.priceType),
    });
  }

  if (accessState.plan?.billingInterval) {
    const interval = humanizeToken(accessState.plan.billingInterval);
    const count = accessState.plan.intervalCount ?? 1;
    highlights.push({
      label: "Renewal cadence",
      value: count > 1 ? `Every ${count} ${interval.toLowerCase()}s` : interval,
    });
  }

  if (accessState.currentPeriodEnd) {
    highlights.push({
      label: "Current period ends",
      value: formatDateLabel(accessState.currentPeriodEnd),
    });
  }

  const planMetadata = readMetadataRecord(accessState.plan?.planMetadata ?? null);
  const priceMetadata = readMetadataRecord(accessState.plan?.priceMetadata ?? null);
  const metadataSources = [planMetadata, priceMetadata];
  const highlightSpecs = [
    {
      keys: ["seatsIncluded", "includedSeats", "seatLimit", "maxSeats", "maxMembers"],
      label: "Included seats",
    },
    {
      keys: ["savingCardLimit", "maxSavingCards"],
      label: "Saving card limit",
    },
    {
      keys: ["evidenceUploadsLimit", "uploadLimit"],
      label: "Evidence upload limit",
    },
    {
      keys: ["apiRequestsLimit", "requestLimit"],
      label: "API request limit",
    },
  ] as const;

  for (const spec of highlightSpecs) {
    const highlight = metadataSources
      .map((metadata) => getMetadataHighlight(metadata, spec.keys, spec.label))
      .find(Boolean);

    if (highlight) {
      highlights.push(highlight);
    }
  }

  return highlights.slice(0, 4);
}

export function getBillingCommercialSummary(
  accessState: OrganizationAccessStateResult,
  canManageBilling: boolean,
  now: Date = new Date()
): BillingCommercialSummary {
  return {
    currentPlan: {
      value: getPlanLabel(accessState),
      detail: getPlanDetail(accessState),
    },
    trialState: getTrialStateSummary(accessState, now),
    accessState: getAccessStateSummary(accessState),
    nextAction: getRecommendedActionSummary(accessState, canManageBilling),
    highlights: getCommercialHighlights(accessState),
  };
}

export function getBillingWorkspacePresentation(
  accessState: OrganizationAccessStateResult,
  canManageBilling: boolean,
  now: Date = new Date()
): BillingWorkspacePresentation {
  const accessSummary = getAccessStateSummary(accessState);
  const actionSummary = getRecommendedActionSummary(accessState, canManageBilling);
  const recommendedIntent = getRecommendedBillingRecoveryIntent(accessState);

  switch (accessState.reasonCode) {
    case "workspace_trial":
      return {
        statusLabel: "Trial active",
        statusTone: "blue",
        planLabel: getPlanLabel(accessState),
        planDetail: getPlanDetail(accessState),
        billingStateLabel: "Workspace trial",
        stateDescription:
          "The workspace has full access during its 14-day trial window. Stripe Checkout can connect the tenant to a plan while preserving the remaining trial.",
        currentPeriodEndLabel: formatDateLabel(accessState.currentPeriodEnd),
        trialEndLabel: formatDateLabel(accessState.trialEndsAt),
        recommendedIntent,
        recommendedActionLabel: actionSummary.value,
        recommendedActionDetail: actionSummary.detail,
      };
    case "trialing":
      return {
        statusLabel: "Trialing",
        statusTone: "blue",
        planLabel: getPlanLabel(accessState),
        planDetail: getPlanDetail(accessState),
        billingStateLabel: "Subscription trial",
        stateDescription:
          "Stripe billing is active and the subscription is currently in its trial period.",
        currentPeriodEndLabel: formatDateLabel(accessState.currentPeriodEnd),
        trialEndLabel: formatDateLabel(accessState.trialEndsAt),
        recommendedIntent,
        recommendedActionLabel: actionSummary.value,
        recommendedActionDetail: actionSummary.detail,
      };
    case "active":
      return {
        statusLabel: "Active",
        statusTone: "emerald",
        planLabel: getPlanLabel(accessState),
        planDetail: getPlanDetail(accessState),
        billingStateLabel: "Active billing access",
        stateDescription: "Your workspace has active billing access.",
        currentPeriodEndLabel: formatDateLabel(accessState.currentPeriodEnd),
        trialEndLabel: formatDateLabel(accessState.trialEndsAt),
        recommendedIntent,
        recommendedActionLabel: actionSummary.value,
        recommendedActionDetail: actionSummary.detail,
      };
    case "past_due_grace_period":
      return {
        statusLabel: "Past due",
        statusTone: "orange",
        planLabel: getPlanLabel(accessState),
        planDetail: getPlanDetail(accessState),
        billingStateLabel: "Grace period",
        stateDescription:
          "Billing is past due, but the workspace remains open during the grace period. Update payment method or settle the invoice in Stripe.",
        currentPeriodEndLabel: formatDateLabel(accessState.currentPeriodEnd),
        trialEndLabel: formatDateLabel(accessState.trialEndsAt),
        recommendedIntent,
        recommendedActionLabel: actionSummary.value,
        recommendedActionDetail: actionSummary.detail,
      };
    case "past_due_blocked":
      return {
        statusLabel: "Past due",
        statusTone: "rose",
        planLabel: getPlanLabel(accessState),
        planDetail: getPlanDetail(accessState),
        billingStateLabel: "Blocked past due",
        stateDescription:
          "The past-due grace period has ended. Update payment method or settle the invoice in Stripe to restore access.",
        currentPeriodEndLabel: formatDateLabel(accessState.currentPeriodEnd),
        trialEndLabel: formatDateLabel(accessState.trialEndsAt),
        recommendedIntent,
        recommendedActionLabel: actionSummary.value,
        recommendedActionDetail: actionSummary.detail,
      };
    case "unpaid":
      return {
        statusLabel: "Unpaid",
        statusTone: "rose",
        planLabel: getPlanLabel(accessState),
        planDetail: getPlanDetail(accessState),
        billingStateLabel: "Payment failed",
        stateDescription:
          "Payment failed. Open billing recovery to update payment details or retry collection.",
        currentPeriodEndLabel: formatDateLabel(accessState.currentPeriodEnd),
        trialEndLabel: formatDateLabel(accessState.trialEndsAt),
        recommendedIntent,
        recommendedActionLabel: actionSummary.value,
        recommendedActionDetail: actionSummary.detail,
      };
    case "canceled":
      return {
        statusLabel: "Canceled",
        statusTone: "rose",
        planLabel: getPlanLabel(accessState),
        planDetail: getPlanDetail(accessState),
        billingStateLabel: "Subscription canceled",
        stateDescription:
          "Reactivate the subscription in Stripe or start a new checkout to restore workspace billing.",
        currentPeriodEndLabel: formatDateLabel(accessState.currentPeriodEnd),
        trialEndLabel: formatDateLabel(accessState.trialEndsAt),
        recommendedIntent,
        recommendedActionLabel: actionSummary.value,
        recommendedActionDetail: actionSummary.detail,
      };
    case "paused":
      return {
        statusLabel: "Paused",
        statusTone: "orange",
        planLabel: getPlanLabel(accessState),
        planDetail: getPlanDetail(accessState),
        billingStateLabel: "Subscription paused",
        stateDescription:
          "The subscription is paused. Resume billing in Stripe to restore normal workspace access.",
        currentPeriodEndLabel: formatDateLabel(accessState.currentPeriodEnd),
        trialEndLabel: formatDateLabel(accessState.trialEndsAt),
        recommendedIntent,
        recommendedActionLabel: actionSummary.value,
        recommendedActionDetail: actionSummary.detail,
      };
    case "trial_expired":
      return {
        statusLabel: "Trial expired",
        statusTone: "amber",
        planLabel: getPlanLabel(accessState),
        planDetail: getPlanDetail(accessState),
        billingStateLabel: "Subscription required",
        stateDescription:
          "The workspace trial has ended. Start a paid subscription to restore access.",
        currentPeriodEndLabel: formatDateLabel(accessState.currentPeriodEnd),
        trialEndLabel: formatDateLabel(accessState.trialEndsAt),
        recommendedIntent,
        recommendedActionLabel: actionSummary.value,
        recommendedActionDetail: actionSummary.detail,
      };
    case "incomplete":
    case "incomplete_expired":
    case "no_subscription":
      return {
        statusLabel: "Subscription required",
        statusTone: "amber",
        planLabel: getPlanLabel(accessState),
        planDetail: getPlanDetail(accessState),
        billingStateLabel: "No usable subscription",
        stateDescription:
          "Start workspace subscription checkout to activate paid billing for this workspace.",
        currentPeriodEndLabel: formatDateLabel(accessState.currentPeriodEnd),
        trialEndLabel: formatDateLabel(accessState.trialEndsAt),
        recommendedIntent,
        recommendedActionLabel: actionSummary.value,
        recommendedActionDetail: actionSummary.detail,
      };
    case "unknown":
      return {
        statusLabel: "Needs review",
        statusTone: "slate",
        planLabel: getPlanLabel(accessState),
        planDetail: getPlanDetail(accessState),
        billingStateLabel: accessSummary.value,
        stateDescription:
          "Billing state could not be verified safely. Workspace owners and admins should review the Stripe subscription.",
        currentPeriodEndLabel: formatDateLabel(accessState.currentPeriodEnd),
        trialEndLabel: formatDateLabel(accessState.trialEndsAt),
        recommendedIntent,
        recommendedActionLabel: actionSummary.value,
        recommendedActionDetail: actionSummary.detail,
      };
  }
}

export function getUnavailableBillingWorkspacePresentation(
  canManageBilling: boolean
): BillingWorkspacePresentation {
  return {
    statusLabel: "Billing status unavailable",
    statusTone: "slate",
    planLabel: "Plan unavailable",
    planDetail: "Billing status could not be loaded for this workspace.",
    billingStateLabel: "Unknown",
    stateDescription: "Billing status could not be fully verified.",
    currentPeriodEndLabel: "Not scheduled",
    trialEndLabel: "Not scheduled",
    recommendedIntent: "open_billing_portal",
    recommendedActionLabel: canManageBilling
      ? "Review billing"
      : "Contact a workspace admin",
    recommendedActionDetail: canManageBilling
      ? "Open billing recovery so Stripe can determine the next available billing action."
      : "Workspace owners and admins can review billing details and recover access.",
  };
}
