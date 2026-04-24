import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getBillingCommercialSummary } from "@/lib/billing/presentation";
import type { OrganizationAccessStateResult } from "@/lib/billing/types";

type WorkspaceBillingSummaryProps = {
  accessState: OrganizationAccessStateResult;
  canManageBilling: boolean;
  title?: string;
  description?: string;
};

export function WorkspaceBillingSummary({
  accessState,
  canManageBilling,
  title = "Commercial summary",
  description = "A concise view of current plan status, trial posture, access state, and the next billing step.",
}: WorkspaceBillingSummaryProps) {
  const summary = getBillingCommercialSummary(accessState, canManageBilling);

  return (
    <Card className="bg-white/95 shadow-[0_18px_44px_rgba(15,23,42,0.06)]">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryFact
            label="Current plan"
            value={summary.currentPlan.value}
            detail={summary.currentPlan.detail}
          />
          <SummaryFact
            label="Trial state"
            value={summary.trialState.value}
            detail={summary.trialState.detail}
          />
          <SummaryFact
            label="Access state"
            value={summary.accessState.value}
            detail={summary.accessState.detail}
          />
          <SummaryFact
            label="Recommended action"
            value={summary.nextAction.value}
            detail={summary.nextAction.detail}
          />
        </div>

        {summary.highlights.length ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
              Plan facts
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {summary.highlights.map((highlight) => (
                <div
                  key={highlight.label}
                  className="rounded-xl border border-[var(--border)] bg-white px-4 py-3"
                >
                  <p className="text-xs font-semibold text-[var(--muted-foreground)]">
                    {highlight.label}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                    {highlight.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SummaryFact({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl bg-[var(--muted)]/65 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-2 text-base font-semibold text-[var(--foreground)]">
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
        {detail}
      </p>
    </div>
  );
}
