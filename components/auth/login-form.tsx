"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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
  resolveInviteNextPath,
  resolveLoginErrorMessage,
} from "@/lib/auth-navigation";
import { Label } from "@/components/ui/label";

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

type LoginFormQueryState = {
  email: string;
  message: string | null;
  nextPath: string | null;
};

export function resolveLoginFormQueryState(
  search: string | null | undefined
): LoginFormQueryState {
  const normalizedSearch = search?.startsWith("?")
    ? search.slice(1)
    : search ?? "";
  const params = new URLSearchParams(normalizedSearch);

  return {
    email: resolvePrefilledEmail(params.get("email")),
    message: params.get("message"),
    nextPath: resolveInviteNextPath(params.get("next")),
  };
}

export function LoginForm() {
  const [queryState, setQueryState] = useState<LoginFormQueryState>({
    email: "",
    message: null,
    nextPath: null,
  });
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const nextPath = queryState.nextPath;
  const notice = resolveMessage(queryState.message);
  const error = resolveLoginErrorMessage(queryState.message);
  const forgotPasswordHref = `/forgot-password${
    email.trim() ? `?email=${encodeURIComponent(email.trim())}` : ""
  }`;

  useEffect(() => {
    const nextQueryState = resolveLoginFormQueryState(window.location.search);

    setQueryState(nextQueryState);
    setEmail((currentEmail) => currentEmail || nextQueryState.email);
  }, []);

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
          <form
            action="/api/auth/login"
            method="post"
            className="space-y-4"
            onSubmit={() => setLoading(true)}
          >
            {notice ? (
              <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                {notice}
              </div>
            ) : null}

            {nextPath ? (
              <input
                type="hidden"
                name="next"
                value={nextPath}
                readOnly
              />
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
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
                name="password"
                type="password"
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
