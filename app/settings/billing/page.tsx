import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, CreditCard, ShieldCheck } from "lucide-react";

import { BillingRecoveryForm } from "@/components/billing/billing-recovery-form";
import { WorkspaceBillingSettingsCard } from "@/components/billing/workspace-billing-settings-card";
import { WorkspaceBillingSummary } from "@/components/billing/workspace-billing-summary";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { bootstrapCurrentUser, requireUser } from "@/lib/auth";
import { getOrganizationAccessState } from "@/lib/billing/access";
import {
  getMissingStripeBillingEnvKeys,
  isStripeBillingConfigured,
} from "@/lib/billing/config";
import { canManageWorkspaceBilling } from "@/lib/billing/permissions";
import type { OrganizationAccessStateResult } from "@/lib/billing/types";
import { getOrganizationSettings } from "@/lib/organizations";

type BillingReturnPageProps = {
  searchParams: Promise<{
    checkout?: string | string[];
    recovery?: string | string[];
  }>;
};

const SUBSCRIPTION_PLAN_CHOICES = [
  {
    code: "starter" as const,
    name: "Starter",
    description:
      "For teams beginning controlled savings execution after the workspace trial.",
    cta: "Select Starter",
  },
  {
    code: "growth" as const,
    name: "Growth",
    description:
      "For teams that need broader rollout capacity and stronger portfolio governance.",
    cta: "Select Growth",
  },
] as const;

function readSingleSearchParam(value: string | string[] | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function createUnknownAccessState(
  organizationId: string
): OrganizationAccessStateResult {
  return {
    organizationId,
    subscriptionId: null,
    stripeSubscriptionId: null,
    rawSubscriptionStatus: null,
    accessState: "no_subscription",
    isBlocked: true,
    reasonCode: "unknown",
    currentPeriodEnd: null,
    trialEndsAt: null,
    trialSource: null,
    plan: null,
  };
}

async function loadAccessState(organizationId: string) {
  return getOrganizationAccessState(organizationId).catch(() =>
    createUnknownAccessState(organizationId)
  );
}

function getRecoveryBanner(
  checkoutState: string | null,
  recoveryCode: string | null,
  accessState: OrganizationAccessStateResult,
  canManageBilling: boolean
) {
  if (checkoutState === "success") {
    return {
      tone: "success" as const,
      title: "Stripe checkout returned successfully",
      message: accessState.isBlocked
        ? "Stripe returned successfully. If billing is still blocked, give the subscription sync a moment and refresh access."
        : "The workspace billing state is active. If plan details are still catching up, refresh this page in a moment.",
    };
  }

  if (checkoutState === "cancelled") {
    return {
      tone: "amber" as const,
      title: "Stripe checkout was canceled",
      message:
        "No billing changes were applied. You can start billing recovery again when you are ready.",
    };
  }

  switch (recoveryCode) {
    case "trial_active":
      return {
        tone: "blue" as const,
        title: "Workspace trial is active",
        message:
          "This tenant is in its 14-day workspace trial. Subscription plan selection opens after the trial ends.",
      };
    case "processing":
      return {
        tone: "blue" as const,
        title: "Billing changes are being confirmed",
        message:
          "Stripe returned successfully. If access has not reopened yet, give the subscription sync a moment and refresh access.",
      };
    case "checkout_cancelled":
      return {
        tone: "amber" as const,
        title: "Billing checkout was canceled",
        message:
          "The checkout flow was not completed. You can start billing recovery again when you are ready.",
      };
    case "admin_required":
      return {
        tone: "amber" as const,
        title: "Workspace admin action is required",
        message: canManageBilling
          ? "Your billing recovery session expired. Start the recovery action again from this page."
          : "Only workspace owners and admins can manage billing. Contact one of them to continue.",
      };
    case "launch_failed":
      return {
        tone: "rose" as const,
        title: "Billing recovery could not be opened",
        message:
          "Traxium could not launch the Stripe recovery flow. Try again, or contact support if your team has a billing contact.",
      };
    case "no_billing_customer":
      return {
        tone: "amber" as const,
        title: "Stripe customer is not ready yet",
        message:
          "This workspace does not have a Stripe customer record yet. Start checkout to create one and activate billing.",
      };
    case "portal_unavailable":
      return {
        tone: "rose" as const,
        title: "Stripe portal is unavailable",
        message:
          "Traxium could not open the Stripe billing portal. Start billing recovery again or try later.",
      };
    case "stripe_not_configured":
      return {
        tone: "rose" as const,
        title: "Stripe billing is not configured",
        message:
          "Traxium could not open billing because Stripe environment variables are missing for this deployment.",
      };
    default:
      return null;
  }
}

function shouldShowSubscriptionPlanSelection(
  accessState: OrganizationAccessStateResult
) {
  return (
    accessState.reasonCode === "workspace_trial" ||
    accessState.reasonCode === "trial_expired" ||
    accessState.reasonCode === "no_subscription" ||
    accessState.reasonCode === "incomplete" ||
    accessState.reasonCode === "incomplete_expired"
  );
}

export default async function BillingReturnPage({
  searchParams,
}: BillingReturnPageProps) {
  const resolvedSearchParams = await searchParams;
  const checkoutState = readSingleSearchParam(resolvedSearchParams.checkout);
  const recoveryCode = readSingleSearchParam(resolvedSearchParams.recovery);
  const session = await bootstrapCurrentUser();

  let user: Awaited<ReturnType<typeof requireUser>>;
  let accessState: OrganizationAccessStateResult;

  if (session.ok) {
    user = session.user;
    accessState = await loadAccessState(
      session.user.activeOrganization.organizationId
    );
  } else {
    if (session.code === "UNAUTHENTICATED") {
      redirect("/login");
    }

    if (session.code === "ORGANIZATION_ACCESS_REQUIRED") {
      redirect("/onboarding");
    }

    if (session.code !== "BILLING_REQUIRED") {
      redirect("/login");
    }

    user = await requireUser({
      allowBillingBlocked: true,
      billingRedirectTo: null,
      redirectTo: null,
    });
    accessState =
      session.accessState ??
      (await loadAccessState(user.activeOrganization.organizationId));
  }

  const canManageBilling = canManageWorkspaceBilling({
    appRole: user.role,
    membershipRole: user.activeOrganization.membershipRole,
  });
  const organization = await getOrganizationSettings(
    user.activeOrganization.organizationId
  ).catch(() => null);
  const workspaceName = organization?.name ?? "Workspace";
  const stripeBillingConfigured = isStripeBillingConfigured();
  const missingStripeBillingEnvKeys = stripeBillingConfigured
    ? []
    : getMissingStripeBillingEnvKeys();
  const recoveryBanner = getRecoveryBanner(
    checkoutState,
    recoveryCode,
    accessState,
    canManageBilling
  );
  const showSubscriptionPlanSelection =
    canManageBilling && shouldShowSubscriptionPlanSelection(accessState);

  return (
    <main className="min-h-screen bg-[var(--background)] px-6 py-10 text-[var(--foreground)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <SectionHeading
          title="Workspace billing"
          subtitle="Review subscription status, billing access, and recovery actions for this workspace."
          action={
            <div className="flex flex-wrap gap-2">
              {canManageBilling ? (
                <Link
                  href="/admin/settings"
                  className="inline-flex items-center justify-center rounded-md border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--muted)]"
                >
                  Workspace Settings
                </Link>
              ) : null}
              {!accessState.isBlocked ? (
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center rounded-md border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--muted)]"
                >
                  Return to Dashboard
                </Link>
              ) : null}
            </div>
          }
        />

        {recoveryBanner ? (
          <div
            className="rounded-lg border border-[var(--border)] bg-white px-5 py-4 shadow-sm"
            data-recovery-banner={recoveryCode ?? checkoutState ?? undefined}
          >
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--success)]" />
              <div className="space-y-1">
                <Badge tone={recoveryBanner.tone}>{recoveryBanner.title}</Badge>
                <p className="text-sm leading-6 text-[var(--muted-foreground)]">
                  {recoveryBanner.message}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <WorkspaceBillingSettingsCard
          accessState={accessState}
          canManageBilling={canManageBilling}
          stripeBillingConfigured={stripeBillingConfigured}
          missingStripeBillingEnvKeys={missingStripeBillingEnvKeys}
          workspaceName={workspaceName}
        />

        {showSubscriptionPlanSelection ? (
          <Card className="bg-white/95">
            <CardHeader>
              <CardTitle>Select subscription plan</CardTitle>
              <CardDescription>
                Choose the plan for this tenant. If the workspace trial is
                active, Stripe Checkout keeps the remaining 14-day workspace
                trial before paid billing starts.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {SUBSCRIPTION_PLAN_CHOICES.map((plan) => (
                <div
                  key={plan.code}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/35 p-4"
                >
                  <p className="text-base font-semibold text-[var(--foreground)]">
                    {plan.name}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                    {plan.description}
                  </p>
                  <BillingRecoveryForm
                    className="mt-4"
                    intent="resume_subscription"
                    label={plan.cta}
                    planCode={plan.code}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <WorkspaceBillingSummary
            accessState={accessState}
            canManageBilling={canManageBilling}
            title="Billing details"
            description="Current plan, trial posture, access state, and recommended billing action."
          />

          <Card className="bg-white/95">
            <CardHeader>
              <CardTitle>Secure billing recovery</CardTitle>
              <CardDescription>
                How Traxium handles subscription and payment management.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3 rounded-lg border border-[var(--border)] bg-[var(--muted)]/35 p-4">
                <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--success)]" />
                <p className="text-sm leading-6 text-[var(--muted-foreground)]">
                  Traxium uses Stripe for secure subscription and payment
                  management. Payment details are managed in Stripe, not stored
                  in Traxium.
                </p>
              </div>
              <div className="flex gap-3 rounded-lg border border-[var(--border)] bg-[var(--muted)]/35 p-4">
                <CreditCard className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--foreground)]" />
                <p className="text-sm leading-6 text-[var(--muted-foreground)]">
                  Billing actions post to the recovery router, which chooses
                  Stripe Checkout or the Stripe customer portal for this
                  workspace.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
