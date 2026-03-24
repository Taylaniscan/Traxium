import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { getWorkspaceOnboardingState } from "@/lib/auth";

function resolveInviteNextPath(value: string | string[] | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  if (!normalized || normalized.startsWith("//") || !normalized.startsWith("/invite/")) {
    return null;
  }

  return normalized;
}

export default async function LoginPage(
  { searchParams }: { searchParams: Promise<{ next?: string | string[] }> }
) {
  const { next } = await searchParams;
  const nextPath = resolveInviteNextPath(next);
  const state = await getWorkspaceOnboardingState();

  if (state.ok) {
    if (nextPath) {
      redirect(nextPath);
    }

    if (state.needsWorkspace) {
      redirect("/onboarding");
    }

    redirect("/dashboard");
  }

  return <LoginForm />;
}
