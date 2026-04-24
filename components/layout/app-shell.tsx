import { requireUser } from "@/lib/auth";
import { getPendingApprovals, getWorkspaceReadiness } from "@/lib/data";
import { getNotificationFeedForUser } from "@/lib/notifications";
import { captureException } from "@/lib/observability";
import { AppShellClient } from "@/components/layout/app-shell-client";

type WorkspaceReadiness = Awaited<ReturnType<typeof getWorkspaceReadiness>>;

function buildWorkspaceSummary(readiness: WorkspaceReadiness | null) {
  if (!readiness) {
    return null;
  }

  return {
    name: readiness.workspace.name,
  };
}

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [notificationFeedResult, pendingApprovalsResult, readinessResult] =
    await Promise.allSettled([
      getNotificationFeedForUser(user.id, user.organizationId),
      getPendingApprovals(user.id, user.organizationId),
      getWorkspaceReadiness(user.organizationId),
    ]);

  const notificationFeed =
    notificationFeedResult.status === "fulfilled"
      ? notificationFeedResult.value
      : { items: [], unreadCount: 0 };
  const pendingApprovals =
    pendingApprovalsResult.status === "fulfilled" ? pendingApprovalsResult.value : [];
  const readiness = readinessResult.status === "fulfilled" ? readinessResult.value : null;

  if (notificationFeedResult.status === "rejected") {
    captureException(notificationFeedResult.reason, {
      event: "app_shell.notifications_load_failed",
      route: "app_shell",
      organizationId: user.organizationId,
      userId: user.id,
    });
  }

  if (pendingApprovalsResult.status === "rejected") {
    captureException(pendingApprovalsResult.reason, {
      event: "app_shell.pending_approvals_load_failed",
      route: "app_shell",
      organizationId: user.organizationId,
      userId: user.id,
    });
  }

  if (readinessResult.status === "rejected") {
    captureException(readinessResult.reason, {
      event: "app_shell.readiness_load_failed",
      route: "app_shell",
      organizationId: user.organizationId,
      userId: user.id,
    });
  }

  const shellNotifications = notificationFeed.items.map((item) => ({
    id: item.id,
    title: item.title,
    message: item.message,
    href: item.href ?? null,
    read: Boolean(item.readAt),
  }));

  return (
    <AppShellClient
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }}
      workspace={buildWorkspaceSummary(readiness)}
      notifications={shellNotifications}
      unreadNotificationCount={notificationFeed.unreadCount}
      pendingActionsCount={pendingApprovals.length}
    >
      {children}
    </AppShellClient>
  );
}
