import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { OrganizationAdminInsights } from "@/lib/admin-insights";

function formatActionLabel(action: string) {
  const [scope, activity] = action.split(".");
  const normalizedScope = scope
    ? scope.charAt(0).toUpperCase() + scope.slice(1)
    : "Admin";
  const normalizedActivity = (activity ?? action)
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  return `${normalizedScope}: ${normalizedActivity}`;
}

function formatDateTimeLabel(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function HealthMetric({
  label,
  value,
  tone,
  detail,
}: {
  label: string;
  value: string;
  tone: "neutral" | "warn";
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
      <p className="text-xs text-[var(--muted-foreground)]">
        {label}
      </p>
      <p
        className={[
          "mt-3 text-3xl font-semibold tracking-tight",
          tone === "warn" ? "text-amber-700" : "text-[var(--foreground)]",
        ].join(" ")}
      >
        {value}
      </p>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">{detail}</p>
    </div>
  );
}

type AdminHealthPanelProps = {
  insights: OrganizationAdminInsights;
};

export function AdminHealthPanel({
  insights,
}: AdminHealthPanelProps) {
  const hasErrors = insights.metrics.recentErrorEventsLast7Days > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Health</CardTitle>
        <CardDescription>
          Persisted tenant-scoped health signals from audit and admin activity.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <HealthMetric
            label="Recent Error Events · 7d"
            value={String(insights.metrics.recentErrorEventsLast7Days)}
            tone={hasErrors ? "warn" : "neutral"}
            detail="Persisted audit-style failure events attributed to this organization."
          />
          <HealthMetric
            label="Critical Admin Actions · 7d"
            value={String(insights.metrics.recentCriticalAdminActionsLast7Days)}
            tone="neutral"
            detail="High-impact workspace actions such as removals, role changes, and settings updates."
          />
        </div>

        {insights.recentCriticalAdminActions.length ? (
          <div className="space-y-3">
            {insights.recentCriticalAdminActions.map((event) => (
              <div
                key={event.id}
                className="rounded-2xl border border-[var(--border)] bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {formatActionLabel(event.action)}
                    </p>
                    <p className="text-sm text-[var(--muted-foreground)]">
                      {event.detail}
                    </p>
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {formatDateTimeLabel(event.createdAt)}
                  </p>
                </div>
                <p className="mt-3 text-xs text-[var(--muted-foreground)]">
                  {event.actor
                    ? `${event.actor.name} · ${event.actor.email}`
                    : "System activity"}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--muted)]/25 px-5 py-8 text-sm text-[var(--muted-foreground)]">
            <p className="font-medium text-[var(--foreground)]">
              No recent critical admin actions
            </p>
            <p className="mt-2">
              High-impact admin changes will appear here as they occur inside this workspace.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
