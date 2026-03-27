import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { OrganizationAdminAuditEvent } from "@/lib/organizations";

type AdminActivityListProps = {
  events: OrganizationAdminAuditEvent[];
};

function formatDateLabel(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

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

export function AdminActivityList({
  events,
}: AdminActivityListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Admin Activity</CardTitle>
        <CardDescription>
          Workspace-scoped admin actions for settings, membership, and invitation management.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {events.length ? (
          <div className="space-y-3">
            {events.map((event) => (
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
                    {formatDateLabel(event.createdAt)}
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
              No admin activity yet
            </p>
            <p className="mt-2">
              Workspace settings updates, membership changes, and invitation lifecycle events will appear here for the active organization.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
