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
const canManageOrganizationMembersMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/auth", () => ({
  bootstrapCurrentUser: bootstrapCurrentUserMock,
  requireUser: requireUserMock,
}));

vi.mock("@/lib/organizations", () => ({
  canManageOrganizationMembers: canManageOrganizationMembersMock,
}));

(globalThis as typeof globalThis & { React: typeof React }).React = React;

import BillingRequiredPage from "@/app/billing-required/page";

function createBlockedBootstrapResult(
  overrides: Partial<{
    accessState: Partial<{
      accessState: string;
      reasonCode: string;
      currentPeriodEnd: Date | null;
      plan: {
        planName: string | null;
        currencyCode: string | null;
        unitAmount: number | null;
        billingInterval: string | null;
      } | null;
    }>;
    message: string;
  }> = {}
) {
  return {
    ok: false as const,
    code: "BILLING_REQUIRED" as const,
    message:
      overrides.message ??
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
      plan: {
        productPlanId: "plan_growth",
        planCode: "growth",
        planName: "Growth",
        stripeProductId: "prod_growth",
        planMetadata: null,
        planPriceId: "price_growth",
        stripePriceId: "price_growth",
        priceType: "LICENSED",
        billingInterval: "MONTH",
        intervalCount: 1,
        currencyCode: "usd",
        unitAmount: 29900,
        priceMetadata: null,
      },
      ...(overrides.accessState ?? {}),
    },
  };
}

describe("billing required page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bootstrapCurrentUserMock.mockResolvedValue(createBlockedBootstrapResult());
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
    canManageOrganizationMembersMock.mockImplementation(
      (role: OrganizationRole) =>
        role === OrganizationRole.ADMIN || role === OrganizationRole.OWNER
    );
  });

  it("renders billing recovery CTAs for blocked admins", async () => {
    const page = await BillingRequiredPage({
      searchParams: Promise.resolve({ recovery: "processing" }),
    });
    const markup = renderToStaticMarkup(page as React.ReactElement);

    expect(markup).toContain("Workspace billing is unpaid");
    expect(markup).toContain("Recover workspace billing");
    expect(markup).toContain("Open billing portal");
    expect(markup).toContain("Update payment method");
    expect(markup).toContain("Resume subscription");
    expect(markup).toContain("Billing changes are being confirmed");
    expect(markup).toContain("Growth");
  });

  it("renders member guidance instead of admin billing recovery actions", async () => {
    requireUserMock.mockResolvedValueOnce(
      createSessionUser({
        activeOrganization: {
          membershipId: "membership-member",
          organizationId: "org-1",
          membershipRole: OrganizationRole.MEMBER,
          membershipStatus: MembershipStatus.ACTIVE,
        },
      })
    );
    canManageOrganizationMembersMock.mockReturnValueOnce(false);

    const page = await BillingRequiredPage({
      searchParams: Promise.resolve({}),
    });
    const markup = renderToStaticMarkup(page as React.ReactElement);

    expect(markup).toContain("What to do next");
    expect(markup).toContain(
      "Billing recovery is restricted to workspace owners and admins."
    );
    expect(markup).toContain("Refresh access");
    expect(markup).not.toContain("Open billing portal");
  });

  it("changes the billing text for canceled, unpaid, past due, and no subscription states", async () => {
    const scenarios = [
      {
        accessState: {
          accessState: "blocked_canceled",
          reasonCode: "canceled",
          currentPeriodEnd: new Date("2026-03-20T00:00:00.000Z"),
          plan: {
            planName: "Growth",
            currencyCode: "usd",
            unitAmount: 29900,
            billingInterval: "MONTH",
          },
        },
        title: "Workspace subscription was canceled",
      },
      {
        accessState: {
          accessState: "blocked_unpaid",
          reasonCode: "unpaid",
          currentPeriodEnd: new Date("2026-03-20T00:00:00.000Z"),
          plan: {
            planName: "Growth",
            currencyCode: "usd",
            unitAmount: 29900,
            billingInterval: "MONTH",
          },
        },
        title: "Workspace billing is unpaid",
      },
      {
        accessState: {
          accessState: "blocked_past_due",
          reasonCode: "past_due_blocked",
          currentPeriodEnd: new Date("2026-03-20T00:00:00.000Z"),
          plan: {
            planName: "Growth",
            currencyCode: "usd",
            unitAmount: 29900,
            billingInterval: "MONTH",
          },
        },
        title: "Workspace billing is past due",
      },
      {
        accessState: {
          accessState: "no_subscription",
          reasonCode: "no_subscription",
          plan: null,
          currentPeriodEnd: null,
        },
        title: "Workspace billing setup is required",
      },
    ] as const;

    for (const scenario of scenarios) {
      bootstrapCurrentUserMock.mockResolvedValueOnce(
        createBlockedBootstrapResult({
          accessState: scenario.accessState,
        })
      );

      const page = await BillingRequiredPage({
        searchParams: Promise.resolve({}),
      });
      const markup = renderToStaticMarkup(page as React.ReactElement);

      expect(markup).toContain(scenario.title);
    }
  });

  it("renders a safe generic recovery state for unknown billing reasons", async () => {
    bootstrapCurrentUserMock.mockResolvedValueOnce(
      createBlockedBootstrapResult({
        accessState: {
          accessState: "blocked_canceled",
          reasonCode: "unknown",
          currentPeriodEnd: new Date("2026-03-20T00:00:00.000Z"),
          plan: {
            planName: "Growth",
            currencyCode: "usd",
            unitAmount: 29900,
            billingInterval: "MONTH",
          },
        },
      })
    );

    const page = await BillingRequiredPage({
      searchParams: Promise.resolve({}),
    });
    const markup = renderToStaticMarkup(page as React.ReactElement);

    expect(markup).toContain("Workspace billing needs attention");
    expect(markup).toContain("Recover workspace billing");
    expect(markup).toContain("Open billing portal");
  });

  it("redirects restored subscriptions back into the app instead of showing the paywall", async () => {
    bootstrapCurrentUserMock.mockResolvedValueOnce({
      ok: true,
      repaired: false,
      user: createSessionUser(),
    });

    await expect(
      BillingRequiredPage({
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(requireUserMock).not.toHaveBeenCalled();
  });

  it("redirects missing workspace context to onboarding", async () => {
    bootstrapCurrentUserMock.mockResolvedValueOnce({
      ok: false,
      code: "ORGANIZATION_ACCESS_REQUIRED",
      message: "Your account is not an active member of any Traxium organization.",
    });

    await expect(
      BillingRequiredPage({
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow("NEXT_REDIRECT:/onboarding");
  });
});
