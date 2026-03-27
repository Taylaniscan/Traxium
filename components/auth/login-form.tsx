"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  captureException,
  trackClientEvent,
} from "@/lib/observability";
import {
  trackSuccessfulLogin,
} from "@/lib/analytics";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function resolveInviteNextPath(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim();

  if (!normalized || normalized.startsWith("//") || !normalized.startsWith("/invite/")) {
    return null;
  }

  return normalized;
}

function resolveMessage(value: string | null) {
  switch (value) {
    case "invite-complete":
      return "Your account is ready. Sign in with the password you just created.";
    case "invite-sign-in":
      return "Sign in with the invited email to join the workspace.";
    case "password-reset-sent":
      return "Password reset email sent. Open the link in your inbox to choose a new password.";
    case "password-reset-complete":
      return "Password updated. Sign in with your new password.";
    default:
      return null;
  }
}

function resolvePrefilledEmail(value: string | null) {
  const normalized = value?.trim() ?? "";
  return normalized;
}

export function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(() =>
    resolvePrefilledEmail(searchParams.get("email"))
  );
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const notice = resolveMessage(searchParams.get("message"));
  const forgotPasswordHref = `/forgot-password${
    email.trim() ? `?email=${encodeURIComponent(email.trim())}` : ""
  }`;

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const nextPath = resolveInviteNextPath(searchParams.get("next"));

    try {
      const supabase = createSupabaseBrowserClient();

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        trackClientEvent(
          {
            event: "auth.login.rejected",
            message: signInError.message,
            payload: {
              hasInviteNextPath: Boolean(nextPath),
            },
          },
          "warn"
        );
        setError(signInError.message);
        setLoading(false);
        return;
      }

      const bootstrapResponse = await fetch("/api/auth/bootstrap", {
        method: "POST",
      });

      if (!bootstrapResponse.ok) {
        const bootstrapPayload = (await bootstrapResponse.json().catch(() => null)) as
          | { error?: string; code?: string }
          | null;

        if (bootstrapPayload?.code === "ORGANIZATION_ACCESS_REQUIRED") {
          trackClientEvent(
            {
              event: "auth.login.requires_workspace",
              payload: {
                hasInviteNextPath: Boolean(nextPath),
              },
            },
            "warn"
          );
          window.location.assign(nextPath ?? "/onboarding");
          return;
        }

        await supabase.auth.signOut();
        trackClientEvent(
          {
            event: "auth.bootstrap.rejected",
            message:
              bootstrapPayload?.error ??
              "Your account could not be connected to a Traxium workspace.",
            payload: {
              code: bootstrapPayload?.code ?? null,
              hasInviteNextPath: Boolean(nextPath),
            },
          },
          "warn"
        );
        setError(
          bootstrapPayload?.error ??
            "Your account could not be connected to a Traxium workspace."
        );
        setLoading(false);
        return;
      }

      const bootstrapPayload = (await bootstrapResponse.json()) as {
        user?: {
          id: string;
          role: string;
          activeOrganization: {
            organizationId: string;
            membershipRole: string;
          };
        };
      };

      if (bootstrapPayload.user) {
        await trackSuccessfulLogin({
          runtime: "client",
          userId: bootstrapPayload.user.id,
          organizationId: bootstrapPayload.user.activeOrganization.organizationId,
          appRole: bootstrapPayload.user.role,
          membershipRole: bootstrapPayload.user.activeOrganization.membershipRole,
          hasInviteNextPath: Boolean(nextPath),
          destination: nextPath !== null ? "invite" : "dashboard",
        });
      }

      window.location.assign(nextPath ?? "/dashboard");
    } catch (error) {
      captureException(error, {
        event: "auth.login.failed",
        runtime: "client",
        payload: {
          hasInviteNextPath: Boolean(nextPath),
        },
      });
      setError(error instanceof Error ? error.message : "Login failed");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader>
          <CardTitle>Sign in to Traxium</CardTitle>
          <CardDescription>
            Procurement savings governance from idea to realized value.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {notice ? (
              <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                {notice}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="password">Password</Label>
                <Link
                  href={forgotPasswordHref}
                  className="text-sm font-medium text-[var(--primary)] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
              />
            </div>

            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
