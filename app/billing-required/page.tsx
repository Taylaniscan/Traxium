import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CreditCard,
  LifeBuoy,
  RefreshCcw,
  ShieldAlert,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { bootstrapCurrentUser, requireUser } from "@/lib/auth";
import type {
  OrganizationAccessReasonCode,
  OrganizationAccessStateResult,
} from "@/lib/billing/types";
import { canManageOrganizationMembers } from "@/lib/organizations";

type BillingRequiredPageProps = {
  searchParams: Promise<{
    recovery?: string | string[];
  }>;
};

type RecoveryAction = {
  description: string;
  icon: typeof CreditCard;
  intent: "open_billing_portal" | "resume_subscription" | "update_payment_method";
  label: string;
};

function readSingleSearchParam(value: string | string[] | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function humanizeLabel(value: string) {
  return value
    .split(/[_-]+/u)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function formatDateLabel(value: Date | null) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

function formatPlanLabel(accessState: OrganizationAccessStateResult) {
  const planName = accessState.plan?.planName?.trim() || "Plan not synced yet";
  const currencyCode = accessState.plan?.currencyCode?.toUpperCase() ?? null;
  const unitAmount = accessState.plan?.unitAmount ?? null;

  if (!currencyCode || unitAmount === null) {
    return planName;
  }

  const formattedAmount = new Intl.NumberFormat("en", {
    style: "currency",
    currency: currencyCode,
  }).format(unitAmount / 100);
  const interval = accessState.plan?.billingInterval
    ? accessState.plan.billingInterval.toLowerCase()
    : null;

  return interval ? `${planName} · ${formattedAmount}/${interval}` : `${planName} · ${formattedAmount}`;
}

function getReasonPresentation(reasonCode: OrganizationAccessReasonCode) {
  switch (reasonCode) {
    case "past_due_grace_period":
    case "past_due_blocked":
      return {
        badgeTone: "orange" as const,
        badgeLabel: "Past due",
        title: "Workspace billing is past due",
        summary:
          "Traxium has paused this workspace until the outstanding billing issue is resolved in Stripe.",
        adminGuidance:
          "Update the payment method or settle the overdue invoice, then refresh access to resume work.",
        memberGuidance:
          "A billing issue is blocking this workspace. Contact a workspace owner or admin so they can update Stripe billing.",
      };
    case "unpaid":
      return {
        badgeTone: "rose" as const,
        badgeLabel: "Unpaid",
        title: "Workspace billing is unpaid",
        summary:
          "The latest subscription payment did not complete, so workspace access is temporarily blocked.",
        adminGuidance:
          "Open billing recovery to replace the payment method, retry collection, or settle the failed invoice.",
        memberGuidance:
          "This workspace is blocked by an unpaid subscription. Please contact a workspace owner or admin for billing recovery.",
      };
    case "canceled":
      return {
        badgeTone: "rose" as const,
        badgeLabel: "Canceled",
        title: "Workspace subscription was canceled",
        summary:
          "This workspace no longer has an active subscription, so product access is paused until billing is reactivated.",
        adminGuidance:
          "Reactivate the subscription in Stripe, confirm billing details, and then refresh access here.",
        memberGuidance:
          "The workspace subscription was canceled. Contact a workspace owner or admin to reactivate billing.",
      };
    case "paused":
      return {
        badgeTone: "orange" as const,
        badgeLabel: "Paused",
        title: "Workspace subscription is paused",
        summary:
          "Traxium access is currently paused for this workspace until billing is resumed.",
        adminGuidance:
          "Resume the subscription in Stripe and confirm the workspace billing setup before returning to the app.",
        memberGuidance:
          "This workspace is paused for billing reasons. Contact a workspace owner or admin to restore access.",
      };
    case "incomplete":
    case "incomplete_expired":
    case "no_subscription":
      return {
        badgeTone: "amber" as const,
        badgeLabel: "Subscription required",
        title: "Workspace billing setup is required",
        summary:
          "This workspace does not have an active subscription yet, so access stays blocked until billing setup is completed.",
        adminGuidance:
          "Start the workspace subscription in Stripe, finish checkout, and then refresh access to continue.",
        memberGuidance:
          "This workspace still needs subscription setup. Contact a workspace owner or admin to finish billing.",
      };
    case "active":
    case "trialing":
      return {
        badgeTone: "emerald" as const,
        badgeLabel: "Active",
        title: "Workspace billing is active",
        summary: "Workspace billing is already active.",
        adminGuidance: "Billing access is active.",
        memberGuidance: "Billing access is active.",
      };
    case "unknown":
      return {
        badgeTone: "amber" as const,
        badgeLabel: "Billing issue",
        title: "Workspace billing needs attention",
        summary:
          "Traxium could not verify this workspace billing state safely, so access remains blocked until billing is confirmed.",
        adminGuidance:
          "Open Stripe billing recovery, confirm the subscription status, and refresh access once billing is active again.",
        memberGuidance:
          "This workspace is blocked by a billing issue that needs admin review. Contact a workspace owner or admin to restore access.",
      };
  }
}

function getRecoveryActions(
  reasonCode: OrganizationAccessReasonCode
): RecoveryAction[] {
  if (
    reasonCode === "incomplete" ||
    reasonCode === "incomplete_expired" ||
    reasonCode === "no_subscription"
  ) {
    return [
      {
        description: "Start checkout and activate billing for this workspace.",
        icon: CreditCard,
        intent: "resume_subscription",
        label: "Start subscription",
      },
    ];
  }

  return [
    {
      description: "Open the Stripe workspace billing portal.",
      icon: CreditCard,
      intent: "open_billing_portal",
      label: "Open billing portal",
    },
    {
      description: "Replace the payment method and retry collection.",
      icon: CreditCard,
      intent: "update_payment_method",
      label: "Update payment method",
    },
    {
      description:
        reasonCode === "canceled" || reasonCode === "paused"
          ? "Reactivate the subscription and restore workspace access."
          : "Review the subscription and complete recovery actions in Stripe.",
      icon: RefreshCcw,
      intent: "resume_subscription",
      label:
        reasonCode === "canceled" || reasonCode === "paused"
          ? "Reactivate subscription"
          : "Resume subscription",
    },
  ];
}

function getRecoveryBanner(recoveryCode: string | null, canManageBilling: boolean) {
  switch (recoveryCode) {
    case "admin_required":
      return {
        tone: "amber" as const,
        title: "Workspace admin action is required",
        message: canManageBilling
          ? "Your billing recovery session expired. Start the recovery action again from this page."
          : "Only workspace owners and admins can recover billing. Please contact one of them to continue.",
      };
    case "checkout_cancelled":
      return {
        tone: "amber" as const,
        title: "Billing checkout was cancelled",
        message:
          "The checkout flow was not completed. The workspace will stay blocked until billing setup finishes.",
      };
    case "launch_failed":
      return {
        tone: "rose" as const,
        title: "Billing recovery could not be opened",
        message:
          "Traxium could not launch the Stripe recovery flow. Try again from this page, or contact support if your team has a billing contact.",
      };
    case "processing":
      return {
        tone: "blue" as const,
        title: "Billing changes are being confirmed",
        message:
          "Stripe returned successfully. If access has not reopened yet, give the subscription sync a moment and refresh access.",
      };
    default:
      return null;
  }
}

function getSupportEmail() {
  const supportEmail =
    process.env.TRAXIUM_SUPPORT_EMAIL?.trim() ||
    process.env.SUPPORT_EMAIL?.trim() ||
    "";

  return supportEmail || null;
}

export default async function BillingRequiredPage({
  searchParams,
}: BillingRequiredPageProps) {
  const resolvedSearchParams = await searchParams;
  const recoveryCode = readSingleSearchParam(resolvedSearchParams.recovery);
  const session = await bootstrapCurrentUser();

  if (session.ok) {
    redirect("/dashboard");
  }

  if (session.code === "UNAUTHENTICATED") {
    redirect("/login");
  }

  if (session.code === "ORGANIZATION_ACCESS_REQUIRED") {
    redirect("/onboarding");
  }

  if (session.code !== "BILLING_REQUIRED" || !session.accessState) {
    return (
      <main className="min-h-screen bg-[var(--background)] px-6 py-16 text-[var(--foreground)]">
        <div className="mx-auto max-w-xl">
          <Card>
            <CardHeader>
              <CardTitle>Workspace billing recovery is unavailable</CardTitle>
              <CardDescription>
                Traxium could not load the active workspace billing state.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {session.message}
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/logout"
                  className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--muted)]"
                >
                  Sign out
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  const user = await requireUser({
    allowBillingBlocked: true,
    billingRedirectTo: null,
    redirectTo: null,
  });
  const accessState = session.accessState;
  const canManageBilling = canManageOrganizationMembers(
    user.activeOrganization.membershipRole
  );
  const reasonPresentation = getReasonPresentation(accessState.reasonCode);
  const recoveryBanner = getRecoveryBanner(recoveryCode, canManageBilling);
  const supportEmail = getSupportEmail();
  const recoveryActions = canManageBilling
    ? getRecoveryActions(accessState.reasonCode)
    : [];

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,var(--background)_0%,#f8fafc_100%)] px-6 py-10 text-[var(--foreground)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-[2rem] border border-[var(--border)] bg-white/95 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur">
            <Badge tone={reasonPresentation.badgeTone}>
              {reasonPresentation.badgeLabel}
            </Badge>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight">
              {reasonPresentation.title}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted-foreground)]">
              {reasonPresentation.summary}
            </p>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--foreground)]">
              {canManageBilling
                ? reasonPresentation.adminGuidance
                : reasonPresentation.memberGuidance}
            </p>
          </div>

          <Card className="bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
            <CardHeader>
              <CardTitle>Workspace billing snapshot</CardTitle>
              <CardDescription>
                Recovery options are scoped to your active organization membership.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="rounded-2xl bg-[var(--muted)]/65 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                  Membership role
                </p>
                <p className="mt-2 text-base font-semibold">
                  {humanizeLabel(user.activeOrganization.membershipRole)}
                </p>
              </div>
              <div className="rounded-2xl bg-[var(--muted)]/65 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                  Billing state
                </p>
                <p className="mt-2 text-base font-semibold">
                  {humanizeLabel(accessState.accessState)}
                </p>
              </div>
              <div className="rounded-2xl bg-[var(--muted)]/65 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                  Subscription plan
                </p>
                <p className="mt-2 text-base font-semibold">
                  {formatPlanLabel(accessState)}
                </p>
              </div>
              <div className="rounded-2xl bg-[var(--muted)]/65 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                  Latest billing date
                </p>
                <p className="mt-2 text-base font-semibold">
                  {formatDateLabel(accessState.currentPeriodEnd)}
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {recoveryBanner ? (
          <div
            className="rounded-2xl border border-[var(--border)] bg-white px-5 py-4 shadow-sm"
            data-recovery-banner={recoveryCode ?? undefined}
          >
            <div className="flex flex-col gap-1">
              <Badge tone={recoveryBanner.tone}>{recoveryBanner.title}</Badge>
              <p className="text-sm leading-6 text-[var(--muted-foreground)]">
                {recoveryBanner.message}
              </p>
            </div>
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <Card className="bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
            <CardHeader>
              <CardTitle>
                {canManageBilling ? "Recover workspace billing" : "What to do next"}
              </CardTitle>
              <CardDescription>
                {canManageBilling
                  ? "Use the Stripe recovery actions below. Once billing is restored, refresh access and Traxium will send you back into the app."
                  : "Only workspace owners and admins can restore billing for this organization."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {canManageBilling ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {recoveryActions.map((action) => {
                    const Icon = action.icon;

                    return (
                      <form
                        key={action.intent}
                        action="/billing/recover"
                        method="post"
                        className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/45 p-4"
                      >
                        <input type="hidden" name="intent" value={action.intent} />
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 rounded-xl bg-white p-2 text-[var(--foreground)] shadow-sm">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold">{action.label}</p>
                            <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
                              {action.description}
                            </p>
                          </div>
                        </div>
                        <button
                          type="submit"
                          className="mt-4 inline-flex w-full items-center justify-between rounded-xl bg-[var(--foreground)] px-4 py-3 text-sm font-medium text-white transition hover:opacity-90"
                        >
                          <span>{action.label}</span>
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </form>
                    );
                  })}

                  <Link
                    href="/billing-required"
                    className="rounded-2xl border border-[var(--border)] bg-white p-4 transition hover:bg-[var(--muted)]/55"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-xl bg-[var(--muted)] p-2 text-[var(--foreground)]">
                        <RefreshCcw className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">Refresh access</p>
                        <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
                          Recheck the workspace subscription and continue into Traxium once billing is active again.
                        </p>
                      </div>
                    </div>
                  </Link>

                  {supportEmail ? (
                    <a
                      href={`mailto:${supportEmail}`}
                      className="rounded-2xl border border-[var(--border)] bg-white p-4 transition hover:bg-[var(--muted)]/55"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-xl bg-[var(--muted)] p-2 text-[var(--foreground)]">
                          <LifeBuoy className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">Contact support</p>
                          <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
                            Reach the configured billing support contact if Stripe recovery does not restore access.
                          </p>
                        </div>
                      </div>
                    </a>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-950">
                    Billing recovery is restricted to workspace owners and admins. Ask them to open the Stripe billing portal, update the payment method, or reactivate the subscription.
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Link
                      href="/billing-required"
                      className="inline-flex items-center justify-center rounded-xl bg-[var(--foreground)] px-4 py-3 text-sm font-medium text-white transition hover:opacity-90"
                    >
                      Refresh access
                    </Link>
                    <Link
                      href="/logout"
                      className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--muted)]"
                    >
                      Sign out
                    </Link>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
            <CardHeader>
              <CardTitle>Access is protected</CardTitle>
              <CardDescription>
                Traxium keeps the workspace blocked until subscription access is restored.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex gap-3 rounded-2xl bg-[var(--muted)]/55 p-4">
                <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--foreground)]" />
                <p className="leading-6 text-[var(--muted-foreground)]">
                  Workspace data remains intact while billing is blocked. Access resumes automatically after the subscription becomes active again.
                </p>
              </div>
              <div className="flex gap-3 rounded-2xl bg-[var(--muted)]/55 p-4">
                <RefreshCcw className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--foreground)]" />
                <p className="leading-6 text-[var(--muted-foreground)]">
                  If billing was just updated in Stripe, refresh this page. Active subscriptions redirect back into the app automatically.
                </p>
              </div>
              <div className="flex gap-3 rounded-2xl bg-[var(--muted)]/55 p-4">
                <CreditCard className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--foreground)]" />
                <p className="leading-6 text-[var(--muted-foreground)]">
                  Recovery actions are scoped to your current organization only. No other tenant billing records are exposed here.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
