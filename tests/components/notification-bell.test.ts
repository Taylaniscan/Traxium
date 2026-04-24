import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  NotificationPanelContent,
  type ShellNotification,
} from "@/components/layout/notification-bell";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

function createNotification(
  overrides: Partial<ShellNotification> = {}
): ShellNotification {
  return {
    id: "notification-1",
    title: "Phase change approved",
    message: "Resin renegotiation moved to VALIDATED.",
    href: "/saving-cards/card-1",
    read: false,
    ...overrides,
  };
}

describe("notification bell content", () => {
  it("renders unread counts and notification items", () => {
    const markup = renderToStaticMarkup(
      React.createElement(NotificationPanelContent, {
        notifications: [
          createNotification(),
          createNotification({
            id: "notification-2",
            title: "Invitation accepted",
            message: "new.user@example.com joined the workspace.",
            href: "/admin/members",
            read: true,
          }),
        ],
        unreadCount: 1,
      })
    );

    expect(markup).toContain("Notifications");
    expect(markup).toContain("1 unread notification");
    expect(markup).toContain("Phase change approved");
    expect(markup).toContain("Invitation accepted");
    expect(markup).toContain("Unread");
    expect(markup).toContain("Read");
    expect(markup).toContain("Mark all read");
  });

  it("renders the empty state when no notifications exist", () => {
    const markup = renderToStaticMarkup(
      React.createElement(NotificationPanelContent, {
        notifications: [],
        unreadCount: 0,
      })
    );

    expect(markup).toContain("No workflow updates yet");
    expect(markup).toContain(
      "High-value workflow updates will appear here as phase approvals, invitation acceptance, and finance lock changes happen."
    );
  });
});
