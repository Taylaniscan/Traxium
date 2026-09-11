import { NextResponse } from "next/server";

import { buildAppUrl } from "@/lib/app-url";
import { getOrganizationAccessState } from "@/lib/billing/access";
import {
  getStripeBillingRuntimeConfig,
  stripePlanCatalogKeys,
  type StripePlanCatalogKey,
} from "@/lib/billing/config";
import {
  BillingCheckoutError,
  createBillingPortalSessionForOrganization,
  createCheckoutSessionForOrganization,
} from "@/lib/billing/checkout";
import {
  isAuthGuardError,
  requireOrganization,
} from "@/lib/auth";
import { canManageWorkspaceBilling } from "@/lib/billing/permissions";
import type { OrganizationAccessStateResult } from "@/lib/billing/types";
import { resolveAppEnvironment } from "@/lib/env";
import { writeStructuredLog } from "@/lib/logger";

type RecoveryIntent =
  | "open_billing_portal"
  | "resume_subscription"
  | "update_payment_method";

type RecoveryFailureCode =
  | "admin_required"
  | "launch_failed"
  | "no_billing_customer"
  | "stripe_not_configured";

type RecoveryRequest = {
  intent: RecoveryIntent;
  planCode: StripePlanCatalogKey | null;
};

function wantsJsonRecoveryResponse(request: Request) {
  return (
    request.headers.get("x-billing-recovery-mode") === "json" ||
    request.headers.get("accept")?.includes("application/json") === true
  );
}

function createLaunchResponse(request: Request, url: URL) {
  if (wantsJsonRecoveryResponse(request)) {
    return NextResponse.json(
      {
        url: url.toString(),
      },
      {
        status: 200,
      }
    );
  }

  return NextResponse.redirect(url, 303);
}

function createRedirectResponse(request: Request, pathname: string) {
  return createLaunchResponse(request, new URL(buildAppUrl(pathname)));
}

function buildBillingRequiredPath(
  params: Partial<{
    recovery: RecoveryFailureCode | string;
  }> = {}
) {
  const searchParams = new URLSearchParams();

  if (params.recovery) {
    searchParams.set("recovery", params.recovery);
  }

  const query = searchParams.toString();
  return query ? `/billing-required?${query}` : "/billing-required";
}

function buildBillingSettingsPath(
  params: Partial<{
    recovery: RecoveryFailureCode | string;
  }> = {}
) {
  const searchParams = new URLSearchParams();

  if (params.recovery) {
    searchParams.set("recovery", params.recovery);
  }

  const query = searchParams.toString();
  return query ? `/settings/billing?${query}` : "/settings/billing";
}

function resolveRecoveryIntent(value: FormDataEntryValue | null): RecoveryIntent {
  if (value === "manage_billing" || value === "open_billing_portal") {
    return "open_billing_portal";
  }

  if (value === "resume_subscription") {
    return "resume_subscription";
  }

  if (value === "update_payment_method") {
    return "update_payment_method";
  }

  return "open_billing_portal";
}

function resolveRequestedPlanCode(
  value: FormDataEntryValue | null
): StripePlanCatalogKey | null {
  if (
    typeof value === "string" &&
    stripePlanCatalogKeys.includes(value as StripePlanCatalogKey)
  ) {
    return value as StripePlanCatalogKey;
  }

  return null;
}

async function readRecoveryRequest(request: Request): Promise<RecoveryRequest> {
  try {
    const formData = await request.formData();
    return {
      intent: resolveRecoveryIntent(formData.get("intent")),
      planCode: resolveRequestedPlanCode(formData.get("planCode")),
    };
  } catch {
    return {
      intent: "open_billing_portal",
      planCode: null,
    };
  }
}

function shouldStartCheckout(accessState: OrganizationAccessStateResult) {
  return (
    accessState.reasonCode === "workspace_trial" ||
    isPlaceholderTrialingSubscription(accessState) ||
    accessState.reasonCode === "trial_expired" ||
    accessState.reasonCode === "no_subscription" ||
    accessState.reasonCode === "incomplete" ||
    accessState.reasonCode === "incomplete_expired"
  );
}

function isPlaceholderTrialingSubscription(
  accessState: OrganizationAccessStateResult
) {
  const stripeSubscriptionId =
    accessState.stripeSubscriptionId?.trim().toLowerCase() ?? "";

  return (
    accessState.reasonCode === "trialing" &&
    accessState.plan === null &&
    (stripeSubscriptionId.startsWith("sub_demo") ||
      stripeSubscriptionId.startsWith("sub_fake") ||
      stripeSubscriptionId.startsWith("sub_local") ||
      stripeSubscriptionId.startsWith("sub_preview") ||
      stripeSubscriptionId.startsWith("sub_sample"))
  );
}

function shouldCarryTrialEndToCheckout(accessState: OrganizationAccessStateResult) {
  return (
    accessState.reasonCode === "workspace_trial" ||
    isPlaceholderTrialingSubscription(accessState)
  );
}

function resolveRecoveryTarget(
  accessState: OrganizationAccessStateResult
) {
  if (!accessState.isBlocked) {
    return shouldStartCheckout(accessState) ? "checkout" : "portal";
  }

  return shouldStartCheckout(accessState) ? "checkout" : "portal";
}

function resolveCheckoutSelection(
  accessState: OrganizationAccessStateResult,
  requestedPlanCode: StripePlanCatalogKey | null = null
) {
  let config: ReturnType<typeof getStripeBillingRuntimeConfig>;

  try {
    config = getStripeBillingRuntimeConfig();
  } catch {
    throw new BillingCheckoutError(
      resolveAppEnvironment() === "development"
        ? "Billing is not configured for local development yet. Add the local Stripe settings before starting a subscription."
        : "Billing is not available right now. Please try again later.",
      503
    );
  }

  if (requestedPlanCode) {
    return {
      planCode: requestedPlanCode,
      priceId: config.plans[requestedPlanCode].basePriceId,
    };
  }

  const candidatePlanCode = accessState.plan?.planCode ?? null;

  if (
    candidatePlanCode &&
    stripePlanCatalogKeys.includes(candidatePlanCode as (typeof stripePlanCatalogKeys)[number])
  ) {
    return {
      planCode: candidatePlanCode as (typeof stripePlanCatalogKeys)[number],
      priceId: config.plans[candidatePlanCode as (typeof stripePlanCatalogKeys)[number]].basePriceId,
    };
  }

  return {
    planCode: "starter" as const,
    priceId: config.plans.starter.basePriceId,
  };
}

async function redirectToCheckout(
  request: Request,
  user: Awaited<ReturnType<typeof requireOrganization>>,
  accessState: OrganizationAccessStateResult,
  requestedPlanCode: StripePlanCatalogKey | null = null
) {
  const selection = resolveCheckoutSelection(accessState, requestedPlanCode);
  const checkoutSession = await createCheckoutSessionForOrganization({
    organizationId: user.activeOrganization.organizationId,
    userId: user.id,
    customerEmail: user.email,
    planCode: selection.planCode,
    priceId: selection.priceId,
    trialEnd:
      shouldCarryTrialEndToCheckout(accessState)
      ? accessState.trialEndsAt
      : null,
  });

  return createLaunchResponse(request, new URL(checkoutSession.url));
}

async function redirectToPortalOrCheckoutFallback(
  request: Request,
  user: Awaited<ReturnType<typeof requireOrganization>>,
  accessState: OrganizationAccessStateResult,
  requestedPlanCode: StripePlanCatalogKey | null = null
) {
  try {
    const portalSession = await createBillingPortalSessionForOrganization({
      organizationId: user.activeOrganization.organizationId,
    });

    return createLaunchResponse(request, new URL(portalSession.url));
  } catch (error) {
    if (error instanceof BillingCheckoutError && error.status === 404) {
      return redirectToCheckout(
        request,
        user,
        accessState,
        requestedPlanCode
      );
    }

    throw error;
  }
}

function getRecoveryFailureCode(error: unknown): RecoveryFailureCode {
  if (error instanceof BillingCheckoutError) {
    if (error.status === 503) {
      return "stripe_not_configured";
    }

    if (error.status === 404) {
      return "no_billing_customer";
    }
  }

  return "launch_failed";
}

function buildRecoveryFailureRedirectPath(
  recovery: RecoveryFailureCode,
  returnToBillingSettings: boolean
) {
  return returnToBillingSettings
    ? buildBillingSettingsPath({ recovery })
    : buildBillingRequiredPath({ recovery });
}

export async function POST(request: Request) {
  const { intent, planCode } = await readRecoveryRequest(request);
  let returnToBillingSettingsOnFailure = false;
  let organizationId: string | null = null;
  let userId: string | null = null;

  try {
    const user = await requireOrganization({
      redirectTo: null,
      allowBillingBlocked: true,
      billingRedirectTo: null,
    });
    organizationId = user.activeOrganization.organizationId;
    userId = user.id;

    const accessState = await getOrganizationAccessState(organizationId);
    returnToBillingSettingsOnFailure = !accessState.isBlocked;

    writeStructuredLog("info", {
      event: "billing_manage_clicked",
      runtime: "server",
      organizationId,
      userId,
      route: "/billing/recover",
      method: "POST",
      status: 303,
      payload: {
        intent,
        planCode,
        reasonCode: accessState.reasonCode,
      },
    });

    if (
      !canManageWorkspaceBilling({
        appRole: user.role,
        membershipRole: user.activeOrganization.membershipRole,
      })
    ) {
      writeStructuredLog("warn", {
        event: "billing_action_blocked_no_permission",
        runtime: "server",
        organizationId,
        userId,
        route: "/billing/recover",
        method: "POST",
        status: 303,
        payload: {
          intent,
          planCode,
          reasonCode: accessState.reasonCode,
        },
      });

      return createRedirectResponse(
        request,
        buildRecoveryFailureRedirectPath(
          "admin_required",
          returnToBillingSettingsOnFailure
        )
      );
    }

    writeStructuredLog("info", {
      event: "billing_recovery_started",
      runtime: "server",
      organizationId,
      userId,
      route: "/billing/recover",
      method: "POST",
      status: 303,
      payload: {
        intent,
        planCode,
        reasonCode: accessState.reasonCode,
        recoveryTarget: resolveRecoveryTarget(accessState),
      },
    });

    if (!accessState.isBlocked) {
      if (shouldStartCheckout(accessState)) {
        writeStructuredLog("info", {
          event: "billing_checkout_started",
          runtime: "server",
          organizationId,
          userId,
          route: "/billing/recover",
          method: "POST",
          status: 303,
          payload: {
            intent,
            planCode,
            reasonCode: accessState.reasonCode,
          },
        });

        return await redirectToCheckout(request, user, accessState, planCode);
      }

      writeStructuredLog("info", {
        event: "billing_portal_started",
        runtime: "server",
        organizationId,
        userId,
        route: "/billing/recover",
        method: "POST",
        status: 303,
        payload: {
          intent,
          planCode,
          reasonCode: accessState.reasonCode,
        },
      });

      return await redirectToPortalOrCheckoutFallback(
        request,
        user,
        accessState,
        planCode
      );
    }

    if (shouldStartCheckout(accessState)) {
      writeStructuredLog("info", {
        event: "billing_checkout_started",
        runtime: "server",
        organizationId,
        userId,
        route: "/billing/recover",
        method: "POST",
        status: 303,
        payload: {
          intent,
          planCode,
          reasonCode: accessState.reasonCode,
        },
      });

      return await redirectToCheckout(request, user, accessState, planCode);
    }

    writeStructuredLog("info", {
      event: "billing_portal_started",
      runtime: "server",
      organizationId,
      userId,
      route: "/billing/recover",
      method: "POST",
      status: 303,
      payload: {
        intent,
        planCode,
        reasonCode: accessState.reasonCode,
      },
    });

    return await redirectToPortalOrCheckoutFallback(
      request,
      user,
      accessState,
      planCode
    );
  } catch (error) {
    if (isAuthGuardError(error)) {
      if (error.code === "UNAUTHENTICATED") {
        return createRedirectResponse(request, "/login");
      }

      if (error.code === "BILLING_REQUIRED") {
        return createRedirectResponse(request, buildBillingRequiredPath());
      }

      return createRedirectResponse(request, "/onboarding");
    }

    const recovery = getRecoveryFailureCode(error);
    writeStructuredLog("error", {
      event: "billing_action_failed",
      runtime: "server",
      organizationId,
      userId,
      route: "/billing/recover",
      method: "POST",
      status: error instanceof BillingCheckoutError ? error.status : 500,
      payload: {
        intent,
        recovery,
      },
      error,
    });

    if (error instanceof BillingCheckoutError) {
      return createRedirectResponse(
        request,
        buildRecoveryFailureRedirectPath(
          recovery,
          returnToBillingSettingsOnFailure
        )
      );
    }

    return createRedirectResponse(
      request,
      buildRecoveryFailureRedirectPath(
        recovery,
        returnToBillingSettingsOnFailure
      )
    );
  }
}
