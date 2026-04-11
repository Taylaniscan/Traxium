import React from "react";
import { Role } from "@prisma/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const usePathnameMock = vi.hoisted(() => vi.fn(() => "/dashboard"));

vi.mock("next/navigation", () => ({
  usePathname: usePathnameMock,
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

import { SidebarWorkspaceAccount } from "@/components/layout/app-shell-client";

describe("app shell workspace account", () => {
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
