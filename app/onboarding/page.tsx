import { redirect } from "next/navigation";

import { WorkspaceOnboardingForm } from "@/components/onboarding/workspace-onboarding-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getWorkspaceOnboardingState } from "@/lib/auth";

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

  if (!state.needsWorkspace) {
    redirect("/dashboard");
  }

  return <WorkspaceOnboardingForm userName={state.user.name} />;
}
