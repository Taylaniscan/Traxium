import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MembershipStatus, OrganizationRole, Role } from "@prisma/client";

import {
  DEFAULT_ORGANIZATION_ID,
  createSessionUser,
} from "../helpers/security-fixtures";

const redirectMock = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  })
);
const requireOrganizationMock = vi.hoisted(() => vi.fn());
const canManageOrganizationMembersMock = vi.hoisted(() => vi.fn());
const getOrganizationJobsOverviewMock = vi.hoisted(() => vi.fn());
const adminJobsPanelMock = vi.hoisted(() =>
  vi.fn(
    ({
      jobs,
      summary,
    }: {
      jobs: unknown[];
      summary: { failed: number };
    }) =>
      React.createElement(
        "div",
        {
          "data-job-count": String(jobs.length),
          "data-failed-count": String(summary.failed),
        },
        "jobs-panel"
      )
  )
);

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/auth", () => ({
  requireOrganization: requireOrganizationMock,
}));

vi.mock("@/lib/organizations", () => ({
  canManageOrganizationMembers: canManageOrganizationMembersMock,
}));

vi.mock("@/lib/jobs", () => ({
  getOrganizationJobsOverview: getOrganizationJobsOverviewMock,
}));

vi.mock("@/components/admin/admin-jobs-panel", () => ({
  AdminJobsPanel: adminJobsPanelMock,
}));

(globalThis as typeof globalThis & { React: typeof React }).React = React;

import AdminJobsPage from "@/app/(app)/admin/jobs/page";

describe("admin jobs page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOrganizationMock.mockResolvedValue(
      createSessionUser({
        role: Role.HEAD_OF_GLOBAL_PROCUREMENT,
        activeOrganization: {
          membershipId: "membership-admin",
          organizationId: DEFAULT_ORGANIZATION_ID,
          membershipRole: OrganizationRole.ADMIN,
          membershipStatus: MembershipStatus.ACTIVE,
        },
      })
    );
    canManageOrganizationMembersMock.mockReturnValue(true);
    getOrganizationJobsOverviewMock.mockResolvedValue({
      summary: {
        queued: 2,
        running: 1,
        failed: 1,
        completed: 4,
        canceled: 0,
      },
      jobs: [
        {
          id: "job-1",
          type: "auth_email.invitation_delivery",
        },
      ],
    });
  });

  it("renders tenant-scoped job health for the active organization", async () => {
    const page = await AdminJobsPage();
    const markup = renderToStaticMarkup(page as React.ReactElement);

    expect(getOrganizationJobsOverviewMock).toHaveBeenCalledWith(
      DEFAULT_ORGANIZATION_ID,
      25
    );
    expect(adminJobsPanelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: expect.objectContaining({
          failed: 1,
        }),
        jobs: expect.arrayContaining([
          expect.objectContaining({
            id: "job-1",
          }),
        ]),
      }),
      undefined
    );
    expect(markup).toContain("Job Health");
    expect(markup).toContain("jobs-panel");
    expect(markup).toContain("Worker Commands");
    expect(markup).toContain("separate worker process");
    expect(markup).toContain("npm run jobs:worker");
    expect(markup).toContain("npm run jobs:worker:once");
    expect(markup).toContain("npm run jobs:worker:healthcheck");
    expect(markup).toContain("data-job-count=\"1\"");
    expect(markup).toContain("data-failed-count=\"1\"");
  });

  it("redirects non-admin users away from the jobs page", async () => {
    canManageOrganizationMembersMock.mockReturnValueOnce(false);

    await expect(AdminJobsPage()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
    expect(getOrganizationJobsOverviewMock).not.toHaveBeenCalled();
  });
});
