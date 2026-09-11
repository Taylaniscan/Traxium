export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

import { AdminJobsPanel } from "@/components/admin/admin-jobs-panel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireOrganization } from "@/lib/auth";
import {
  getJobRunnerHeartbeat,
  getOrganizationJobsOverview,
  type JobRunnerHeartbeatStatus,
} from "@/lib/jobs";
import { canManageOrganizationMembers } from "@/lib/organizations";

function WorkerCommandCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Worker Commands</CardTitle>
        <CardDescription>
          The web app only enqueues async work. By default a Vercel cron hits{" "}
          <span className="font-mono">/api/jobs/run</span> every 5 minutes to drain
          the queue. These commands run the same logic as a dedicated worker process
          for local development or self-hosted worker deployments.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/35 p-4">
          <p className="text-xs text-[var(--muted-foreground)]">
            Continuous Worker
          </p>
          <p className="mt-2 font-mono text-sm text-[var(--foreground)]">
            npm run jobs:worker
          </p>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            Runs the long-lived worker loop and keeps reserving queued jobs until stopped. This must run separately from the Next.js web process.
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/35 p-4">
          <p className="text-xs text-[var(--muted-foreground)]">
            One-shot Drain
          </p>
          <p className="mt-2 font-mono text-sm text-[var(--foreground)]">
            npm run jobs:worker:once
          </p>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            Processes the current queue once and exits cleanly. Useful for deterministic ops checks and ad-hoc retries after a failure.
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/35 p-4">
          <p className="text-xs text-[var(--muted-foreground)]">
            Worker Health Check
          </p>
          <p className="mt-2 font-mono text-sm text-[var(--foreground)]">
            npm run jobs:worker:healthcheck
          </p>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            Verifies database access, registered handlers, and the visible due queue without mutating jobs. Run this in preview and production after each deploy.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function WorkerStatusCard({
  heartbeat,
}: {
  heartbeat: JobRunnerHeartbeatStatus | null;
}) {
  const stale = !heartbeat || heartbeat.stale;
  const minutesAgo = heartbeat ? Math.round(heartbeat.ageMs / 60000) : null;

  return (
    <Card
      className={
        stale
          ? "border-amber-300 bg-amber-50/70"
          : "border-emerald-200 bg-emerald-50/60"
      }
    >
      <CardHeader>
        <CardTitle>Worker Liveness</CardTitle>
        <CardDescription>
          {heartbeat
            ? `Last successful worker pass: ${formatTimestamp(
                heartbeat.lastSuccessfulRunAt
              )}${minutesAgo !== null ? ` (${minutesAgo} min ago)` : ""}.`
            : "No worker pass has been recorded yet."}
        </CardDescription>
      </CardHeader>
      {stale ? (
        <CardContent>
          <div className="rounded-2xl border border-amber-300 bg-amber-100/70 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold">Worker may not be running.</p>
            <p className="mt-1">
              {heartbeat
                ? "The last successful worker pass was more than 30 minutes ago."
                : "No job-worker pass has ever been recorded."}{" "}
              Confirm the Vercel cron (every 5 minutes hitting{" "}
              <span className="font-mono">/api/jobs/run</span>) or a dedicated
              worker process is running, or invitation and password-recovery
              emails will not be delivered.
            </p>
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}

export default async function AdminJobsPage() {
  const user = await requireOrganization();

  if (!canManageOrganizationMembers(user.activeOrganization.membershipRole)) {
    redirect("/dashboard");
  }

  const [overview, workerHeartbeat] = await Promise.all([
    getOrganizationJobsOverview(user.activeOrganization.organizationId, 25),
    getJobRunnerHeartbeat(),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <SectionHeading title="Job Health" />
        <p className="max-w-3xl text-sm text-[var(--muted-foreground)]">
          Monitor tenant-scoped async work, inspect recent failures, and safely retry eligible jobs without leaving the active organization boundary. The web app does not process queued work by itself, so a separate worker process must be deployed and kept healthy.
        </p>
      </div>

      <WorkerStatusCard heartbeat={workerHeartbeat} />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <AdminJobsPanel summary={overview.summary} jobs={overview.jobs} />
        <WorkerCommandCard />
      </div>
    </div>
  );
}
