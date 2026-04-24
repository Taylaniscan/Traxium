import type { OrganizationAccessStateResult } from "@/lib/billing/types";

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
            value: "Start paid subscription",
            detail: "Convert the workspace before the trial window closes so access continues uninterrupted.",
          }
        : {
            value: "Ask an admin to start billing",
            detail: "Workspace owners or admins should launch paid checkout before the trial ends.",
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
