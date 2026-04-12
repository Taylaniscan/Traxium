"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Role } from "@prisma/client";
import {
  ArrowUpRight,
  Bell,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  KanbanSquare,
  LayoutDashboard,
  LogOut,
  Mail,
  PanelsTopLeft,
  Settings,
  Table2,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { APP_NAME, roleLabels } from "@/lib/constants";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/saving-cards", label: "Saving Cards", icon: Table2 },
  { href: "/kanban", label: "Kanban", icon: KanbanSquare },
  { href: "/timeline", label: "Timeline", icon: CalendarRange },
  { href: "/command-center", label: "Command Center", icon: PanelsTopLeft },
  { href: "/reports", label: "Reports", icon: FileSpreadsheet },
  { href: "/admin", label: "Settings", icon: Settings },
  { href: "/open-actions", label: "Open Actions", icon: Bell },
] as const;

type AppShellClientProps = {
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
  };
  workspace: {
    name: string;
  } | null;
  notifications: Array<{
    id: string;
    title: string;
    message: string;
  }>;
  pendingActionsCount: number;
  children: React.ReactNode;
};

export function AppShellClient({
  user,
  workspace,
  notifications,
  pendingActionsCount: _pendingActionsCount,
  children,
}: AppShellClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [pendingApprovalCount, setPendingApprovalCount] = useState<number | null>(null);
  const initials = useMemo(() => {
    return user.name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [user.name]);

  useEffect(() => {
    let active = true;

    async function loadPendingApprovals() {
      try {
        const response = await fetch("/api/pending-approvals", {
          credentials: "same-origin",
        });

        if (!response.ok) {
          if (active) {
            setPendingApprovalCount(0);
          }
          return;
        }

        const payload = (await response.json()) as unknown;
        const nextCount = Array.isArray(payload)
          ? payload.length
          : typeof payload === "object" &&
              payload !== null &&
              "count" in payload &&
              typeof payload.count === "number"
            ? payload.count
            : 0;

        if (active) {
          setPendingApprovalCount(nextCount);
        }
      } catch {
        if (active) {
          setPendingApprovalCount(0);
        }
      }
    }

    void loadPendingApprovals();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const target = event.target;

      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case "n":
          router.push("/saving-cards/new");
          break;
        case "d":
          router.push("/dashboard");
          break;
        case "k":
          router.push("/kanban");
          break;
        case "o":
          router.push("/open-actions");
          break;
        default:
          return;
      }

      event.preventDefault();
    }

    window.addEventListener("keydown", handleKeydown);

    return () => {
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [router]);

  const visiblePendingApprovalCount = pendingApprovalCount ?? 0;
  const pendingApprovalBadge = visiblePendingApprovalCount > 9 ? "9+" : null;

  return (
    <div className="min-h-screen bg-[var(--background)] lg:flex">
      <aside
        className={cn(
          "border-b border-[var(--border)] bg-white lg:sticky lg:top-0 lg:h-screen lg:flex-shrink-0 lg:border-b-0 lg:border-r",
          collapsed ? "lg:w-[104px]" : "lg:w-[304px]"
        )}
      >
        <div className="flex h-full min-h-0 flex-col px-4 py-6">
          <div className="flex items-start justify-between gap-3">
            <div className={cn("min-w-0", collapsed && "lg:hidden")}>
              <h1 className="text-[28px] font-semibold tracking-tight">
                {APP_NAME}
              </h1>
            </div>
            <div
              className={cn(
                "hidden h-12 w-12 items-center justify-center rounded-2xl bg-[var(--muted)] text-lg font-semibold lg:flex",
                !collapsed && "lg:hidden"
              )}
            >
              {APP_NAME.slice(0, 2).toUpperCase()}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="hidden flex-shrink-0 lg:inline-flex"
              onClick={() => setCollapsed((value) => !value)}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="mt-8 flex min-h-0 flex-1 flex-col overflow-y-auto pr-1">
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "group relative flex items-center border-l-[3px] px-3 py-3 text-[13px] font-medium transition",
                      active
                        ? "rounded-l-none rounded-r-[8px] border-l-[var(--primary)] bg-[rgba(99,102,241,0.08)] text-[var(--foreground)]"
                        : "rounded-l-none rounded-r-[8px] border-l-transparent bg-transparent text-[var(--foreground)] hover:bg-[rgba(99,102,241,0.05)]",
                      collapsed ? "justify-center lg:px-0" : "justify-between"
                    )}
                  >
                    <span
                      className={cn(
                        "flex items-center gap-3",
                        collapsed && "justify-center"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 transition",
                          active
                            ? "text-[var(--primary)]"
                            : "text-[var(--muted-foreground)] group-hover:text-[var(--primary)]"
                        )}
                      />
                      <span className={cn(collapsed && "lg:hidden")}>
                        {item.label}
                      </span>
                    </span>
                    {item.href === "/open-actions" && visiblePendingApprovalCount > 0 && collapsed ? (
                      <span
                        className={cn(
                          "absolute right-3 top-3 inline-flex items-center justify-center rounded-full bg-[#f43f5e] text-[10px] font-semibold text-white",
                          pendingApprovalBadge ? "min-w-5 px-1.5 py-0.5" : "h-1.5 w-1.5"
                        )}
                        aria-label={`${visiblePendingApprovalCount} pending actions`}
                      >
                        {pendingApprovalBadge}
                      </span>
                    ) : null}
                    <span className={cn("flex items-center gap-2", collapsed && "hidden")}>
                      {item.href === "/open-actions" && visiblePendingApprovalCount > 0 ? (
                        <span
                          className={cn(
                            "inline-flex items-center justify-center rounded-full bg-[#f43f5e] text-[10px] font-semibold text-white",
                            pendingApprovalBadge ? "min-w-5 px-1.5 py-0.5" : "h-1.5 w-1.5"
                          )}
                          aria-label={`${visiblePendingApprovalCount} pending actions`}
                        >
                          {pendingApprovalBadge}
                        </span>
                      ) : null}
                      <ArrowUpRight
                        className={cn(
                          "h-4 w-4 transition",
                          active
                            ? "text-[var(--primary)]"
                            : "text-transparent group-hover:text-[var(--primary)]"
                        )}
                      />
                    </span>
                  </Link>
                );
              })}
            </nav>

            <div
              className={cn(
                "mt-8 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--background)]",
                collapsed && "lg:hidden"
              )}
            >
              <div className="border-b border-[var(--border)] px-4 py-3">
                <div className="mb-1.5 flex items-center gap-2">
                  <Bell className="h-4 w-4 text-[var(--primary)]" />
                  <p className="text-sm font-semibold">Workflow Feed</p>
                </div>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {notifications.length
                    ? `${notifications.length} notification${notifications.length === 1 ? "" : "s"}`
                    : "No workflow updates"}
                </p>
              </div>
              <div className="space-y-2 px-4 py-3">
                {notifications.length ? (
                  notifications.slice(0, 5).map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl bg-white p-2.5 text-xs shadow-[inset_0_0_0_1px_rgba(17,24,39,0.04)]"
                    >
                      <p className="font-semibold text-[var(--foreground)]">
                        {item.title}
                      </p>
                      <p className="mt-1 text-[var(--muted-foreground)]">
                        {item.message}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[var(--muted-foreground)]">
                    No open workflow notifications.
                  </p>
                )}
              </div>
            </div>
          </div>

          <SidebarWorkspaceAccount
            user={user}
            workspace={workspace}
            collapsed={collapsed}
            initials={initials}
          />
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-6 lg:p-8">{children}</main>
    </div>
  );
}

export function SidebarWorkspaceAccount({
  user,
  workspace,
  collapsed,
  initials,
}: {
  user: AppShellClientProps["user"];
  workspace: AppShellClientProps["workspace"];
  collapsed: boolean;
  initials: string;
}) {
  return (
    <div className="mt-4 border-t border-[var(--border)] pt-4">
      <div
        className={cn(
          "rounded-2xl border border-[var(--border)] bg-[var(--background)]",
          collapsed ? "px-2 py-3" : "px-4 py-4"
        )}
      >
        <div
          className={cn(
            "flex items-start gap-3",
            collapsed && "flex-col items-center text-center"
          )}
        >
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[var(--secondary)] text-sm font-semibold text-[var(--primary)]">
            {initials || <UserRound className="h-5 w-5" />}
          </div>
          <div className={cn("min-w-0 flex-1", collapsed && "w-full")}>
            <p className="truncate text-sm font-semibold text-[var(--foreground)]">
              {workspace?.name ?? "Workspace"}
            </p>
            <p className="truncate text-xs text-[var(--muted-foreground)]">
              {user.name}
            </p>
            {!collapsed ? (
              <div className="mt-2 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{user.email}</span>
              </div>
            ) : null}
            {!collapsed ? (
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                {roleLabels[user.role]}
              </p>
            ) : null}
          </div>
        </div>

        <div
          className={cn(
            "mt-4 flex gap-2",
            collapsed ? "flex-col items-stretch" : "flex-col"
          )}
        >
          <Link
            href="/admin"
            className={cn(
              "inline-flex items-center justify-center rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2",
              collapsed && "px-0"
            )}
            title={collapsed ? "Settings" : undefined}
          >
            {collapsed ? <Settings className="h-4 w-4" /> : "Settings"}
          </Link>

          <form action="/logout" method="post">
            <button
              type="submit"
              className={cn(
                "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2",
                collapsed && "px-0"
              )}
              aria-label="Sign out"
              title={collapsed ? "Sign out" : undefined}
            >
              <LogOut className="h-4 w-4" />
              {!collapsed ? "Sign out" : null}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
