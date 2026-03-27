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
const getOrganizationAdminInsightsMock = vi.hoisted(() => vi.fn());
const adminInsightsMetricGridMock = vi.hoisted(() =>
  vi.fn(({ insights }: { insights: { metrics: { totalMembers: number } } }) =>
    React.createElement(
      "div",
      {
        "data-total-members": String(insights.metrics.totalMembers),
      },
      "metric-grid"
    )
  )
);
const adminActivationSignalsMock = vi.hoisted(() =>
  vi.fn(() => React.createElement("div", null, "activation-signals"))
);
const adminHealthPanelMock = vi.hoisted(() =>
  vi.fn(() => React.createElement("div", null, "health-panel"))
);
const adminActivityListMock = vi.hoisted(() =>
  vi.fn(({ events }: { events: unknown[] }) =>
    React.createElement(
      "div",
      {
        "data-activity-count": String(events.length),
      },
      "activity-list"
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

vi.mock("@/lib/admin-insights", () => ({
  getOrganizationAdminInsights: getOrganizationAdminInsightsMock,
}));

vi.mock("@/components/admin/admin-insights-metric-grid", () => ({
  AdminInsightsMetricGrid: adminInsightsMetricGridMock,
}));

vi.mock("@/components/admin/admin-activation-signals", () => ({
  AdminActivationSignals: adminActivationSignalsMock,
}));

vi.mock("@/components/admin/admin-health-panel", () => ({
  AdminHealthPanel: adminHealthPanelMock,
}));

vi.mock("@/components/admin/admin-activity-list", () => ({
  AdminActivityList: adminActivityListMock,
}));

(globalThis as typeof globalThis & { React: typeof React }).React = React;

import AdminInsightsPage from "@/app/(app)/admin/insights/page";

describe("admin insights page", () => {
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
    getOrganizationAdminInsightsMock.mockResolvedValue({
      organization: {
        id: DEFAULT_ORGANIZATION_ID,
        name: "Atlas Procurement",
        slug: "atlas-procurement",
        createdAt: new Date("2026-03-20T09:00:00.000Z"),
        updatedAt: new Date("2026-03-26T12:00:00.000Z"),
      },
      metrics: {
        totalMembers: 3,
        pendingInvites: 2,
        invitesSentLast7Days: 2,
        invitesSentLast30Days: 4,
        acceptedInvites: 3,
        liveSavingCards: 2,
        recentErrorEventsLast7Days: 1,
        recentCriticalAdminActionsLast7Days: 2,
      },
      signals: {
        workspaceCreatedAt: new Date("2026-03-20T09:00:00.000Z"),
        firstValueReached: true,
        firstValueAt: new Date("2026-03-22T08:00:00.000Z"),
        firstValueSource: "saving_card",
        lastInviteSentAt: new Date("2026-03-26T08:30:00.000Z"),
        lastAcceptedInviteAt: new Date("2026-03-26T09:15:00.000Z"),
        lastSavingCardActivityAt: new Date("2026-03-26T10:15:00.000Z"),
      },
      recentAdminActions: [
        {
          id: "audit-1",
          organizationId: DEFAULT_ORGANIZATION_ID,
          eventType: "member.role_changed",
          action: "member.role_changed",
          detail: "Changed Jamie Buyer from Member to Admin.",
          createdAt: new Date("2026-03-26T12:30:00.000Z"),
          actorUserId: "admin-user-1",
          targetUserId: "user-2",
          targetEntityId: "membership-2",
          payload: {
            membershipId: "membership-2",
            previousRole: "MEMBER",
            nextRole: "ADMIN",
          },
          actor: {
            id: "admin-user-1",
            name: "Admin User",
            email: "admin@example.com",
          },
        },
      ],
      recentCriticalAdminActions: [],
    });
  });

  it("renders admin insights for the active organization", async () => {
    const page = await AdminInsightsPage();
    const markup = renderToStaticMarkup(page as React.ReactElement);

    expect(getOrganizationAdminInsightsMock).toHaveBeenCalledWith(
      DEFAULT_ORGANIZATION_ID
    );
    expect(adminInsightsMetricGridMock).toHaveBeenCalledWith(
      expect.objectContaining({
        insights: expect.objectContaining({
          metrics: expect.objectContaining({
            totalMembers: 3,
          }),
        }),
      }),
      undefined
    );
    expect(adminActivityListMock).toHaveBeenCalledWith(
      expect.objectContaining({
        events: expect.arrayContaining([
          expect.objectContaining({
            action: "member.role_changed",
          }),
        ]),
      }),
      undefined
    );
    expect(markup).toContain("Admin Insights");
    expect(markup).toContain("metric-grid");
    expect(markup).toContain("activation-signals");
    expect(markup).toContain("health-panel");
    expect(markup).toContain("activity-list");
    expect(markup).toContain("data-total-members=\"3\"");
    expect(markup).toContain("data-activity-count=\"1\"");
  });

  it("redirects non-admin users away from the admin insights page", async () => {
    canManageOrganizationMembersMock.mockReturnValueOnce(false);

    await expect(AdminInsightsPage()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
    expect(getOrganizationAdminInsightsMock).not.toHaveBeenCalled();
  });
});
