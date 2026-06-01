import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganizationRole } from "@prisma/client";

import {
  MockAuthGuardError,
  createSessionUser,
} from "../helpers/security-fixtures";

const requireOrganizationMock = vi.hoisted(() => vi.fn());
const isAuthGuardErrorMock = vi.hoisted(() => vi.fn());
const getOrganizationAccessStateMock = vi.hoisted(() => vi.fn());
const getStripeBillingRuntimeConfigMock = vi.hoisted(() => vi.fn());
const createBillingPortalSessionForOrganizationMock = vi.hoisted(() => vi.fn());
const createCheckoutSessionForOrganizationMock = vi.hoisted(() => vi.fn());
const canManageOrganizationMembersMock = vi.hoisted(() => vi.fn());
const buildAppUrlMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireOrganization: requireOrganizationMock,
  isAuthGuardError: isAuthGuardErrorMock,
}));

vi.mock("@/lib/app-url", () => ({
  buildAppUrl: buildAppUrlMock,
}));

vi.mock("@/lib/billing/access", () => ({
  getOrganizationAccessState: getOrganizationAccessStateMock,
}));

vi.mock("@/lib/billing/config", () => ({
  getStripeBillingRuntimeConfig: getStripeBillingRuntimeConfigMock,
  stripePlanCatalogKeys: ["starter", "growth"],
}));

vi.mock("@/lib/billing/checkout", () => ({
  BillingCheckoutError: class BillingCheckoutError extends Error {
    constructor(
      message: string,
      readonly status: 400 | 404 | 409 | 422 | 500 | 503 = 400
    ) {
      super(message);
      this.name = "BillingCheckoutError";
    }
  },
  createBillingPortalSessionForOrganization:
    createBillingPortalSessionForOrganizationMock,
  createCheckoutSessionForOrganization: createCheckoutSessionForOrganizationMock,
}));

vi.mock("@/lib/organizations", () => ({
  canManageOrganizationMembers: canManageOrganizationMembersMock,
}));

import { POST as billingRecoverRoute } from "@/app/billing/recover/route";
import { BillingCheckoutError } from "@/lib/billing/checkout";

function createRecoveryRequest(
  intent:
    | "open_billing_portal"
    | "resume_subscription"
    | "update_payment_method",
  planCode?: "starter" | "growth",
  options: {
    json?: boolean;
  } = {}
) {
  const formData = new FormData();
  formData.set("intent", intent);
  if (planCode) {
    formData.set("planCode", planCode);
  }

  return new Request("http://localhost/billing/recover", {
    method: "POST",
    headers: options.json
      ? {
          accept: "application/json",
          "x-billing-recovery-mode": "json",
        }
      : undefined,
    body: formData,
  });
}

function createBlockedAccessState(
  overrides: Partial<{
    rawSubscriptionStatus: string | null;
    accessState: string;
    reasonCode: string;
    isBlocked: boolean;
    stripeSubscriptionId: string | null;
    plan: {
      planCode: string | null;
    } | null;
  }> = {}
) {
  return {
    organizationId: "org-1",
    subscriptionId: "subrec_1",
    stripeSubscriptionId: "sub_1",
    rawSubscriptionStatus: "UNPAID",
    accessState: "blocked_unpaid",
    isBlocked: true,
    reasonCode: "unpaid",
    currentPeriodEnd: new Date("2026-03-20T00:00:00.000Z"),
    plan: {
      planCode: "growth",
    },
    ...overrides,
  };
}

describe("billing recover route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireOrganizationMock.mockResolvedValue(
      createSessionUser({
        name: "Admin User",
        email: "admin@example.com",
        activeOrganization: {
          membershipId: "membership-admin",
          organizationId: "org-1",
          membershipRole: OrganizationRole.ADMIN,
          membershipStatus: "ACTIVE",
        },
      })
    );
    isAuthGuardErrorMock.mockImplementation(
      (error: unknown) => error instanceof MockAuthGuardError
    );
    buildAppUrlMock.mockImplementation(
      (pathname: string) => `http://localhost:3000${pathname}`
    );
    canManageOrganizationMembersMock.mockReturnValue(true);
    getOrganizationAccessStateMock.mockResolvedValue(createBlockedAccessState());
    getStripeBillingRuntimeConfigMock.mockReturnValue({
      plans: {
        starter: {
          basePriceId: "price_starter",
        },
        growth: {
          basePriceId: "price_growth",
        },
      },
    });
    createBillingPortalSessionForOrganizationMock.mockResolvedValue({
      url: "https://billing.stripe.com/p/session/live_recovery",
    });
    createCheckoutSessionForOrganizationMock.mockResolvedValue({
      sessionId: "cs_recovery_1",
      url: "https://checkout.stripe.com/c/pay/cs_recovery_1",
    });
  });

  it("redirects blocked admins into Stripe billing recovery", async () => {
    const response = await billingRecoverRoute(
      createRecoveryRequest("update_payment_method")
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://billing.stripe.com/p/session/live_recovery"
    );
    expect(createBillingPortalSessionForOrganizationMock).toHaveBeenCalledWith({
      organizationId: "org-1",
    });
  });

  it("redirects blocked members back to the billing-required page with admin guidance", async () => {
    requireOrganizationMock.mockResolvedValueOnce(
      createSessionUser({
        activeOrganization: {
          membershipId: "membership-member",
          organizationId: "org-1",
          membershipRole: OrganizationRole.MEMBER,
          membershipStatus: "ACTIVE",
        },
      })
    );
    canManageOrganizationMembersMock.mockReturnValueOnce(false);

    const response = await billingRecoverRoute(
      createRecoveryRequest("open_billing_portal")
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/billing-required?recovery=admin_required"
    );
  });

  it("starts checkout for missing subscriptions using the synced plan code when available", async () => {
    getOrganizationAccessStateMock.mockResolvedValueOnce(
      createBlockedAccessState({
        accessState: "no_subscription",
        reasonCode: "no_subscription",
        rawSubscriptionStatus: null,
      })
    );

    const response = await billingRecoverRoute(
      createRecoveryRequest("resume_subscription")
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://checkout.stripe.com/c/pay/cs_recovery_1"
    );
    expect(createCheckoutSessionForOrganizationMock).toHaveBeenCalledWith({
      organizationId: "org-1",
      userId: "user-1",
      customerEmail: "admin@example.com",
      planCode: "growth",
      priceId: "price_growth",
      trialEnd: null,
    });
  });

  it("returns the Stripe launch URL as JSON for enhanced billing forms", async () => {
    getOrganizationAccessStateMock.mockResolvedValueOnce(
      createBlockedAccessState({
        accessState: "active",
        reasonCode: "active",
        isBlocked: false,
      })
    );

    const response = await billingRecoverRoute(
      createRecoveryRequest("open_billing_portal", undefined, {
        json: true,
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      url: "https://billing.stripe.com/p/session/live_recovery",
    });
    expect(createBillingPortalSessionForOrganizationMock).toHaveBeenCalledWith({
      organizationId: "org-1",
    });
  });

  it("opens the Stripe billing portal for active paid subscriptions", async () => {
    getOrganizationAccessStateMock.mockResolvedValueOnce(
      createBlockedAccessState({
        accessState: "active",
        reasonCode: "active",
        isBlocked: false,
      })
    );

    const response = await billingRecoverRoute(
      createRecoveryRequest("open_billing_portal")
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://billing.stripe.com/p/session/live_recovery"
    );
    expect(response.headers.get("location")).not.toBe(
      "http://localhost:3000/dashboard"
    );
    expect(createBillingPortalSessionForOrganizationMock).toHaveBeenCalledWith({
      organizationId: "org-1",
    });
    expect(createCheckoutSessionForOrganizationMock).not.toHaveBeenCalled();
  });

  it("falls back to checkout when an active workspace is missing a Stripe customer", async () => {
    getOrganizationAccessStateMock.mockResolvedValueOnce(
      createBlockedAccessState({
        accessState: "active",
        reasonCode: "active",
        isBlocked: false,
      })
    );
    createBillingPortalSessionForOrganizationMock.mockRejectedValueOnce(
      new BillingCheckoutError("No Stripe customer.", 404)
    );

    const response = await billingRecoverRoute(
      createRecoveryRequest("open_billing_portal")
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://checkout.stripe.com/c/pay/cs_recovery_1"
    );
    expect(response.headers.get("location")).not.toBe(
      "http://localhost:3000/dashboard"
    );
    expect(createBillingPortalSessionForOrganizationMock).toHaveBeenCalledWith({
      organizationId: "org-1",
    });
    expect(createCheckoutSessionForOrganizationMock).toHaveBeenCalledWith({
      organizationId: "org-1",
      userId: "user-1",
      customerEmail: "admin@example.com",
      planCode: "growth",
      priceId: "price_growth",
      trialEnd: null,
    });
  });

  it("opens the Stripe billing portal for trialing subscriptions", async () => {
    getOrganizationAccessStateMock.mockResolvedValueOnce(
      createBlockedAccessState({
        accessState: "trialing",
        reasonCode: "trialing",
        isBlocked: false,
      })
    );

    const response = await billingRecoverRoute(
      createRecoveryRequest("open_billing_portal")
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://billing.stripe.com/p/session/live_recovery"
    );
    expect(createBillingPortalSessionForOrganizationMock).toHaveBeenCalledWith({
      organizationId: "org-1",
    });
    expect(createCheckoutSessionForOrganizationMock).not.toHaveBeenCalled();
  });

  it("starts checkout for placeholder trialing subscriptions that still need a real Stripe plan", async () => {
    const trialEnd = new Date("2099-01-15T00:00:00.000Z");

    getOrganizationAccessStateMock.mockResolvedValueOnce({
      ...createBlockedAccessState({
        accessState: "trialing",
        reasonCode: "trialing",
        isBlocked: false,
        stripeSubscriptionId: "sub_demo_utopiatrax",
        plan: null,
      }),
      trialEndsAt: trialEnd,
    });

    const response = await billingRecoverRoute(
      createRecoveryRequest("open_billing_portal")
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://checkout.stripe.com/c/pay/cs_recovery_1"
    );
    expect(createBillingPortalSessionForOrganizationMock).not.toHaveBeenCalled();
    expect(createCheckoutSessionForOrganizationMock).toHaveBeenCalledWith({
      organizationId: "org-1",
      userId: "user-1",
      customerEmail: "admin@example.com",
      planCode: "starter",
      priceId: "price_starter",
      trialEnd,
    });
  });

  it("starts Stripe Checkout from an active workspace trial and preserves the trial end", async () => {
    const trialEnd = new Date("2099-01-15T00:00:00.000Z");

    getOrganizationAccessStateMock.mockResolvedValueOnce({
      organizationId: "org-1",
      subscriptionId: null,
      stripeSubscriptionId: null,
      rawSubscriptionStatus: null,
      accessState: "trialing",
      isBlocked: false,
      reasonCode: "workspace_trial",
      currentPeriodEnd: null,
      trialEndsAt: trialEnd,
      trialSource: "workspace",
      plan: null,
    });

    const response = await billingRecoverRoute(
      createRecoveryRequest("open_billing_portal")
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://checkout.stripe.com/c/pay/cs_recovery_1"
    );
    expect(response.headers.get("location")).not.toBe(
      "http://localhost:3000/dashboard"
    );
    expect(createBillingPortalSessionForOrganizationMock).not.toHaveBeenCalled();
    expect(createCheckoutSessionForOrganizationMock).toHaveBeenCalledWith({
      organizationId: "org-1",
      userId: "user-1",
      customerEmail: "admin@example.com",
      planCode: "starter",
      priceId: "price_starter",
      trialEnd,
    });
  });

  it("returns a controlled Stripe configuration failure when trial checkout cannot start", async () => {
    getOrganizationAccessStateMock.mockResolvedValueOnce({
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
    });

    getStripeBillingRuntimeConfigMock.mockImplementationOnce(() => {
      throw new Error("Missing Stripe config.");
    });

    const response = await billingRecoverRoute(
      createRecoveryRequest("resume_subscription")
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/settings/billing?recovery=stripe_not_configured"
    );
    expect(createBillingPortalSessionForOrganizationMock).not.toHaveBeenCalled();
    expect(createCheckoutSessionForOrganizationMock).not.toHaveBeenCalled();
  });

  it("starts checkout from resume subscription intent when a trial has expired", async () => {
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

    const response = await billingRecoverRoute(
      createRecoveryRequest("resume_subscription", "growth")
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://checkout.stripe.com/c/pay/cs_recovery_1"
    );
    expect(createCheckoutSessionForOrganizationMock).toHaveBeenCalledWith({
      organizationId: "org-1",
      userId: "user-1",
      customerEmail: "admin@example.com",
      planCode: "growth",
      priceId: "price_growth",
      trialEnd: null,
    });
    expect(createBillingPortalSessionForOrganizationMock).not.toHaveBeenCalled();
  });

  it("redirects active members back to billing details with access guidance", async () => {
    requireOrganizationMock.mockResolvedValueOnce(
      createSessionUser({
        activeOrganization: {
          membershipId: "membership-member",
          organizationId: "org-1",
          membershipRole: OrganizationRole.MEMBER,
          membershipStatus: "ACTIVE",
        },
      })
    );
    canManageOrganizationMembersMock.mockReturnValueOnce(false);
    getOrganizationAccessStateMock.mockResolvedValueOnce(
      createBlockedAccessState({
        accessState: "active",
        reasonCode: "active",
        isBlocked: false,
      })
    );

    const response = await billingRecoverRoute(
      createRecoveryRequest("open_billing_portal")
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/settings/billing?recovery=admin_required"
    );
    expect(createBillingPortalSessionForOrganizationMock).not.toHaveBeenCalled();
    expect(createCheckoutSessionForOrganizationMock).not.toHaveBeenCalled();
  });

  it("redirects checkout recovery back to billing details when Stripe is not configured", async () => {
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
    getStripeBillingRuntimeConfigMock.mockImplementationOnce(() => {
      throw new Error("Missing Stripe config.");
    });

    const response = await billingRecoverRoute(
      createRecoveryRequest("resume_subscription")
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/billing-required?recovery=stripe_not_configured"
    );
    expect(createBillingPortalSessionForOrganizationMock).not.toHaveBeenCalled();
    expect(createCheckoutSessionForOrganizationMock).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated users to login", async () => {
    requireOrganizationMock.mockRejectedValueOnce(
      new MockAuthGuardError("Login required.", 401, "UNAUTHENTICATED")
    );

    const response = await billingRecoverRoute(
      createRecoveryRequest("open_billing_portal")
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login"
    );
    expect(getOrganizationAccessStateMock).not.toHaveBeenCalled();
    expect(createBillingPortalSessionForOrganizationMock).not.toHaveBeenCalled();
    expect(createCheckoutSessionForOrganizationMock).not.toHaveBeenCalled();
  });

  it("redirects missing active organization context to onboarding", async () => {
    requireOrganizationMock.mockRejectedValueOnce(
      new MockAuthGuardError(
        "Organization context is required.",
        403,
        "ORGANIZATION_REQUIRED"
      )
    );

    const response = await billingRecoverRoute(
      createRecoveryRequest("open_billing_portal")
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/onboarding"
    );
    expect(getOrganizationAccessStateMock).not.toHaveBeenCalled();
    expect(createBillingPortalSessionForOrganizationMock).not.toHaveBeenCalled();
    expect(createCheckoutSessionForOrganizationMock).not.toHaveBeenCalled();
  });

  it("redirects launch failures back into the billing-required experience instead of returning raw JSON", async () => {
    createBillingPortalSessionForOrganizationMock.mockRejectedValueOnce(
      new BillingCheckoutError("Stripe is unavailable.", 500)
    );

    const response = await billingRecoverRoute(
      createRecoveryRequest("open_billing_portal")
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/billing-required?recovery=launch_failed"
    );
  });
});
