import { NextResponse } from "next/server";

import { buildAppUrl } from "@/lib/app-url";
import { getOrganizationAccessState } from "@/lib/billing/access";
import { getStripeBillingConfig, stripePlanCatalogKeys } from "@/lib/billing/config";
import {
  BillingCheckoutError,
  createBillingPortalSessionForOrganization,
  createCheckoutSessionForOrganization,
} from "@/lib/billing/checkout";
import {
  isAuthGuardError,
  requireOrganization,
} from "@/lib/auth";
import type { OrganizationAccessStateResult } from "@/lib/billing/types";
import { canManageOrganizationMembers } from "@/lib/organizations";

type RecoveryIntent =
  | "open_billing_portal"
  | "resume_subscription"
  | "update_payment_method";

function createRedirectResponse(pathname: string) {
  return NextResponse.redirect(new URL(buildAppUrl(pathname)), 303);
}

function buildBillingRequiredPath(
  params: Partial<{
    recovery: string;
  }> = {}
) {
  const searchParams = new URLSearchParams();

  if (params.recovery) {
    searchParams.set("recovery", params.recovery);
  }

  const query = searchParams.toString();
  return query ? `/billing-required?${query}` : "/billing-required";
}

function resolveRecoveryIntent(value: FormDataEntryValue | null): RecoveryIntent {
  if (value === "resume_subscription") {
    return "resume_subscription";
  }

  if (value === "update_payment_method") {
    return "update_payment_method";
  }

  return "open_billing_portal";
}

async function readRecoveryIntent(request: Request) {
  try {
    const formData = await request.formData();
    return resolveRecoveryIntent(formData.get("intent"));
  } catch {
    return "open_billing_portal" as const;
  }
}

function shouldStartCheckout(accessState: OrganizationAccessStateResult) {
  return (
    accessState.reasonCode === "no_subscription" ||
    accessState.reasonCode === "incomplete" ||
    accessState.reasonCode === "incomplete_expired"
  );
}

function resolveCheckoutSelection(accessState: OrganizationAccessStateResult) {
  const config = getStripeBillingConfig();
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
  user: Awaited<ReturnType<typeof requireOrganization>>,
  accessState: OrganizationAccessStateResult
) {
  const selection = resolveCheckoutSelection(accessState);
  const checkoutSession = await createCheckoutSessionForOrganization({
    organizationId: user.activeOrganization.organizationId,
    userId: user.id,
    customerEmail: user.email,
    planCode: selection.planCode,
    priceId: selection.priceId,
  });

  return NextResponse.redirect(new URL(checkoutSession.url), 303);
}

export async function POST(request: Request) {
  const intent = await readRecoveryIntent(request);

  try {
    const user = await requireOrganization({
      redirectTo: null,
      allowBillingBlocked: true,
      billingRedirectTo: null,
    });

    if (!canManageOrganizationMembers(user.activeOrganization.membershipRole)) {
      return createRedirectResponse(
        buildBillingRequiredPath({ recovery: "admin_required" })
      );
    }

    const accessState = await getOrganizationAccessState(
      user.activeOrganization.organizationId
    );

    if (!accessState.isBlocked) {
      return createRedirectResponse("/dashboard");
    }

    if (shouldStartCheckout(accessState)) {
      return redirectToCheckout(user, accessState);
    }

    try {
      const portalSession = await createBillingPortalSessionForOrganization({
        organizationId: user.activeOrganization.organizationId,
      });

      return NextResponse.redirect(new URL(portalSession.url), 303);
    } catch (error) {
      if (!(error instanceof BillingCheckoutError) || error.status !== 404) {
        throw error;
      }

      if (intent === "open_billing_portal" || intent === "update_payment_method") {
        return redirectToCheckout(user, accessState);
      }

      return redirectToCheckout(user, accessState);
    }
  } catch (error) {
    if (isAuthGuardError(error)) {
      if (error.code === "UNAUTHENTICATED") {
        return createRedirectResponse("/login");
      }

      if (error.code === "BILLING_REQUIRED") {
        return createRedirectResponse(buildBillingRequiredPath());
      }

      return createRedirectResponse("/onboarding");
    }

    if (error instanceof BillingCheckoutError) {
      return createRedirectResponse(
        buildBillingRequiredPath({ recovery: "launch_failed" })
      );
    }

    return createRedirectResponse(
      buildBillingRequiredPath({ recovery: "launch_failed" })
    );
  }
}
