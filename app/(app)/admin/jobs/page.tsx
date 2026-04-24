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
import { getOrganizationJobsOverview } from "@/lib/jobs";
import { canManageOrganizationMembers } from "@/lib/organizations";

function WorkerCommandCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Worker Commands</CardTitle>
        <CardDescription>
          The web app only enqueues async work. Preview and production also need a separate worker process to deliver invitation emails, password recovery emails, analytics, and observability jobs.
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

export default async function AdminJobsPage() {
  const user = await requireOrganization();

  if (!canManageOrganizationMembers(user.activeOrganization.membershipRole)) {
    redirect("/dashboard");
  }

  const overview = await getOrganizationJobsOverview(
    user.activeOrganization.organizationId,
    25
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <SectionHeading title="Job Health" />
        <p className="max-w-3xl text-sm text-[var(--muted-foreground)]">
          Monitor tenant-scoped async work, inspect recent failures, and safely retry eligible jobs without leaving the active organization boundary. The web app does not process queued work by itself, so a separate worker process must be deployed and kept healthy.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <AdminJobsPanel summary={overview.summary} jobs={overview.jobs} />
        <WorkerCommandCard />
      </div>
    </div>
  );
}
