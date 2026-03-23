import { requireUser } from "@/lib/auth";
import { getNotificationsForUser, getPendingApprovals, getWorkspaceReadiness } from "@/lib/data";
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
  const [notifications, pendingApprovals, readiness] = await Promise.all([
    getNotificationsForUser(user.id),
    getPendingApprovals(user.id, user.organizationId),
    getWorkspaceReadiness(user.organizationId).catch((error) => {
      console.log("Workspace readiness could not be loaded:", error);
      return null;
    }),
  ]);
  const shellNotifications = notifications.map((item) => ({
    id: item.id,
    title: item.title,
    message: item.message
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
      pendingActionsCount={pendingApprovals.length}
    >
      {children}
    </AppShellClient>
  );
}
