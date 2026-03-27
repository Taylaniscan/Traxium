import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { OrganizationAdminInsights } from "@/lib/admin-insights";
import AdminInsightsLoadingPage from "@/app/(app)/admin/insights/loading";
import { AdminActivationSignals } from "@/components/admin/admin-activation-signals";
import { AdminHealthPanel } from "@/components/admin/admin-health-panel";
import { AdminInsightsMetricGrid } from "@/components/admin/admin-insights-metric-grid";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

function createInsights(
  overrides: Partial<OrganizationAdminInsights> = {}
): OrganizationAdminInsights {
  return {
    organization: {
      id: "org-1",
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
      recentErrorEventsLast7Days: 0,
      recentCriticalAdminActionsLast7Days: 0,
      ...overrides.metrics,
    },
    signals: {
      workspaceCreatedAt: new Date("2026-03-20T09:00:00.000Z"),
      firstValueReached: false,
      firstValueAt: null,
      firstValueSource: null,
      lastInviteSentAt: null,
      lastAcceptedInviteAt: null,
      lastSavingCardActivityAt: null,
      ...overrides.signals,
    },
    recentAdminActions: [],
    recentCriticalAdminActions: [],
    ...overrides,
  };
}

describe("admin insights UI", () => {
  it("renders metric cards with activation counts", () => {
    const markup = renderToStaticMarkup(
      React.createElement(AdminInsightsMetricGrid, {
        insights: createInsights(),
      })
    );

    expect(markup).toContain("Total Members");
    expect(markup).toContain("Pending Invites");
    expect(markup).toContain("Invites Sent · 7d");
    expect(markup).toContain("Accepted Invites");
    expect(markup).toContain(">3<");
    expect(markup).toContain(">2<");
  });

  it("renders graceful empty-state labels for missing activation timestamps", () => {
    const markup = renderToStaticMarkup(
      React.createElement(AdminActivationSignals, {
        insights: createInsights(),
      })
    );

    expect(markup).toContain("Not reached yet");
    expect(markup).toContain("No invite activity yet");
    expect(markup).toContain("No accepted invite yet");
    expect(markup).toContain("No portfolio updates yet");
  });

  it("renders a useful empty state when there are no recent critical admin actions", () => {
    const markup = renderToStaticMarkup(
      React.createElement(AdminHealthPanel, {
        insights: createInsights(),
      })
    );

    expect(markup).toContain("Recent Error Events · 7d");
    expect(markup).toContain("Critical Admin Actions · 7d");
    expect(markup).toContain("No recent critical admin actions");
  });

  it("renders the loading skeleton for the admin insights page", () => {
    const markup = renderToStaticMarkup(
      React.createElement(AdminInsightsLoadingPage)
    );

    expect(markup).toContain("Admin Insights");
    expect(markup).toContain("Activation Signals");
    expect(markup).toContain("System Health");
    expect(markup).toContain("Recent Admin Activity");
  });
});
