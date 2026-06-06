import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { OrganizationAccessStateResult } from "@/lib/billing/types";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.ComponentProps<"a"> & { href: string }) =>
    React.createElement("a", { href, ...props }, children),
}));

(globalThis as typeof globalThis & { React: typeof React }).React = React;

import { BillingRecoveryForm } from "@/components/billing/billing-recovery-form";
import { WorkspaceBillingSettingsCard } from "@/components/billing/workspace-billing-settings-card";

const activeAccessState: OrganizationAccessStateResult = {
  organizationId: "org-1",
  subscriptionId: "subrec_1",
  stripeSubscriptionId: "sub_1",
  rawSubscriptionStatus: "ACTIVE",
  accessState: "active",
  isBlocked: false,
  reasonCode: "active",
  currentPeriodEnd: new Date("2026-04-20T00:00:00.000Z"),
  trialEndsAt: null,
  trialSource: null,
  plan: {
    productPlanId: "plan_1",
    planCode: "growth",
    planName: "Growth",
    stripeProductId: "prod_1",
    planMetadata: {
      seatsIncluded: 25,
    },
    planPriceId: "price_1",
    stripePriceId: "price_growth",
    priceType: "LICENSED",
    billingInterval: "MONTH",
    intervalCount: 1,
    currencyCode: "usd",
    unitAmount: 29900,
    priceMetadata: null,
  },
};

function createAccessState(
  reasonCode: OrganizationAccessStateResult["reasonCode"],
  overrides: Partial<OrganizationAccessStateResult> = {}
): OrganizationAccessStateResult {
  const blockedReasonCodes = new Set<
    OrganizationAccessStateResult["reasonCode"]
  >([
    "trial_expired",
    "past_due_blocked",
    "unpaid",
    "canceled",
    "paused",
    "incomplete",
    "incomplete_expired",
    "no_subscription",
  ]);
  const accessState =
    reasonCode === "active"
      ? "active"
      : reasonCode === "trialing" || reasonCode === "workspace_trial"
        ? "trialing"
        : reasonCode === "trial_expired"
          ? "trial_expired"
          : reasonCode === "past_due_grace_period"
            ? "grace_period"
            : reasonCode === "past_due_blocked"
              ? "blocked_past_due"
              : reasonCode === "unpaid"
                ? "blocked_unpaid"
                : reasonCode === "no_subscription" ||
                    reasonCode === "incomplete" ||
                    reasonCode === "incomplete_expired"
                  ? "no_subscription"
                  : "blocked_canceled";

  return {
    organizationId: "org-1",
    subscriptionId:
      reasonCode === "workspace_trial" || reasonCode === "no_subscription"
        ? null
        : "subrec_1",
    stripeSubscriptionId:
      reasonCode === "workspace_trial" || reasonCode === "no_subscription"
        ? null
        : "sub_1",
    rawSubscriptionStatus: null,
    accessState,
    isBlocked: blockedReasonCodes.has(reasonCode),
    reasonCode,
    currentPeriodEnd:
      reasonCode === "active" || reasonCode === "past_due_grace_period"
        ? new Date("2026-04-20T00:00:00.000Z")
        : null,
    trialEndsAt:
      reasonCode === "trialing" || reasonCode === "workspace_trial"
        ? new Date("2099-01-15T00:00:00.000Z")
        : null,
    trialSource:
      reasonCode === "workspace_trial"
        ? "workspace"
        : reasonCode === "trialing"
          ? "subscription"
          : null,
    plan:
      reasonCode === "workspace_trial" || reasonCode === "no_subscription"
        ? null
        : activeAccessState.plan,
    ...overrides,
  };
}

describe("billing recovery form", () => {
  it("renders a real POST form with a default portal intent", () => {
    const markup = renderToStaticMarkup(
      React.createElement(BillingRecoveryForm)
    );

    expect(markup).toContain("action=\"/billing/recover\"");
    expect(markup).toContain("method=\"post\"");
    expect(markup).toContain("name=\"intent\"");
    expect(markup).toContain("value=\"open_billing_portal\"");
    expect(markup).toContain("Manage billing");
    expect(markup).not.toContain("/api/billing/portal");
  });

  it("supports checkout recovery intents and custom labels", () => {
    const markup = renderToStaticMarkup(
      React.createElement(BillingRecoveryForm, {
        intent: "resume_subscription",
        label: "Start subscription",
      })
    );

    expect(markup).toContain("value=\"resume_subscription\"");
    expect(markup).toContain("Start subscription");
  });
});

describe("workspace billing settings card", () => {
  it("renders a real recovery form for owners and admins", () => {
    const markup = renderToStaticMarkup(
      React.createElement(WorkspaceBillingSettingsCard, {
        workspaceName: "Atlas Procurement",
        accessState: activeAccessState,
        canManageBilling: true,
      })
    );

    expect(markup).toContain("Billing &amp; subscription");
    expect(markup).toContain("Atlas Procurement");
    expect(markup).toContain("Growth");
    expect(markup).toContain("Billing status");
    expect(markup).toContain("Access state");
    expect(markup).toContain("Trial state");
    expect(markup).toContain("Recommended action");
    expect(markup).toContain("Stripe billing management");
    expect(markup).toContain(
      "Opens Stripe Portal when a Stripe subscription exists."
    );
    expect(markup).toContain("Manage billing");
    expect(markup).toContain("action=\"/billing/recover\"");
    expect(markup).toContain("method=\"post\"");
    expect(markup).toContain("name=\"intent\"");
    expect(markup).toContain("value=\"open_billing_portal\"");
    expect(markup).toContain("href=\"/settings/billing\"");
    expect(markup).not.toContain("/api/billing/portal");
  });

  it.each([
    ["active", "open_billing_portal"],
    ["trialing", "open_billing_portal"],
    ["workspace_trial", "resume_subscription"],
    ["no_subscription", "resume_subscription"],
    ["trial_expired", "resume_subscription"],
    ["past_due_grace_period", "update_payment_method"],
    ["past_due_blocked", "update_payment_method"],
    ["unpaid", "update_payment_method"],
    ["canceled", "open_billing_portal"],
    ["unknown", "open_billing_portal"],
  ] satisfies Array<
    [
      OrganizationAccessStateResult["reasonCode"],
      "open_billing_portal" | "resume_subscription" | "update_payment_method",
    ]
  >)(
    "keeps Manage billing visible for %s billing state",
    (reasonCode, expectedIntent) => {
      const markup = renderToStaticMarkup(
        React.createElement(WorkspaceBillingSettingsCard, {
          workspaceName: "Atlas Procurement",
          accessState: createAccessState(reasonCode),
          canManageBilling: true,
        })
      );

      expect(markup).toContain("Billing &amp; subscription");
      expect(markup).toContain("Manage billing");
      expect(markup).toContain("action=\"/billing/recover\"");
      expect(markup).toContain("method=\"post\"");
      expect(markup).toContain("name=\"intent\"");
      expect(markup).toContain(`value="${expectedIntent}"`);
      expect(markup).not.toContain("/api/billing/portal");
    }
  );

  it("keeps the card visible but hides recovery actions for members", () => {
    const markup = renderToStaticMarkup(
      React.createElement(WorkspaceBillingSettingsCard, {
        workspaceName: "Atlas Procurement",
        accessState: activeAccessState,
        canManageBilling: false,
      })
    );

    expect(markup).toContain("Billing &amp; subscription");
    expect(markup).toContain(
      "Billing is managed by workspace owners and admins."
    );
    expect(markup).toContain("href=\"/settings/billing\"");
    expect(markup).not.toContain("Manage billing");
    expect(markup).not.toContain("action=\"/billing/recover\"");
    expect(markup).not.toContain("/api/billing/portal");
  });

  it("does not disappear when subscription details are missing", () => {
    const markup = renderToStaticMarkup(
      React.createElement(WorkspaceBillingSettingsCard, {
        workspaceName: "Atlas Procurement",
        accessState: {
          organizationId: "org-1",
          subscriptionId: null,
          stripeSubscriptionId: null,
          rawSubscriptionStatus: null,
          accessState: "no_subscription",
          isBlocked: true,
          reasonCode: "no_subscription",
          currentPeriodEnd: null,
          trialEndsAt: null,
          trialSource: null,
          plan: null,
        } satisfies OrganizationAccessStateResult,
        canManageBilling: true,
      })
    );

    expect(markup).toContain("Billing &amp; subscription");
    expect(markup).toContain("No paid plan yet");
    expect(markup).toContain("Blocked");
    expect(markup).toContain("Complete billing setup");
    expect(markup).toContain("Manage billing");
    expect(markup).toContain("value=\"resume_subscription\"");
    expect(markup).toContain("Opens Stripe Checkout when no subscription");
  });

  it("keeps the recovery form visible while warning admins about missing Stripe config", () => {
    const markup = renderToStaticMarkup(
      React.createElement(WorkspaceBillingSettingsCard, {
        workspaceName: "Atlas Procurement",
        accessState: activeAccessState,
        canManageBilling: true,
        stripeBillingConfigured: false,
        missingStripeBillingEnvKeys: [
          "STRIPE_SECRET_KEY",
          "STRIPE_STARTER_PRODUCT_ID",
        ],
      })
    );

    expect(markup).toContain(
      "Billing provider is not configured in this environment."
    );
    expect(markup).toContain("Add the missing Stripe billing variables");
    expect(markup).toContain("STRIPE_SECRET_KEY");
    expect(markup).toContain("STRIPE_STARTER_PRODUCT_ID");
    expect(markup).toContain("Manage billing");
    expect(markup).toContain("action=\"/billing/recover\"");
    expect(markup).toContain("value=\"open_billing_portal\"");
  });

  it("keeps the recovery form visible when billing status cannot be verified", () => {
    const markup = renderToStaticMarkup(
      React.createElement(WorkspaceBillingSettingsCard, {
        workspaceName: "Atlas Procurement",
        accessState: createAccessState("unknown"),
        canManageBilling: true,
        billingStatusUnavailable: true,
      })
    );

    expect(markup).toContain("Billing status could not be verified.");
    expect(markup).toContain("Manage billing");
    expect(markup).toContain("action=\"/billing/recover\"");
    expect(markup).toContain("name=\"intent\"");
  });
});
