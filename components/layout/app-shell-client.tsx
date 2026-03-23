"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
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
  PanelsTopLeft,
  Settings,
  Table2,
  UserRound
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
  { href: "/open-actions", label: "Open Actions", icon: Bell }
];

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

export function AppShellClient({ user, workspace, notifications, pendingActionsCount, children }: AppShellClientProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);

  const initials = useMemo(() => {
    return user.name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [user.name]);

  function toggleSidebar() {
    setCollapsed((value) => {
      const next = !value;

      if (next) {
        setWorkspaceOpen(false);
      }

      return next;
    });
  }

  function toggleWorkspace() {
    if (collapsed) {
      setCollapsed(false);
      setWorkspaceOpen(true);
      return;
    }

    setWorkspaceOpen((value) => !value);
  }

  return (
    <div className="min-h-screen bg-[var(--background)] lg:flex">
      <aside
        className={cn(
          "border-b border-[var(--border)] bg-white transition-[width] duration-200 lg:flex-shrink-0 lg:border-b-0 lg:border-r lg:sticky lg:top-0 lg:h-screen lg:min-h-0 lg:overflow-hidden",
          collapsed ? "lg:w-[92px]" : "lg:w-[288px]"
        )}
      >
        <div className="flex h-full min-h-0 flex-col px-4 py-6">
          <div className="flex items-start justify-between gap-3">
            <div className={cn("min-w-0", collapsed && "lg:hidden")}>
              <h1 className="text-[28px] font-semibold tracking-tight">{APP_NAME}</h1>
            </div>
            <div className={cn("hidden h-12 w-12 items-center justify-center rounded-2xl bg-[var(--muted)] text-lg font-semibold lg:flex", !collapsed && "lg:hidden")}>
              {APP_NAME.slice(0, 2).toUpperCase()}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="hidden flex-shrink-0 lg:inline-flex"
              onClick={toggleSidebar}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>

          <div className="mt-8 flex min-h-0 flex-1 flex-col overflow-y-auto pr-1">
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "group relative flex items-center rounded-xl px-3 py-3 text-[13px] font-medium transition",
                      active
                        ? "bg-[var(--muted)] text-[var(--foreground)]"
                        : "text-[var(--foreground)] hover:bg-[var(--muted)]",
                      collapsed ? "justify-center lg:px-0" : "justify-between"
                    )}
                  >
                    <span className={cn("flex items-center gap-3", collapsed && "justify-center")}>
                      <Icon
                        className={cn(
                          "h-4 w-4 transition",
                          active
                            ? "text-[var(--primary)]"
                            : "text-[var(--muted-foreground)] group-hover:text-[var(--primary)]"
                        )}
                      />
                      <span className={cn(collapsed && "lg:hidden")}>{item.label}</span>
                    </span>
                    {item.href === "/open-actions" && pendingActionsCount > 0 && collapsed ? (
                      <span
                        className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-red-500"
                        aria-label={`${pendingActionsCount} pending actions`}
                      />
                    ) : null}
                    <span className={cn("flex items-center gap-2", collapsed && "hidden")}>
                      {item.href === "/open-actions" && pendingActionsCount > 0 ? (
                        <span className="h-2.5 w-2.5 rounded-full bg-red-500" aria-label={`${pendingActionsCount} pending actions`} />
                      ) : null}
                      <ArrowUpRight
                        className={cn(
                          "h-4 w-4 transition",
                          active ? "text-[var(--primary)]" : "text-transparent group-hover:text-[var(--primary)]"
                        )}
                      />
                    </span>
                  </Link>
                );
              })}
            </nav>

            <div className={cn("mt-8 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--background)]", collapsed && "lg:hidden")}>
              <div className="border-b border-[var(--border)] px-4 py-3">
                <div className="mb-1.5 flex items-center gap-2">
                  <Bell className="h-4 w-4 text-[var(--primary)]" />
                  <p className="text-sm font-semibold">Workflow Feed</p>
                </div>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {notifications.length ? `${notifications.length} notification${notifications.length === 1 ? "" : "s"}` : "No workflow updates"}
                </p>
              </div>
              <div className="space-y-2 px-4 py-3">
                {notifications.length ? (
                  notifications.slice(0, 5).map((item) => (
                    <div key={item.id} className="rounded-xl bg-white p-2.5 text-xs shadow-[inset_0_0_0_1px_rgba(17,24,39,0.04)]">
                      <p className="font-semibold text-[var(--foreground)]">{item.title}</p>
                      <p className="mt-1 text-[var(--muted-foreground)]">{item.message}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[var(--muted-foreground)]">No open workflow notifications.</p>
                )}
              </div>
            </div>
          </div>

          <SidebarWorkspaceAccount
            user={user}
            workspace={workspace}
            collapsed={collapsed}
            initials={initials}
            open={workspaceOpen}
            onToggle={toggleWorkspace}
          />
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-6 lg:p-8">{children}</main>
    </div>
  );
}

function SidebarWorkspaceAccount({
  user,
  workspace,
  collapsed,
  initials,
  open,
  onToggle,
}: {
  user: AppShellClientProps["user"];
  workspace: AppShellClientProps["workspace"];
  collapsed: boolean;
  initials: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={cn("border-t border-[var(--border)] pt-4", collapsed ? "mt-auto" : "mt-4")}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        title={collapsed ? workspace?.name ?? user.name : undefined}
        className={cn(
          "w-full rounded-2xl text-left transition",
          collapsed
            ? "flex items-center justify-center border border-transparent px-0 py-3 hover:border-[var(--border)] hover:bg-[var(--muted)]/60"
            : "group flex w-full items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--background)] px-3 py-3 hover:border-[var(--primary)]/30 hover:bg-[var(--muted)]/55"
        )}
      >
        <div className={cn("flex w-full items-center gap-3", collapsed && "justify-center")}>
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[var(--secondary)] text-sm font-semibold text-[var(--primary)]">
            {initials || <UserRound className="h-5 w-5" />}
          </div>
          <div className={cn("min-w-0 flex-1", collapsed && "hidden")}>
            <p className="truncate text-sm font-semibold text-[var(--foreground)]">
              {user.name}
            </p>
            <p className="truncate text-xs text-[var(--muted-foreground)]">
              {workspace?.name ?? roleLabels[user.role]}
            </p>
          </div>
          <ChevronRight
            className={cn(
              "h-4 w-4 flex-shrink-0 text-[var(--muted-foreground)] transition-transform",
              open && "rotate-90",
              collapsed && "hidden"
            )}
          />
        </div>
      </button>

      {!collapsed && open ? (
        <div className="mt-2 overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
          <div className="border-b border-[var(--border)] bg-[var(--muted)]/30 px-4 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
              Workspace
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-[var(--foreground)]">
              {workspace?.name ?? "Workspace"}
            </p>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[var(--secondary)] text-sm font-semibold text-[var(--primary)]">
                {initials || <UserRound className="h-5 w-5" />}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--foreground)]">{user.name}</p>
                <p className="truncate text-xs text-[var(--muted-foreground)]">{roleLabels[user.role]}</p>
              </div>
            </div>
          </div>

          <div className="space-y-1 px-4 py-3.5">
            <Link
              href="/admin"
              className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--muted)]"
              title="Workspace and user settings"
            >
              <span className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-[var(--muted-foreground)]" />
                Settings
              </span>
              <ChevronRight className="h-4 w-4 text-[var(--muted-foreground)]" />
            </Link>
            <form action="/logout" method="post">
              <button
                type="submit"
                className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-rose-50 hover:text-rose-700"
              >
                <span className="flex items-center gap-2">
                  <LogOut className="h-4 w-4 text-[var(--muted-foreground)]" />
                  Sign out
                </span>
                <ChevronRight className="h-4 w-4 text-[var(--muted-foreground)]" />
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
