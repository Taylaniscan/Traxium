import { redirect } from "next/navigation";

import { WorkspaceSetupGuide } from "@/components/onboarding/workspace-setup-guide";
import { WorkspaceOnboardingForm } from "@/components/onboarding/workspace-onboarding-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { bootstrapCurrentUser, getWorkspaceOnboardingState } from "@/lib/auth";
import { getWorkspaceReadiness } from "@/lib/data";
import { captureException } from "@/lib/observability";

export default async function OnboardingPage() {
  const state = await getWorkspaceOnboardingState();

  if (!state.ok) {
    if (state.code === "UNAUTHENTICATED") {
      redirect("/login");
    }

    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <Card className="w-full max-w-lg shadow-sm">
          <CardHeader>
            <CardTitle>Workspace onboarding is unavailable</CardTitle>
            <CardDescription>
              Traxium could not prepare your account for first-workspace setup.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {state.message}
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (state.needsWorkspace) {
    return <WorkspaceOnboardingForm userName={state.user.name} />;
  }

  const session = await bootstrapCurrentUser();

  if (!session.ok) {
    if (session.code === "UNAUTHENTICATED") {
      redirect("/login");
    }

    if (session.code === "ORGANIZATION_ACCESS_REQUIRED") {
      return <WorkspaceOnboardingForm userName={state.user.name} />;
    }

    if (session.code === "BILLING_REQUIRED") {
      redirect("/billing-required");
    }

    redirect("/login");
  }

  let readiness: Awaited<ReturnType<typeof getWorkspaceReadiness>> | null = null;
  let readinessError: string | null = null;

  try {
    readiness = await getWorkspaceReadiness(session.user.organizationId);
  } catch (error) {
    readinessError =
      "Workspace setup progress could not be loaded right now. You can still continue onboarding.";
    captureException(error, {
      event: "onboarding.page.readiness_load_failed",
      route: "/onboarding",
      organizationId: session.user.organizationId,
      userId: session.user.id,
      payload: {
        resource: "workspace_readiness",
        degradedRender: true,
        fallback: "guided_onboarding_without_readiness",
      },
    });
  }

  return (
    <WorkspaceSetupGuide
      readiness={readiness}
      readinessError={readinessError}
      userName={session.user.name}
      viewerMembershipRole={session.user.activeOrganization.membershipRole}
    />
  );
}
