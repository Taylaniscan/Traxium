import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { OrganizationAdminInsights } from "@/lib/admin-insights";

function formatDateTimeLabel(value: Date | null, emptyLabel: string) {
  if (!value) {
    return emptyLabel;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function SignalRow({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[var(--foreground)]">{label}</p>
          <p className="text-sm text-[var(--muted-foreground)]">{detail}</p>
        </div>
        <p className="text-sm font-medium text-[var(--foreground)]">{value}</p>
      </div>
    </div>
  );
}

type AdminActivationSignalsProps = {
  insights: OrganizationAdminInsights;
};

export function AdminActivationSignals({
  insights,
}: AdminActivationSignalsProps) {
  const firstValueLabel = insights.signals.firstValueReached
    ? formatDateTimeLabel(insights.signals.firstValueAt, "Reached")
    : "Not reached yet";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activation Signals</CardTitle>
        <CardDescription>
          Lightweight activation markers for the currently active workspace only.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <SignalRow
          label="Workspace Launched"
          value={formatDateTimeLabel(
            insights.signals.workspaceCreatedAt,
            "Unknown"
          )}
          detail="Organization creation timestamp for this tenant boundary."
        />
        <SignalRow
          label="First Value"
          value={firstValueLabel}
          detail={
            insights.signals.firstValueReached
              ? "The first saving card has been created and the workspace has crossed its initial value threshold."
              : "No saving card exists yet, so the workspace has not reached first value."
          }
        />
        <SignalRow
          label="Last Invite Sent"
          value={formatDateTimeLabel(
            insights.signals.lastInviteSentAt,
            "No invite activity yet"
          )}
          detail="Most recent invitation creation inside the active organization."
        />
        <SignalRow
          label="Last Invite Accepted"
          value={formatDateTimeLabel(
            insights.signals.lastAcceptedInviteAt,
            "No accepted invite yet"
          )}
          detail="Latest invitation acceptance tied to this workspace."
        />
        <SignalRow
          label="Last Portfolio Update"
          value={formatDateTimeLabel(
            insights.signals.lastSavingCardActivityAt,
            "No portfolio updates yet"
          )}
          detail="Most recent saving-card update recorded in this organization."
        />
      </CardContent>
    </Card>
  );
}
