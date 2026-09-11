import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/admin/job-retry-button", () => ({
  JobRetryButton: ({
    disabled,
  }: {
    disabled?: boolean;
  }) =>
    React.createElement(
      "button",
      {
        type: "button",
        disabled: Boolean(disabled),
      },
      "Retry"
    ),
}));

import AdminJobsLoadingPage from "@/app/(app)/admin/jobs/loading";
import { AdminJobsPanel } from "@/components/admin/admin-jobs-panel";
import type {
  OrganizationAdminJob,
  OrganizationJobStatusSummary,
} from "@/lib/jobs";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

function createSummary(
  overrides: Partial<OrganizationJobStatusSummary> = {}
): OrganizationJobStatusSummary {
  return {
    queued: 2,
    running: 1,
    failed: 1,
    completed: 4,
    canceled: 0,
    ...overrides,
  };
}

function createJob(
  overrides: Partial<OrganizationAdminJob> = {}
): OrganizationAdminJob {
  return {
    id: "job-1",
    type: "auth_email.invitation_delivery",
    status: "FAILED",
    attempts: 2,
    maxAttempts: 3,
    scheduledAt: new Date("2026-03-27T09:00:00.000Z"),
    reservedAt: null,
    processedAt: new Date("2026-03-27T09:03:00.000Z"),
    error: "SMTP delivery timed out.",
    createdAt: new Date("2026-03-27T09:00:00.000Z"),
    updatedAt: new Date("2026-03-27T09:03:00.000Z"),
    payloadKeys: ["invitationId", "sendKind"],
    retryable: true,
    ...overrides,
  };
}

describe("admin jobs UI", () => {
  it("renders summary cards and recent job rows", () => {
    const markup = renderToStaticMarkup(
      React.createElement(AdminJobsPanel, {
        summary: createSummary(),
        jobs: [createJob()],
      })
    );

    expect(markup).toContain("Queued");
    expect(markup).toContain("Processing");
    expect(markup).toContain("Failed");
    expect(markup).toContain("Completed");
    expect(markup).toContain("Separate worker dependency");
    expect(markup).toContain("jobs:worker:healthcheck");
    expect(markup).toContain("Recent Jobs");
    expect(markup).toContain("Auth Email / Invitation Delivery");
    expect(markup).toContain("invitationId");
    expect(markup).toContain("sendKind");
    expect(markup).toContain("Retry");
  });

  it("renders an empty state when there are no recent jobs", () => {
    const markup = renderToStaticMarkup(
      React.createElement(AdminJobsPanel, {
        summary: createSummary({
          queued: 0,
          running: 0,
          failed: 0,
          completed: 0,
        }),
        jobs: [],
      })
    );

    expect(markup).toContain("No recent jobs for this workspace");
    expect(markup).toContain(
      "Organization-scoped email delivery and telemetry jobs will appear here"
    );
    expect(markup).toContain("verify the separate worker process first");
  });

  it("renders the loading skeleton for the admin jobs page", () => {
    const markup = renderToStaticMarkup(
      React.createElement(AdminJobsLoadingPage)
    );

    expect(markup).toContain("Job Health");
    expect(markup).toContain("Recent Jobs");
    expect(markup).toContain("Worker Commands");
  });
});
