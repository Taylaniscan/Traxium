import { requireUser } from "@/lib/auth";
import { getNotificationsForUser, getPendingApprovals, getWorkspaceReadiness } from "@/lib/data";
import { AppShellClient } from "@/components/layout/app-shell-client";

type WorkspaceReadiness = Awaited<ReturnType<typeof getWorkspaceReadiness>>;

function formatList(items: string[]) {
  if (!items.length) {
    return "";
  }

  if (items.length === 1) {
    return items[0];
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function formatDateLabel(value: Date | null) {
  if (!value) {
    return "No portfolio updates yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function buildSetupNotification(readiness: WorkspaceReadiness | null) {
  if (!readiness) {
    return null;
  }

  const workspaceName = readiness.workspace.name;
  const liveFootprint =
    readiness.counts.savingCards > 0
      ? `${readiness.counts.savingCards} live saving card${readiness.counts.savingCards === 1 ? "" : "s"}`
      : "no live saving cards yet";

  if (!readiness.isMasterDataReady) {
    return {
      id: "workspace-setup",
      title: `${workspaceName} setup in progress`,
      message: `${readiness.counts.users} users, ${liveFootprint}. Add ${formatList(readiness.missingCoreSetup)} in Settings to standardize card creation.`,
    };
  }

  if (!readiness.isWorkflowReady) {
    return {
      id: "workflow-setup",
      title: `${workspaceName} approval controls incomplete`,
      message: `Assign ${formatList(readiness.missingWorkflowCoverage)} coverage in Settings to complete approval routing for this workspace.`,
    };
  }

  return {
    id: "workspace-status",
    title: `${workspaceName} workspace ready`,
    message: `${readiness.counts.users} users, ${liveFootprint}, ${readiness.coverage.overallPercent}% setup completeness. Last portfolio update ${formatDateLabel(readiness.activity.lastPortfolioUpdateAt)}.`,
  };
}

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [notifications, pendingApprovals] = await Promise.all([
    getNotificationsForUser(user.id),
    getPendingApprovals(user.id, user.organizationId),
  ]);
  const shellNotifications = notifications.map((item) => ({
    id: item.id,
    title: item.title,
    message: item.message
  }));

  if (!shellNotifications.length) {
    const readiness = await getWorkspaceReadiness(user.organizationId).catch((error) => {
      console.log("Workspace readiness could not be loaded:", error);
      return null;
    });
    const setupNotification = buildSetupNotification(readiness);

    if (setupNotification) {
      shellNotifications.push(setupNotification);
    }
  }

  return (
    <AppShellClient
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }}
      notifications={shellNotifications}
      pendingActionsCount={pendingApprovals.length}
    >
      {children}
    </AppShellClient>
  );
}
