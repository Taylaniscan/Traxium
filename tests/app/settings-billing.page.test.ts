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
const getOrganizationAccessStateMock = vi.hoisted(() => vi.fn());
const canManageOrganizationMembersMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/auth", () => ({
  bootstrapCurrentUser: bootstrapCurrentUserMock,
}));

vi.mock("@/lib/billing/access", () => ({
  getOrganizationAccessState: getOrganizationAccessStateMock,
}));

vi.mock("@/lib/organizations", () => ({
  canManageOrganizationMembers: canManageOrganizationMembersMock,
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
    trialEndsAt: new Date("2026-05-12T00:00:00.000Z"),
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
      accessState: "blocked_unpaid",
      reasonCode: "unpaid",
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
    getOrganizationAccessStateMock.mockResolvedValue(createAllowedTrialAccessState());
    canManageOrganizationMembersMock.mockImplementation(
      (role: OrganizationRole) =>
        role === OrganizationRole.ADMIN || role === OrganizationRole.OWNER
    );
  });

  it("renders active workspace trial state and remaining billing guidance for admins", async () => {
    const page = await BillingReturnPage({
      searchParams: Promise.resolve({ checkout: "success" }),
    });
    const markup = renderToStaticMarkup(page as React.ReactElement);

    expect(markup).toContain("Commercial summary");
    expect(markup).toContain("Current plan");
    expect(markup).toContain("Recommended action");
    expect(markup).toContain("Workspace trial is active");
    expect(markup).toContain("Trial active");
    expect(markup).toContain("Start paid subscription");
    expect(markup).toContain("Stripe checkout returned successfully");
    expect(markup).toContain("No paid plan yet");
  });

  it("routes successful Stripe returns back into billing recovery processing when the workspace is still blocked", async () => {
    bootstrapCurrentUserMock.mockResolvedValueOnce(createBlockedBillingResult());

    await expect(
      BillingReturnPage({
        searchParams: Promise.resolve({ checkout: "success" }),
      })
    ).rejects.toThrow("NEXT_REDIRECT:/billing-required?recovery=processing");
  });

  it("routes cancelled checkout returns back into billing recovery", async () => {
    bootstrapCurrentUserMock.mockResolvedValueOnce(createBlockedBillingResult());

    await expect(
      BillingReturnPage({
        searchParams: Promise.resolve({ checkout: "cancelled" }),
      })
    ).rejects.toThrow("NEXT_REDIRECT:/billing-required?recovery=checkout_cancelled");
  });

  it("redirects blocked workspace returns without checkout state to the billing-required page", async () => {
    bootstrapCurrentUserMock.mockResolvedValueOnce(createBlockedBillingResult());

    await expect(
      BillingReturnPage({
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow("NEXT_REDIRECT:/billing-required");
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

    expect(markup).toContain("Workspace billing is active");
    expect(markup).toContain("Growth");
    expect(markup).toContain("No immediate action");
    expect(markup).toContain("Billing model");
    expect(markup).toContain("Licensed");
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
        trialEndsAt: new Date("2026-05-20T00:00:00.000Z"),
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

    expect(markup).toContain("Subscription trial is active");
    expect(markup).toContain("Prepare trial conversion");
    expect(markup).toContain("Included seats");
    expect(markup).toContain("10");
  });
});
