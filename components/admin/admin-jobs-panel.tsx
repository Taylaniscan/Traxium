import { JobRetryButton } from "@/components/admin/job-retry-button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import type {
  OrganizationAdminJob,
  OrganizationJobStatusSummary,
} from "@/lib/jobs";

type AdminJobsPanelProps = {
  summary: OrganizationJobStatusSummary;
  jobs: OrganizationAdminJob[];
};

function formatDateLabel(value: Date | null, emptyLabel = "Not processed yet") {
  if (!value) {
    return emptyLabel;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function formatJobTypeLabel(type: string) {
  return type
    .split(".")
    .map((segment) =>
      segment
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
    )
    .join(" / ");
}

function statusTone(status: OrganizationAdminJob["status"]) {
  switch (status) {
    case "QUEUED":
      return "amber";
    case "RUNNING":
      return "blue";
    case "FAILED":
      return "rose";
    case "COMPLETED":
      return "emerald";
    case "CANCELED":
      return "slate";
    default:
      return "slate";
  }
}

function getRetryDisabledReason(job: OrganizationAdminJob) {
  switch (job.status) {
    case "QUEUED":
      return "Already queued for worker pickup.";
    case "RUNNING":
      return "Currently being processed by a worker.";
    case "COMPLETED":
      return "Already completed successfully.";
    default:
      return null;
  }
}

function SummaryCard({
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
      <p className="text-xs text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">{detail}</p>
    </div>
  );
}

export function AdminJobsPanel({
  summary,
  jobs,
}: AdminJobsPanelProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Queued"
          value={String(summary.queued)}
          detail="Ready for the worker to reserve and process."
        />
        <SummaryCard
          label="Processing"
          value={String(summary.running)}
          detail="Currently reserved by an active worker process."
        />
        <SummaryCard
          label="Failed"
          value={String(summary.failed)}
          detail="Persisted failures that may need an admin-triggered retry."
        />
        <SummaryCard
          label="Completed"
          value={String(summary.completed)}
          detail="Recently finished jobs tied to the active workspace."
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Jobs</CardTitle>
          <CardDescription>
            Tenant-scoped async work for email delivery and telemetry processing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {jobs.length ? (
            <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
              <Table>
                <TableHead>
                  <TableRow className="hover:bg-transparent odd:bg-transparent">
                    <TableHeaderCell>Job</TableHeaderCell>
                    <TableHeaderCell>Status</TableHeaderCell>
                    <TableHeaderCell>Attempts</TableHeaderCell>
                    <TableHeaderCell>Scheduled</TableHeaderCell>
                    <TableHeaderCell>Processed</TableHeaderCell>
                    <TableHeaderCell>Payload Keys</TableHeaderCell>
                    <TableHeaderCell>Error</TableHeaderCell>
                    <TableHeaderCell>Actions</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium text-[var(--foreground)]">
                            {formatJobTypeLabel(job.type)}
                          </p>
                          <p className="font-mono text-xs text-[var(--muted-foreground)]">
                            {job.id}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge tone={statusTone(job.status)}>{job.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium text-[var(--foreground)]">
                            {job.attempts} / {job.maxAttempts}
                          </p>
                          <p className="text-xs text-[var(--muted-foreground)]">
                            Attempts used
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{formatDateLabel(job.scheduledAt, "Not scheduled")}</TableCell>
                      <TableCell>{formatDateLabel(job.processedAt)}</TableCell>
                      <TableCell>
                        {job.payloadKeys.length ? (
                          <div className="flex flex-wrap gap-1">
                            {job.payloadKeys.map((key) => (
                              <Badge key={key} tone="slate">
                                {key}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-[var(--muted-foreground)]">
                            No visible payload fields
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="max-w-xs text-sm text-[var(--muted-foreground)]">
                          {job.error ?? "No failure recorded."}
                        </p>
                      </TableCell>
                      <TableCell>
                        <JobRetryButton
                          jobId={job.id}
                          jobType={job.type}
                          disabled={!job.retryable}
                          disabledReason={getRetryDisabledReason(job)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--muted)]/25 px-5 py-8 text-sm text-[var(--muted-foreground)]">
              <p className="font-medium text-[var(--foreground)]">
                No recent jobs for this workspace
              </p>
              <p className="mt-2">
                Organization-scoped email delivery and telemetry jobs will appear here after the active tenant triggers async work.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
