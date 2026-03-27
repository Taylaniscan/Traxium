import { redirect } from "next/navigation";
import { AnalyticsSessionIdentify } from "@/components/analytics/analytics-session-identify";
import { AppShell } from "@/components/layout/app-shell";
import { bootstrapCurrentUser } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await bootstrapCurrentUser();

  if (!session.ok) {
    if (session.code === "ORGANIZATION_ACCESS_REQUIRED") {
      redirect("/onboarding");
    }

    redirect("/login");
  }

  return (
    <AppShell>
      <AnalyticsSessionIdentify
        userId={session.user.id}
        organizationId={session.user.activeOrganization.organizationId}
        appRole={session.user.role}
        membershipRole={session.user.activeOrganization.membershipRole}
      />
      {children}
    </AppShell>
  );
}
