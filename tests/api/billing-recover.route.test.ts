import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganizationRole } from "@prisma/client";

import {
  MockAuthGuardError,
  createSessionUser,
} from "../helpers/security-fixtures";

const requireOrganizationMock = vi.hoisted(() => vi.fn());
const isAuthGuardErrorMock = vi.hoisted(() => vi.fn());
const getOrganizationAccessStateMock = vi.hoisted(() => vi.fn());
const getStripeBillingConfigMock = vi.hoisted(() => vi.fn());
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
  getStripeBillingConfig: getStripeBillingConfigMock,
  stripePlanCatalogKeys: ["starter", "growth"],
}));

vi.mock("@/lib/billing/checkout", () => ({
  BillingCheckoutError: class BillingCheckoutError extends Error {
    constructor(
      message: string,
      readonly status: 400 | 404 | 409 | 422 | 500 = 400
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
  intent: "open_billing_portal" | "resume_subscription" | "update_payment_method"
) {
  const formData = new FormData();
  formData.set("intent", intent);

  return new Request("http://localhost/billing/recover", {
    method: "POST",
    body: formData,
  });
}

function createBlockedAccessState(
  overrides: Partial<{
    rawSubscriptionStatus: string | null;
    accessState: string;
    reasonCode: string;
    isBlocked: boolean;
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
    getStripeBillingConfigMock.mockReturnValue({
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
    });
  });

  it("redirects restored workspaces back to the dashboard", async () => {
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
      "http://localhost:3000/dashboard"
    );
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
