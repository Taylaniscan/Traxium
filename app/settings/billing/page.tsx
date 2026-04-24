import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CheckCircle2, Clock3, CreditCard } from "lucide-react";

import { WorkspaceBillingSummary } from "@/components/billing/workspace-billing-summary";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { bootstrapCurrentUser } from "@/lib/auth";
import { getOrganizationAccessState } from "@/lib/billing/access";
import type { OrganizationAccessStateResult } from "@/lib/billing/types";
import { canManageOrganizationMembers } from "@/lib/organizations";

type BillingReturnPageProps = {
  searchParams: Promise<{
    checkout?: string | string[];
  }>;
};

function readSingleSearchParam(value: string | string[] | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function buildBillingRequiredPath(
  recovery: "checkout_cancelled" | "processing" | null
) {
  if (!recovery) {
    return "/billing-required";
  }

  return `/billing-required?recovery=${recovery}`;
}

function getStatusPresentation(accessState: OrganizationAccessStateResult) {
  switch (accessState.reasonCode) {
    case "workspace_trial":
      return {
        badgeTone: "blue" as const,
        badgeLabel: "Trial active",
        title: "Workspace trial is active",
        summary:
          "This workspace currently has full product access under the workspace trial window before paid billing is required.",
      };
    case "trialing":
      return {
        badgeTone: "blue" as const,
        badgeLabel: "Subscription trial",
        title: "Subscription trial is active",
        summary:
          "Billing has started and the Stripe subscription is currently in its trial period.",
      };
    case "past_due_grace_period":
      return {
        badgeTone: "orange" as const,
        badgeLabel: "Grace period",
        title: "Billing grace period is active",
        summary:
          "The workspace remains accessible while Stripe billing is in a past-due grace period.",
      };
    default:
      return {
        badgeTone: "emerald" as const,
        badgeLabel: "Active",
        title: "Workspace billing is active",
        summary:
          "This workspace has active billing access and can continue operating normally.",
      };
  }
}

function getCheckoutBanner(
  checkoutState: string | null,
  accessState: OrganizationAccessStateResult
) {
  if (checkoutState === "success") {
    return {
      tone: "success" as const,
      title: "Stripe checkout returned successfully",
      message:
        accessState.reasonCode === "workspace_trial"
          ? "Your workspace trial still keeps access open while the new subscription sync completes."
          : "The workspace billing state is active. If plan details are still catching up, refresh this page in a moment.",
    };
  }

  if (checkoutState === "cancelled") {
    return {
      tone: "amber" as const,
      title: "Stripe checkout was cancelled",
      message:
        accessState.reasonCode === "workspace_trial"
          ? "The workspace trial remains active. You can restart paid billing at any time before the trial ends."
          : "No billing changes were applied. Your current access state remains unchanged.",
    };
  }

  return null;
}

export default async function BillingReturnPage({
  searchParams,
}: BillingReturnPageProps) {
  const resolvedSearchParams = await searchParams;
  const checkoutState = readSingleSearchParam(resolvedSearchParams.checkout);
  const session = await bootstrapCurrentUser();

  if (!session.ok) {
    if (session.code === "UNAUTHENTICATED") {
      redirect("/login");
    }

    if (session.code === "ORGANIZATION_ACCESS_REQUIRED") {
      redirect("/onboarding");
    }

    if (session.code === "BILLING_REQUIRED") {
      if (checkoutState === "success") {
        redirect(buildBillingRequiredPath("processing"));
      }

      if (checkoutState === "cancelled") {
        redirect(buildBillingRequiredPath("checkout_cancelled"));
      }

      redirect(buildBillingRequiredPath(null));
    }
  }

  if (!session.ok) {
    redirect("/login");
  }

  const accessState = await getOrganizationAccessState(
    session.user.activeOrganization.organizationId
  );

  if (accessState.isBlocked) {
    if (checkoutState === "success") {
      redirect(buildBillingRequiredPath("processing"));
    }

    if (checkoutState === "cancelled") {
      redirect(buildBillingRequiredPath("checkout_cancelled"));
    }

    redirect(buildBillingRequiredPath(null));
  }

  const canManageBilling = canManageOrganizationMembers(
    session.user.activeOrganization.membershipRole
  );
  const statusPresentation = getStatusPresentation(accessState);
  const checkoutBanner = getCheckoutBanner(checkoutState, accessState);

  return (
    <main className="min-h-screen bg-[var(--background)] px-6 py-12 text-[var(--foreground)]">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[2rem] border border-[var(--border)] bg-white p-8 shadow-[0_18px_44px_rgba(15,23,42,0.06)]">
            <Badge tone={statusPresentation.badgeTone}>
              {statusPresentation.badgeLabel}
            </Badge>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight">
              {statusPresentation.title}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted-foreground)]">
              {statusPresentation.summary}
            </p>
          </div>

          <WorkspaceBillingSummary
            accessState={accessState}
            canManageBilling={canManageBilling}
            title="Commercial summary"
            description="Current plan, trial posture, access state, and the next billing action for this workspace."
          />
        </section>

        {checkoutBanner ? (
          <div className="rounded-2xl border border-[var(--border)] bg-white px-5 py-4 shadow-sm">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--success)]" />
              <div className="space-y-1">
                <Badge tone={checkoutBanner.tone}>{checkoutBanner.title}</Badge>
                <p className="text-sm leading-6 text-[var(--muted-foreground)]">
                  {checkoutBanner.message}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle>Next steps</CardTitle>
              <CardDescription>
                Keep the workspace commercially ready before the trial window closes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {accessState.reasonCode === "workspace_trial" && canManageBilling ? (
                <form
                  action="/billing/recover"
                  method="post"
                  className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/45 p-4"
                >
                  <input type="hidden" name="intent" value="resume_subscription" />
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-xl bg-white p-2 text-[var(--foreground)] shadow-sm">
                      <CreditCard className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">Start paid subscription</p>
                      <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
                        Launch Stripe checkout and convert the workspace from trial access into a paid subscription.
                      </p>
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="mt-4 inline-flex w-full items-center justify-between rounded-xl bg-[var(--foreground)] px-4 py-3 text-sm font-medium text-white transition hover:opacity-90"
                  >
                    <span>Start paid subscription</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>
              ) : null}

              {accessState.reasonCode === "workspace_trial" && !canManageBilling ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-950">
                  Only workspace owners and admins can start paid billing. Please contact one of them before the trial ends.
                </div>
              ) : null}

              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--muted)]"
              >
                Back to dashboard
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What this means</CardTitle>
              <CardDescription>
                Trial and billing access are still enforced centrally by the workspace billing gate.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex gap-3 rounded-2xl bg-[var(--muted)]/55 p-4">
                <Clock3 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--foreground)]" />
                <p className="leading-6 text-[var(--muted-foreground)]">
                  Trial access is evaluated at the workspace level before there is a paid subscription record.
                </p>
              </div>
              <div className="flex gap-3 rounded-2xl bg-[var(--muted)]/55 p-4">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--foreground)]" />
                <p className="leading-6 text-[var(--muted-foreground)]">
                  Once a paid subscription becomes active, the normal subscription state remains the source of truth for access.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
