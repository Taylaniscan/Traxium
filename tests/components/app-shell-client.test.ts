/* eslint-disable react/no-children-prop */
import React from "react";
import { Role } from "@prisma/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const usePathnameMock = vi.hoisted(() => vi.fn(() => "/dashboard"));
const routerPushMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: usePathnameMock,
  useRouter: () => ({
    push: routerPushMock,
  }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    prefetch: _prefetch,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    prefetch?: boolean;
  }) => React.createElement("a", { href, ...props }, children),
}));

(globalThis as typeof globalThis & { React: typeof React }).React = React;

import {
  AppShellClient,
  SidebarWorkspaceAccount,
} from "@/components/layout/app-shell-client";

describe("app shell workspace account", () => {
  it("does not render billing as a main sidebar nav item", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        AppShellClient,
        {
          user: {
            id: "user-1",
            name: "Admin User",
            email: "admin@example.com",
            role: Role.HEAD_OF_GLOBAL_PROCUREMENT,
          },
          workspace: {
            name: "Atlas Procurement",
          },
          notifications: [],
          unreadNotificationCount: 0,
          pendingActionsCount: 0,
          children: React.createElement("div", null, "page"),
        }
      )
    );

    expect(markup).not.toContain("href=\"/settings/billing\"");
    expect(markup).not.toContain(">Billing<");
  });

  it("keeps workspace settings visible in the main sidebar", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        AppShellClient,
        {
          user: {
            id: "user-1",
            name: "Casey Buyer",
            email: "casey@example.com",
            role: Role.GLOBAL_CATEGORY_LEADER,
          },
          workspace: {
            name: "Atlas Procurement",
          },
          notifications: [],
          unreadNotificationCount: 0,
          pendingActionsCount: 0,
          children: React.createElement("div", null, "page"),
        }
      )
    );

    expect(markup).toContain("href=\"/admin/settings\"");
    expect(markup).toContain("Workspace Settings");
  });

  it("renders an always-visible account card", () => {
    const markup = renderToStaticMarkup(
      React.createElement(SidebarWorkspaceAccount, {
        user: {
          id: "user-1",
          name: "Casey Buyer",
          email: "casey@example.com",
          role: Role.GLOBAL_CATEGORY_LEADER,
        },
        workspace: {
          name: "Atlas Procurement",
        },
        collapsed: false,
        initials: "CB",
      })
    );

    expect(markup).toContain("Atlas Procurement");
    expect(markup).toContain("Casey Buyer");
    expect(markup).toContain("casey@example.com");
    expect(markup).toContain("Category Owner");
  });

  it("renders a visible logout button without any hidden menu dependency", () => {
    const markup = renderToStaticMarkup(
      React.createElement(SidebarWorkspaceAccount, {
        user: {
          id: "user-1",
          name: "Casey Buyer",
          email: "casey@example.com",
          role: Role.GLOBAL_CATEGORY_LEADER,
        },
        workspace: {
          name: "Atlas Procurement",
        },
        collapsed: false,
        initials: "CB",
      })
    );

    expect(markup).toContain("action=\"/logout\"");
    expect(markup).toContain("method=\"post\"");
    expect(markup).toContain("Sign out");
    expect(markup).not.toContain("workspace-account-panel");
    expect(markup).not.toContain("aria-haspopup=\"menu\"");
  });

  it("keeps logout directly accessible in collapsed mode", () => {
    const markup = renderToStaticMarkup(
      React.createElement(SidebarWorkspaceAccount, {
        user: {
          id: "user-1",
          name: "Casey Buyer",
          email: "casey@example.com",
          role: Role.GLOBAL_CATEGORY_LEADER,
        },
        workspace: {
          name: "Atlas Procurement",
        },
        collapsed: true,
        initials: "CB",
      })
    );

    expect(markup).toContain("action=\"/logout\"");
    expect(markup).toContain("aria-label=\"Sign out\"");
  });
});
