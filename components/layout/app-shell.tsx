import { requireUser } from "@/lib/auth";
import { getNotificationsForUser, getPendingApprovals } from "@/lib/data";
import { AppShellClient } from "@/components/layout/app-shell-client";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [notifications, pendingApprovals] = await Promise.all([
    getNotificationsForUser(user.id),
    getPendingApprovals(user.id, user.organizationId),
  ]);

  return (
    <AppShellClient
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }}
      notifications={notifications.map((item) => ({
        id: item.id,
        title: item.title,
        message: item.message
      }))}
      pendingActionsCount={pendingApprovals.length}
    >
      {children}
    </AppShellClient>
  );
}
