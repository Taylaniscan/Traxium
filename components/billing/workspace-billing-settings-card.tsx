import Link from "next/link";
import { AlertTriangle, CreditCard } from "lucide-react";

import { BillingRecoveryForm } from "@/components/billing/billing-recovery-form";
import { WorkspaceBillingSummary } from "@/components/billing/workspace-billing-summary";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getRecommendedBillingRecoveryIntent } from "@/lib/billing/presentation";
import type { OrganizationAccessStateResult } from "@/lib/billing/types";

type WorkspaceBillingSettingsCardProps = {
  workspaceName: string;
  accessState: OrganizationAccessStateResult;
  canManageBilling: boolean;
  stripeBillingConfigured?: boolean;
  missingStripeBillingEnvKeys?: readonly string[];
  billingStatusUnavailable?: boolean;
};

function getBillingActionHelperText(
  intent: ReturnType<typeof getRecommendedBillingRecoveryIntent>
) {
  switch (intent) {
    case "resume_subscription":
      return "Opens Stripe Checkout when no subscription exists or setup needs to be completed.";
    case "update_payment_method":
      return "Opens Stripe Portal or recovery when payment details need attention.";
    case "open_billing_portal":
      return "Opens Stripe Portal when a Stripe subscription exists.";
  }
}

export function WorkspaceBillingSettingsCard({
  workspaceName,
  accessState,
  canManageBilling,
  stripeBillingConfigured = true,
  missingStripeBillingEnvKeys = [],
  billingStatusUnavailable = accessState.reasonCode === "unknown",
}: WorkspaceBillingSettingsCardProps) {
  const recoveryIntent = getRecommendedBillingRecoveryIntent(accessState);
  const actionHelperText = getBillingActionHelperText(recoveryIntent);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-[var(--muted)] p-2 text-[var(--foreground)]">
            <CreditCard className="h-4 w-4" />
          </div>
          <div>
            <CardTitle>Billing &amp; subscription</CardTitle>
            <CardDescription>
              Manage subscription status, payment recovery, and Stripe billing
              for this workspace.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <p className="text-sm font-medium text-[var(--foreground)]">
          Workspace: {workspaceName}
        </p>

        <WorkspaceBillingSummary
          accessState={accessState}
          canManageBilling={canManageBilling}
          title="Billing status"
          description="Current plan, trial posture, access state, and recommended billing action."
        />

        {billingStatusUnavailable ? (
          <div className="flex gap-3 rounded-2xl border border-[var(--border)] bg-[var(--muted)]/35 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--muted-foreground)]" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Billing status could not be verified.
              </p>
              <p className="text-sm leading-6 text-[var(--muted-foreground)]">
                The billing card stays visible so workspace owners and admins
                can still open recovery while Traxium re-checks billing state.
              </p>
            </div>
          </div>
        ) : null}

        {!stripeBillingConfigured ? (
          <div className="flex gap-3 rounded-2xl border border-[var(--warning)]/35 bg-[var(--warning)]/10 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--warning)]" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Billing provider is not configured in this environment.
              </p>
              <p className="text-sm leading-6 text-[var(--muted-foreground)]">
                Add the missing Stripe billing variables to this environment,
                then restart Traxium. Manage billing is wired to Stripe through
                the billing recovery route, but Stripe cannot open until those
                values exist.
              </p>
              {missingStripeBillingEnvKeys.length ? (
                <ul className="grid gap-1 pt-2 text-xs font-semibold text-[var(--foreground)] sm:grid-cols-2">
                  {missingStripeBillingEnvKeys.map((key) => (
                    <li key={key}>
                      <code>{key}</code>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/35 p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Stripe billing management
              </p>
              <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
                Payment details are handled securely in Stripe. Traxium does
                not store card details.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {canManageBilling ? (
                <div className="space-y-2">
                  <BillingRecoveryForm intent={recoveryIntent} />
                  <p className="max-w-xs text-xs leading-5 text-[var(--muted-foreground)]">
                    {actionHelperText}
                  </p>
                </div>
              ) : (
                <p className="max-w-xs text-sm text-[var(--muted-foreground)]">
                  Billing is managed by workspace owners and admins.
                </p>
              )}

              <Link
                href="/settings/billing"
                className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
              >
                View billing details
              </Link>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
