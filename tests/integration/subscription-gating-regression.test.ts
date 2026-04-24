import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  MembershipStatus,
  OrganizationRole,
  Role,
  SubscriptionStatus,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  MockAuthGuardError,
  createAuthGuardJsonResponse,
  createSessionUser,
} from "../helpers/security-fixtures";

const redirectMock = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  })
);
const bootstrapCurrentUserMock = vi.hoisted(() => vi.fn());
const requireUserMock = vi.hoisted(() => vi.fn());
const createAuthGuardErrorResponseMock = vi.hoisted(() => vi.fn());
const getCommandCenterDataMock = vi.hoisted(() => vi.fn());
const canManageOrganizationMembersMock = vi.hoisted(() => vi.fn());
const appShellMock = vi.hoisted(() =>
  vi.fn(({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-shell": "app" }, children)
  )
);
const analyticsSessionIdentifyMock = vi.hoisted(() =>
  vi.fn(() => React.createElement("div", { "data-analytics": "session-identify" }))
);

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/auth", () => ({
  bootstrapCurrentUser: bootstrapCurrentUserMock,
  requireUser: requireUserMock,
  createAuthGuardErrorResponse: createAuthGuardErrorResponseMock,
}));

vi.mock("@/lib/data", () => ({
  getCommandCenterData: getCommandCenterDataMock,
}));

vi.mock("@/lib/organizations", () => ({
  canManageOrganizationMembers: canManageOrganizationMembersMock,
}));

vi.mock("@/components/layout/app-shell", () => ({
  AppShell: appShellMock,
}));

vi.mock("@/components/analytics/analytics-session-identify", () => ({
  AnalyticsSessionIdentify: analyticsSessionIdentifyMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    subscription: {
      findMany: vi.fn(),
    },
  },
}));

(globalThis as typeof globalThis & { React: typeof React }).React = React;

import AppLayout from "@/app/(app)/layout";
import BillingRequiredPage from "@/app/billing-required/page";
import { GET as getCommandCenterRoute } from "@/app/api/command-center/route";
import { resolveOrganizationAccessState } from "@/lib/billing/access";
import type { OrganizationAccessSubscriptionRecord } from "@/lib/billing/types";
import { assertPredeployConfiguration } from "@/scripts/predeploy-check";

const NOW = new Date("2026-03-28T12:00:00.000Z");

function createSubscription(
  overrides: Partial<OrganizationAccessSubscriptionRecord> = {}
): OrganizationAccessSubscriptionRecord {
  return {
    id: "subrec_1",
    organizationId: "org-1",
    billingCustomerId: "bc_1",
    productPlanId: "plan_growth",
    planPriceId: "price_growth_monthly",
    stripeSubscriptionId: "sub_1",
    status: SubscriptionStatus.ACTIVE,
    currencyCode: "usd",
    quantity: 1,
    cancelAtPeriodEnd: false,
    currentPeriodStart: new Date("2026-03-01T00:00:00.000Z"),
    currentPeriodEnd: new Date("2026-04-01T00:00:00.000Z"),
    trialStart: null,
    trialEnd: null,
    canceledAt: null,
    endedAt: null,
    metadata: null,
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
    updatedAt: new Date("2026-03-28T00:00:00.000Z"),
    productPlan: {
      id: "plan_growth",
      code: "growth",
      name: "Growth",
      stripeProductId: "prod_growth_live_2026",
      metadata: null,
    },
    planPrice: {
      id: "price_growth_monthly",
      stripePriceId: "price_growth_monthly_live_2026",
      type: "LICENSED",
      interval: "MONTH",
      intervalCount: 1,
      currencyCode: "usd",
      unitAmount: 29900,
      metadata: null,
    },
    ...overrides,
  };
}

function createBlockedBootstrapResult() {
  return {
    ok: false as const,
    code: "BILLING_REQUIRED" as const,
    message:
      "Your workspace subscription has been canceled. Reactivate billing before product access can continue.",
    accessState: {
      organizationId: "org-1",
      subscriptionId: "subrec_1",
      stripeSubscriptionId: "sub_1",
      rawSubscriptionStatus: "CANCELED",
      accessState: "blocked_canceled",
      isBlocked: true,
      reasonCode: "canceled",
      currentPeriodEnd: new Date("2026-03-20T00:00:00.000Z"),
      trialEndsAt: null,
      trialSource: null,
      plan: {
        productPlanId: "plan_growth",
        planCode: "growth",
        planName: "Growth",
        stripeProductId: "prod_growth_live_2026",
        planMetadata: null,
        planPriceId: "price_growth_monthly",
        stripePriceId: "price_growth_monthly_live_2026",
        priceType: "LICENSED",
        billingInterval: "MONTH",
        intervalCount: 1,
        currencyCode: "usd",
        unitAmount: 29900,
        priceMetadata: null,
      },
    },
  };
}

function createDeployJwt(payload: Record<string, unknown>) {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" })
  ).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");

  return `${header}.${body}.signature`;
}

function createDeployEnv(overrides: Record<string, string | undefined> = {}) {
  const projectRef = overrides.PROJECT_REF ?? "previewproj";
  const source: Record<string, string | undefined> = {
    APP_ENV: "preview",
    NEXT_PUBLIC_APP_URL: "https://preview-traxium.vercel.app",
    DATABASE_URL:
      `postgresql://postgres.${projectRef}:secret@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require&connect_timeout=30`,
    DIRECT_URL:
      `postgresql://postgres.${projectRef}:secret@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require&connect_timeout=30`,
    NEXT_PUBLIC_SUPABASE_URL: `https://${projectRef}.supabase.co`,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: createDeployJwt({
      role: "anon",
      ref: projectRef,
    }),
    SUPABASE_SERVICE_ROLE_KEY: createDeployJwt({
      role: "service_role",
      ref: projectRef,
    }),
    STRIPE_SECRET_KEY:
      "sk_test_FAKE",
    STRIPE_WEBHOOK_SECRET:
      "whsec_FAKE",
    STRIPE_PORTAL_RETURN_URL: "https://preview-traxium.vercel.app/settings/billing",
    STRIPE_CHECKOUT_SUCCESS_URL:
      "https://preview-traxium.vercel.app/settings/billing?checkout=success",
    STRIPE_CHECKOUT_CANCEL_URL:
      "https://preview-traxium.vercel.app/settings/billing?checkout=cancelled",
    STRIPE_STARTER_PRODUCT_ID: "prod_previewcistarter2026",
    STRIPE_STARTER_BASE_PRICE_ID: "price_previewcistartermonthly2026",
    STRIPE_STARTER_METERED_PRICE_ID: "price_previewcistarterusage2026",
    STRIPE_GROWTH_PRODUCT_ID: "prod_previewcigrowth2026",
    STRIPE_GROWTH_BASE_PRICE_ID: "price_previewcigrowthmonthly2026",
    STRIPE_GROWTH_METERED_PRICE_ID: "price_previewcigrowthusage2026",
    VERCEL_ENV: "preview",
    VERCEL_PROJECT_PRODUCTION_URL: "app.traxium.com",
    ...overrides,
  };

  delete source.PROJECT_REF;

  return source;
}

describe("subscription gating regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createAuthGuardErrorResponseMock.mockImplementation(createAuthGuardJsonResponse);
    getCommandCenterDataMock.mockResolvedValue({
      filters: {},
      kpis: {},
      pipelineByPhase: [],
      forecastCurve: [],
      topSuppliers: [],
      savingsByRiskLevel: [],
      savingsByQualificationStatus: [],
    });
    canManageOrganizationMembersMock.mockImplementation(
      (role: OrganizationRole) =>
        role === OrganizationRole.ADMIN || role === OrganizationRole.OWNER
    );
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
  });

  it("maps active subscriptions to normal access and canceled subscriptions to blocked access", () => {
    const active = resolveOrganizationAccessState({
      organizationId: "org-1",
      subscription: createSubscription(),
      now: NOW,
    });
    const canceled = resolveOrganizationAccessState({
      organizationId: "org-1",
      subscription: createSubscription({
        status: SubscriptionStatus.CANCELED,
        canceledAt: new Date("2026-03-27T00:00:00.000Z"),
        endedAt: new Date("2026-03-27T00:00:00.000Z"),
      }),
      now: NOW,
    });

    expect(active).toMatchObject({
      accessState: "active",
      isBlocked: false,
      reasonCode: "active",
    });
    expect(canceled).toMatchObject({
      accessState: "blocked_canceled",
      isBlocked: true,
      reasonCode: "canceled",
    });
  });

  it("allows an active workspace trial, blocks an expired workspace trial, and prefers paid access after checkout", () => {
    const activeTrial = resolveOrganizationAccessState({
      organizationId: "org-1",
      subscription: null,
      workspaceTrialEndsAt: new Date("2026-04-10T00:00:00.000Z"),
      now: NOW,
    });
    const expiredTrial = resolveOrganizationAccessState({
      organizationId: "org-1",
      subscription: null,
      workspaceTrialEndsAt: new Date("2026-03-20T00:00:00.000Z"),
      now: NOW,
    });
    const paidAfterTrial = resolveOrganizationAccessState({
      organizationId: "org-1",
      subscription: createSubscription({
        status: SubscriptionStatus.ACTIVE,
      }),
      workspaceTrialEndsAt: new Date("2026-04-10T00:00:00.000Z"),
      now: NOW,
    });

    expect(activeTrial).toMatchObject({
      accessState: "trialing",
      isBlocked: false,
      reasonCode: "workspace_trial",
      trialEndsAt: new Date("2026-04-10T00:00:00.000Z"),
      trialSource: "workspace",
    });
    expect(expiredTrial).toMatchObject({
      accessState: "trial_expired",
      isBlocked: true,
      reasonCode: "trial_expired",
      trialEndsAt: new Date("2026-03-20T00:00:00.000Z"),
      trialSource: "workspace",
    });
    expect(paidAfterTrial).toMatchObject({
      accessState: "active",
      isBlocked: false,
      reasonCode: "active",
      trialEndsAt: null,
      trialSource: null,
    });
  });

  it("allows active admin and member organizations through the app shell and redirects canceled organizations to billing recovery", async () => {
    bootstrapCurrentUserMock.mockResolvedValueOnce({
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

    const adminLayout = await AppLayout({
      children: React.createElement("section", null, "admin-dashboard-ready"),
    });
    const adminMarkup = renderToStaticMarkup(adminLayout as React.ReactElement);

    expect(adminMarkup).toContain("admin-dashboard-ready");

    bootstrapCurrentUserMock.mockResolvedValueOnce({
      ok: true,
      repaired: false,
      user: createSessionUser({
        role: Role.GLOBAL_CATEGORY_LEADER,
      }),
    });

    const memberLayout = await AppLayout({
      children: React.createElement("section", null, "member-dashboard-ready"),
    });
    const memberMarkup = renderToStaticMarkup(memberLayout as React.ReactElement);

    expect(memberMarkup).toContain("member-dashboard-ready");
    expect(appShellMock).toHaveBeenCalledTimes(2);

    bootstrapCurrentUserMock.mockResolvedValueOnce(createBlockedBootstrapResult());

    await expect(
      AppLayout({
        children: React.createElement("section", null, "blocked"),
      })
    ).rejects.toThrow("NEXT_REDIRECT:/billing-required");
  });

  it("returns 402 JSON with the billing-required path for blocked API requests", async () => {
    requireUserMock.mockRejectedValueOnce(
      new MockAuthGuardError(
        "Your workspace subscription has been canceled. Reactivate billing before product access can continue.",
        402,
        "BILLING_REQUIRED",
        {
          accessState: "blocked_canceled",
          reasonCode: "canceled",
        }
      )
    );

    const response = await getCommandCenterRoute(
      new Request("http://localhost/api/command-center")
    );

    expect(response.status).toBe(402);
    await expect(response.json()).resolves.toEqual({
      error:
        "Your workspace subscription has been canceled. Reactivate billing before product access can continue.",
      code: "BILLING_REQUIRED",
      accessState: "blocked_canceled",
      reasonCode: "canceled",
      billingRequiredPath: "/billing-required",
    });
    expect(getCommandCenterDataMock).not.toHaveBeenCalled();
  });

  it("shows admin recovery actions and limits members to contact-admin guidance", async () => {
    bootstrapCurrentUserMock.mockResolvedValue(createBlockedBootstrapResult());

    const adminPage = await BillingRequiredPage({
      searchParams: Promise.resolve({}),
    });
    const adminMarkup = renderToStaticMarkup(adminPage as React.ReactElement);

    expect(adminMarkup).toContain("Workspace subscription was canceled");
    expect(adminMarkup).toContain("Open billing portal");
    expect(adminMarkup).toContain("Reactivate subscription");

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

    const memberPage = await BillingRequiredPage({
      searchParams: Promise.resolve({}),
    });
    const memberMarkup = renderToStaticMarkup(memberPage as React.ReactElement);

    expect(memberMarkup).toContain("What to do next");
    expect(memberMarkup).toContain(
      "Billing recovery is restricted to workspace owners and admins."
    );
    expect(memberMarkup).not.toContain("Open billing portal");
  });

  it("fails production deploy validation when Stripe still uses test mode", () => {
    expect(() =>
      assertPredeployConfiguration(
        createDeployEnv({
          APP_ENV: "production",
          VERCEL_ENV: "production",
          NEXT_PUBLIC_APP_URL: "https://app.traxium.com",
          PROJECT_REF: "prodproj",
          STRIPE_SECRET_KEY:
            "sk_test_FAKE",
        })
      )
    ).toThrow(
      "STRIPE_SECRET_KEY uses a Stripe test key (sk_test_) while APP_ENV=production. Replace it with a live secret key (sk_live_) before deploying."
    );
  });
});
