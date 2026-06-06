import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MembershipStatus, OrganizationRole, Role } from "@prisma/client";

import { createSessionUser } from "../helpers/security-fixtures";

const redirectMock = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  })
);
const bootstrapCurrentUserMock = vi.hoisted(() => vi.fn());
const requireUserMock = vi.hoisted(() => vi.fn());
const getOrganizationAccessStateMock = vi.hoisted(() => vi.fn());
const isStripeBillingConfiguredMock = vi.hoisted(() => vi.fn());
const getMissingStripeBillingEnvKeysMock = vi.hoisted(() => vi.fn());
const canManageOrganizationMembersMock = vi.hoisted(() => vi.fn());
const getOrganizationSettingsMock = vi.hoisted(() => vi.fn());
const captureExceptionMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/auth", () => ({
  bootstrapCurrentUser: bootstrapCurrentUserMock,
  requireUser: requireUserMock,
}));

vi.mock("@/lib/billing/access", () => ({
  getOrganizationAccessState: getOrganizationAccessStateMock,
}));

vi.mock("@/lib/billing/config", () => ({
  getMissingStripeBillingEnvKeys: getMissingStripeBillingEnvKeysMock,
  isStripeBillingConfigured: isStripeBillingConfiguredMock,
}));

vi.mock("@/lib/organizations", () => ({
  canManageOrganizationMembers: canManageOrganizationMembersMock,
  getOrganizationSettings: getOrganizationSettingsMock,
}));

vi.mock("@/lib/observability", () => ({
  captureException: captureExceptionMock,
}));

(globalThis as typeof globalThis & { React: typeof React }).React = React;

import BillingReturnPage from "@/app/settings/billing/page";

function createAllowedTrialAccessState(
  overrides: Partial<{
    subscriptionId: string | null;
    stripeSubscriptionId: string | null;
    rawSubscriptionStatus: string | null;
    accessState: string;
    reasonCode: string;
    currentPeriodEnd: Date | null;
    trialEndsAt: Date | null;
    trialSource: "workspace" | "subscription" | null;
    plan: {
      planCode?: string | null;
      planName: string | null;
      currencyCode: string | null;
      unitAmount: number | null;
      billingInterval: string | null;
      intervalCount?: number | null;
      priceType?: string | null;
      planMetadata?: Record<string, unknown> | null;
      priceMetadata?: Record<string, unknown> | null;
    } | null;
  }> = {}
) {
  return {
    organizationId: "org-1",
    subscriptionId: null,
    stripeSubscriptionId: null,
    rawSubscriptionStatus: null,
    accessState: "trialing",
    isBlocked: false,
    reasonCode: "workspace_trial",
    currentPeriodEnd: null,
    trialEndsAt: new Date("2099-01-15T00:00:00.000Z"),
    trialSource: "workspace",
    plan: null,
    ...overrides,
  };
}

function createBlockedBillingResult() {
  return {
    ok: false as const,
    code: "BILLING_REQUIRED" as const,
    message:
      "Your workspace subscription is unpaid. Resolve billing before product access can continue.",
    accessState: {
      organizationId: "org-1",
      subscriptionId: "subrec_1",
      stripeSubscriptionId: "sub_1",
      rawSubscriptionStatus: "UNPAID",
      accessState: "blocked_unpaid",
      isBlocked: true,
      reasonCode: "unpaid",
      currentPeriodEnd: new Date("2026-03-20T00:00:00.000Z"),
      trialEndsAt: null,
      trialSource: null,
      plan: null,
    },
  };
}

describe("settings billing page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bootstrapCurrentUserMock.mockResolvedValue({
      ok: true,
      repaired: false,
      user: createSessionUser({
        role: Role.HEAD_OF_GLOBAL_PROCUREMENT,
        activeOrganization: {
          membershipId: "membership-admin",
          organizationId: "org-1",
          membershipRole: OrganizationRole.ADMIN,
          membershipStatus: MembershipStatus.ACTIVE,
        },
      }),
    });
    requireUserMock.mockResolvedValue(
      createSessionUser({
        role: Role.HEAD_OF_GLOBAL_PROCUREMENT,
        activeOrganization: {
          membershipId: "membership-admin",
          organizationId: "org-1",
          membershipRole: OrganizationRole.ADMIN,
          membershipStatus: MembershipStatus.ACTIVE,
        },
      })
    );
    getOrganizationAccessStateMock.mockResolvedValue(createAllowedTrialAccessState());
    getOrganizationSettingsMock.mockResolvedValue({
      id: "org-1",
      name: "Atlas Procurement",
      description: "Global procurement savings governance workspace.",
      slug: "atlas-procurement",
      createdAt: new Date("2026-03-20T09:00:00.000Z"),
      updatedAt: new Date("2026-03-26T12:00:00.000Z"),
    });
    canManageOrganizationMembersMock.mockImplementation(
      (role: OrganizationRole) =>
        role === OrganizationRole.ADMIN || role === OrganizationRole.OWNER
    );
    isStripeBillingConfiguredMock.mockReturnValue(true);
    getMissingStripeBillingEnvKeysMock.mockReturnValue([]);
  });

  it("renders active workspace trial state and remaining billing guidance for admins", async () => {
    const page = await BillingReturnPage({
      searchParams: Promise.resolve({}),
    });
    const markup = renderToStaticMarkup(page as React.ReactElement);

    expect(markup).toContain("Workspace billing");
    expect(markup).toContain("Review subscription status");
    expect(markup).toContain("Billing &amp; subscription");
    expect(markup).toContain("Billing status");
    expect(markup).toContain("Access state");
    expect(markup).toContain("Atlas Procurement");
    expect(markup).toContain("Billing details");
    expect(markup).toContain("Current plan");
    expect(markup).toContain("Recommended action");
    expect(markup).toContain("Workspace trial active");
    expect(markup).toContain("Connect Stripe trial");
    expect(markup).toContain("14-day workspace trial");
    expect(markup).toContain("Stripe Checkout keeps the remaining");
    expect(markup).toContain("Select subscription plan");
    expect(markup).toContain("Select Starter");
    expect(markup).toContain("Select Growth");
    expect(markup).toContain("Manage billing");
    expect(markup).toContain("Return to Workspace Settings");
    expect(markup).toContain("href=\"/admin/settings\"");
    expect(markup).toContain("Secure billing recovery");
    expect(markup).toContain("action=\"/billing/recover\"");
    expect(markup).toContain("method=\"post\"");
    expect(markup).toContain("name=\"intent\"");
    expect(markup).toContain("value=\"resume_subscription\"");
    expect(markup).toContain("name=\"planCode\"");
    expect(markup).toContain("value=\"starter\"");
    expect(markup).toContain("value=\"growth\"");
    expect(markup).not.toContain("/api/billing/portal");
    expect(markup).toContain("No paid plan yet");
  });

  it("renders UtopiaTrax subscription trial access without a billing block", async () => {
    getOrganizationAccessStateMock.mockResolvedValueOnce(
      createAllowedTrialAccessState({
        subscriptionId: "subrec-utopiatrax",
        stripeSubscriptionId: "sub-demo",
        rawSubscriptionStatus: "TRIALING",
        accessState: "trialing",
        reasonCode: "trialing",
        trialEndsAt: new Date("2028-12-31T23:59:59.000Z"),
        trialSource: "subscription",
      })
    );
    getOrganizationSettingsMock.mockResolvedValueOnce({
      id: "org-utopiatrax",
      name: "UtopiaTrax",
      description: "Manufacturing savings governance demo.",
      slug: "utopiatrax",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-06-05T00:00:00.000Z"),
    });

    const page = await BillingReturnPage({
      searchParams: Promise.resolve({}),
    });
    const markup = renderToStaticMarkup(page as React.ReactElement);

    expect(markup).toContain("UtopiaTrax");
    expect(markup).toContain("Subscription trial");
    expect(markup).toContain("Return to Dashboard");
    expect(markup).not.toContain("Resolve payment failure");
    expect(redirectMock).not.toHaveBeenCalledWith("/billing-required");
  });

  it("renders successful Stripe returns as a clear processing banner when the workspace is still blocked", async () => {
    bootstrapCurrentUserMock.mockResolvedValueOnce(createBlockedBillingResult());

    const page = await BillingReturnPage({
      searchParams: Promise.resolve({ checkout: "success" }),
    });
    const markup = renderToStaticMarkup(page as React.ReactElement);

    expect(markup).toContain("Workspace billing");
    expect(markup).toContain("Stripe checkout returned successfully");
    expect(markup).toContain("Blocked");
    expect(markup).toContain("Manage billing");
    expect(markup).toContain("Resolve payment failure");
  });

  it("renders canceled checkout returns as a visible billing status message", async () => {
    bootstrapCurrentUserMock.mockResolvedValueOnce(createBlockedBillingResult());

    const page = await BillingReturnPage({
      searchParams: Promise.resolve({ checkout: "cancelled" }),
    });
    const markup = renderToStaticMarkup(page as React.ReactElement);

    expect(markup).toContain("Stripe checkout was canceled");
    expect(markup).toContain("Billing status");
    expect(markup).toContain("Access state");
    expect(markup).toContain("Resolve payment failure");
  });

  it("renders blocked workspace billing states without redirecting away from billing details", async () => {
    bootstrapCurrentUserMock.mockResolvedValueOnce(createBlockedBillingResult());

    const page = await BillingReturnPage({
      searchParams: Promise.resolve({}),
    });
    const markup = renderToStaticMarkup(page as React.ReactElement);

    expect(markup).toContain("Workspace billing");
    expect(markup).toContain("Blocked");
    expect(markup).toContain("Resolve payment failure");
    expect(markup).toContain("Manage billing");
  });

  it("renders an active paid subscription snapshot without trial-only copy", async () => {
    getOrganizationAccessStateMock.mockResolvedValueOnce(
      createAllowedTrialAccessState({
        subscriptionId: "subrec_1",
        stripeSubscriptionId: "sub_1",
        rawSubscriptionStatus: "ACTIVE",
        accessState: "active",
        reasonCode: "active",
        currentPeriodEnd: new Date("2026-04-20T00:00:00.000Z"),
        trialEndsAt: null,
        trialSource: null,
        plan: {
          planCode: "growth",
          planName: "Growth",
          currencyCode: "usd",
          unitAmount: 29900,
          billingInterval: "MONTH",
          intervalCount: 1,
          priceType: "LICENSED",
          planMetadata: {
            seatsIncluded: 25,
          },
          priceMetadata: null,
        },
      })
    );

    const page = await BillingReturnPage({
      searchParams: Promise.resolve({}),
    });
    const markup = renderToStaticMarkup(page as React.ReactElement);

    expect(markup).toContain("The workspace has active paid billing access.");
    expect(markup).toContain("Workspace billing");
    expect(markup).toContain("Billing status");
    expect(markup).toContain("Access state");
    expect(markup).toContain("Growth");
    expect(markup).toContain("No immediate action");
    expect(markup).toContain("Manage billing");
    expect(markup).toContain("Return to Dashboard");
    expect(markup).toContain("action=\"/billing/recover\"");
    expect(markup).toContain("value=\"open_billing_portal\"");
    expect(markup).toContain("Billing model");
    expect(markup).toContain("Licensed");
    expect(markup).toContain("Current period ends");
    expect(markup).toContain("Included seats");
    expect(markup).toContain("25");
    expect(markup).not.toContain("Start paid subscription");
  });

  it("renders subscription trial summary for paid plans that are still in trial", async () => {
    getOrganizationAccessStateMock.mockResolvedValueOnce(
      createAllowedTrialAccessState({
        subscriptionId: "subrec_2",
        stripeSubscriptionId: "sub_2",
        rawSubscriptionStatus: "TRIALING",
        accessState: "trialing",
        reasonCode: "trialing",
        trialEndsAt: new Date("2099-01-15T00:00:00.000Z"),
        trialSource: "subscription",
        plan: {
          planCode: "growth",
          planName: "Growth",
          currencyCode: "usd",
          unitAmount: 29900,
          billingInterval: "MONTH",
          intervalCount: 1,
          priceType: "LICENSED",
          planMetadata: {
            seatsIncluded: 10,
          },
          priceMetadata: null,
        },
      })
    );

    const page = await BillingReturnPage({
      searchParams: Promise.resolve({}),
    });
    const markup = renderToStaticMarkup(page as React.ReactElement);

    expect(markup).toContain("Subscription trial");
    expect(markup).toContain("Subscription trial active");
    expect(markup).toContain("Allowed during subscription trial");
    expect(markup).toContain("Prepare trial conversion");
    expect(markup).toContain("Included seats");
    expect(markup).toContain("10");
  });

  it("renders read-only billing guidance for members without Stripe actions", async () => {
    bootstrapCurrentUserMock.mockResolvedValueOnce({
      ok: true,
      repaired: false,
      user: createSessionUser({
        role: Role.TACTICAL_BUYER,
        activeOrganization: {
          membershipId: "membership-member",
          organizationId: "org-1",
          membershipRole: OrganizationRole.MEMBER,
          membershipStatus: MembershipStatus.ACTIVE,
        },
      }),
    });
    getOrganizationAccessStateMock.mockResolvedValueOnce(
      createAllowedTrialAccessState({
        subscriptionId: "subrec_1",
        stripeSubscriptionId: "sub_1",
        rawSubscriptionStatus: "ACTIVE",
        accessState: "active",
        reasonCode: "active",
        currentPeriodEnd: new Date("2026-04-20T00:00:00.000Z"),
        trialEndsAt: null,
        trialSource: null,
        plan: {
          planCode: "growth",
          planName: "Growth",
          currencyCode: "usd",
          unitAmount: 29900,
          billingInterval: "MONTH",
          intervalCount: 1,
          priceType: "LICENSED",
          planMetadata: null,
          priceMetadata: null,
        },
      })
    );

    const page = await BillingReturnPage({
      searchParams: Promise.resolve({}),
    });
    const markup = renderToStaticMarkup(page as React.ReactElement);

    expect(markup).toContain("Billing details");
    expect(markup).toContain("Growth");
    expect(markup).toContain(
      "Billing is managed by workspace owners and admins."
    );
    expect(markup).not.toContain("Manage billing");
    expect(markup).not.toContain("action=\"/billing/recover\"");
    expect(markup).not.toContain("/api/billing/portal");
  });

  it("renders no-subscription setup guidance for blocked workspaces", async () => {
    bootstrapCurrentUserMock.mockResolvedValueOnce({
      ...createBlockedBillingResult(),
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
      },
    });

    const page = await BillingReturnPage({
      searchParams: Promise.resolve({}),
    });
    const markup = renderToStaticMarkup(page as React.ReactElement);

    expect(markup).toContain("Blocked");
    expect(markup).toContain("Complete billing setup");
    expect(markup).toContain("Manage billing");
    expect(markup).toContain("Select subscription plan");
    expect(markup).toContain("Select Starter");
    expect(markup).toContain("Select Growth");
    expect(markup).toContain("value=\"resume_subscription\"");
    expect(markup).toContain("name=\"planCode\"");
    expect(markup).toContain("value=\"starter\"");
    expect(markup).toContain("value=\"growth\"");
  });

  it("renders Stripe configuration errors instead of silently returning to the app", async () => {
    getOrganizationAccessStateMock.mockResolvedValueOnce({
      organizationId: "org-1",
      subscriptionId: null,
      stripeSubscriptionId: null,
      rawSubscriptionStatus: null,
      accessState: "trial_expired",
      isBlocked: true,
      reasonCode: "trial_expired",
      currentPeriodEnd: null,
      trialEndsAt: new Date("2026-03-20T00:00:00.000Z"),
      trialSource: "workspace",
      plan: null,
    });

    const page = await BillingReturnPage({
      searchParams: Promise.resolve({ recovery: "stripe_not_configured" }),
    });
    const markup = renderToStaticMarkup(page as React.ReactElement);

    expect(markup).toContain("Stripe billing is not configured");
    expect(markup).toContain("Stripe environment variables are missing");
    expect(markup).toContain("Manage billing");
    expect(markup).toContain("Select subscription plan");
    expect(markup).toContain("Select Starter");
    expect(markup).toContain("Select Growth");
  });

  it("shows a setup warning when Stripe billing env is missing before launch", async () => {
    isStripeBillingConfiguredMock.mockReturnValueOnce(false);
    getMissingStripeBillingEnvKeysMock.mockReturnValueOnce([
      "STRIPE_SECRET_KEY",
      "STRIPE_CHECKOUT_SUCCESS_URL",
    ]);

    const page = await BillingReturnPage({
      searchParams: Promise.resolve({}),
    });
    const markup = renderToStaticMarkup(page as React.ReactElement);

    expect(markup).toContain(
      "Billing provider is not configured in this environment."
    );
    expect(markup).toContain("Add the missing Stripe billing variables");
    expect(markup).toContain("STRIPE_SECRET_KEY");
    expect(markup).toContain("STRIPE_CHECKOUT_SUCCESS_URL");
    expect(markup).toContain("Manage billing");
    expect(markup).toContain("action=\"/billing/recover\"");
  });

  it("renders degraded billing details when bootstrap billing verification fails", async () => {
    bootstrapCurrentUserMock.mockRejectedValueOnce(
      new Error("Billing access lookup failed.")
    );
    getOrganizationAccessStateMock.mockRejectedValueOnce(
      new Error("Billing access lookup failed.")
    );

    const page = await BillingReturnPage({
      searchParams: Promise.resolve({}),
    });
    const markup = renderToStaticMarkup(page as React.ReactElement);

    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        event: "settings.billing.bootstrap_failed",
        route: "/settings/billing",
      })
    );
    expect(markup).toContain("Workspace billing");
    expect(markup).toContain("Billing status could not be verified.");
    expect(markup).toContain("Manage billing");
    expect(markup).toContain("action=\"/billing/recover\"");
  });
});
