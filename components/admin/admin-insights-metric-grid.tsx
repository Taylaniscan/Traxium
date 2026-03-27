import type { OrganizationAdminInsights } from "@/lib/admin-insights";

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
      <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
        {value}
      </p>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">{detail}</p>
    </div>
  );
}

type AdminInsightsMetricGridProps = {
  insights: OrganizationAdminInsights;
};

export function AdminInsightsMetricGrid({
  insights,
}: AdminInsightsMetricGridProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <MetricCard
        label="Total Members"
        value={formatCount(insights.metrics.totalMembers)}
        detail="Current membership records inside the active workspace."
      />
      <MetricCard
        label="Pending Invites"
        value={formatCount(insights.metrics.pendingInvites)}
        detail="Invitation records still waiting for acceptance or completion."
      />
      <MetricCard
        label="Invites Sent · 7d"
        value={formatCount(insights.metrics.invitesSentLast7Days)}
        detail="Invitation volume created in the last seven days."
      />
      <MetricCard
        label="Invites Sent · 30d"
        value={formatCount(insights.metrics.invitesSentLast30Days)}
        detail="Invitation volume created in the last thirty days."
      />
      <MetricCard
        label="Accepted Invites"
        value={formatCount(insights.metrics.acceptedInvites)}
        detail="Workspace invitations accepted to date for this tenant."
      />
      <MetricCard
        label="Live Saving Cards"
        value={formatCount(insights.metrics.liveSavingCards)}
        detail="Saving cards currently present in the active organization."
      />
    </div>
  );
}
