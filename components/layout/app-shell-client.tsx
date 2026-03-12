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
import { Button, buttonVariants } from "@/components/ui/button";
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
  notifications: Array<{
    id: string;
    title: string;
    message: string;
  }>;
  pendingActionsCount: number;
  children: React.ReactNode;
};

export function AppShellClient({ user, notifications, pendingActionsCount, children }: AppShellClientProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const initials = useMemo(() => {
    return user.name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [user.name]);

  return (
    <div className="min-h-screen bg-[var(--background)] lg:flex">
      <aside
        className={cn(
          "border-b border-[var(--border)] bg-white transition-[width] duration-200 lg:min-h-screen lg:flex-shrink-0 lg:border-b-0 lg:border-r",
          collapsed ? "lg:w-[92px]" : "lg:w-[288px]"
        )}
      >
        <div className="flex h-full flex-col px-4 py-6 lg:sticky lg:top-0 lg:h-screen">
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
              onClick={() => setCollapsed((value) => !value)}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>

          <nav className="mt-8 space-y-1">
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
                    active ? "bg-[var(--muted)] text-[var(--foreground)]" : "text-[var(--foreground)] hover:bg-[var(--muted)]",
                    collapsed ? "justify-center lg:px-0" : "justify-between"
                  )}
                >
                  <span className={cn("flex items-center gap-3", collapsed && "justify-center")}>
                    <Icon
                      className={cn(
                        "h-4 w-4 transition",
                        active ? "text-[var(--primary)]" : "text-[var(--muted-foreground)] group-hover:text-[var(--primary)]"
                      )}
                    />
                    <span className={cn(collapsed && "lg:hidden")}>{item.label}</span>
                  </span>
                  {item.href === "/open-actions" && pendingActionsCount > 0 && collapsed ? (
                    <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-red-500" aria-label={`${pendingActionsCount} pending actions`} />
                  ) : null}
                  <span className={cn("flex items-center gap-2", collapsed && "hidden")}>
                    {item.href === "/open-actions" && pendingActionsCount > 0 ? (
                      <span className="h-2.5 w-2.5 rounded-full bg-red-500" aria-label={`${pendingActionsCount} pending actions`} />
                    ) : null}
                    <ArrowUpRight
                      className={cn("h-4 w-4 transition", active ? "text-[var(--primary)]" : "text-transparent group-hover:text-[var(--primary)]")}
                    />
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className={cn("mt-8 rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4", collapsed && "lg:hidden")}>
            <div className="mb-2 flex items-center gap-2">
              <Bell className="h-4 w-4 text-[var(--primary)]" />
              <p className="text-sm font-semibold">Workflow Feed</p>
            </div>
            <div className="space-y-2">
              {notifications.length ? (
                notifications.slice(0, 3).map((item) => (
                  <div key={item.id} className="rounded-xl bg-white p-3 text-xs">
                    <p className="font-semibold text-[var(--foreground)]">{item.title}</p>
                    <p className="mt-1 text-[var(--muted-foreground)]">{item.message}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-[var(--muted-foreground)]">No open workflow notifications.</p>
              )}
            </div>
          </div>

          <SidebarUserInfo user={user} collapsed={collapsed} initials={initials} />
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-6 lg:p-8">{children}</main>
    </div>
  );
}

function SidebarUserInfo({
  user,
  collapsed,
  initials
}: {
  user: AppShellClientProps["user"];
  collapsed: boolean;
  initials: string;
}) {
  return (
    <div className="mt-auto border-t border-[var(--border)] pt-4">
      <div
        title={collapsed ? user.name : undefined}
        className={cn(
          "rounded-2xl bg-[var(--background)]",
          collapsed ? "flex items-center justify-center px-0 py-3" : "border border-[var(--border)] p-4"
        )}
      >
        <div className={cn("flex items-start gap-3", collapsed && "justify-center")}>
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[var(--secondary)] text-sm font-semibold text-[var(--primary)]">
            {initials || <UserRound className="h-5 w-5" />}
          </div>
          <div className={cn("min-w-0", collapsed && "hidden")}>
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-[var(--muted-foreground)]">{roleLabels[user.role]}</p>
            <p className="mt-1 truncate text-xs text-[var(--muted-foreground)]">{user.email}</p>
            <div className="mt-3 flex gap-2">
              <Link href="/profile" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "flex-1 justify-center")}>
                Profile
              </Link>
              <form action="/logout" method="post" className="flex-1">
                <Button type="submit" variant="secondary" size="sm" className="w-full justify-center">
                  <LogOut className="mr-1 h-3.5 w-3.5" />
                  Logout
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
