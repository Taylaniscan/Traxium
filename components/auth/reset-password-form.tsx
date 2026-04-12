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
import { Label } from "@/components/ui/label";
import {
  getPasswordConfirmationError,
  getPasswordValidationError,
  MIN_PASSWORD_LENGTH,
} from "@/lib/passwords";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function ResetPasswordForm() {
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let active = true;

    async function syncRecoverySession() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) {
        return;
      }

      setEmail(user?.email?.trim().toLowerCase() ?? null);
      setReady(true);
    }

    void syncRecoverySession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void syncRecoverySession();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const passwordError = getPasswordValidationError(password);
    const confirmPasswordError = getPasswordConfirmationError(password, confirmPassword);

    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (confirmPasswordError) {
      setError(confirmPasswordError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          password,
          confirmPassword,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Password could not be updated.");
        setLoading(false);
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const nextEmail = email ?? "";
      await supabase.auth.signOut();
      window.location.assign(
        `/login?email=${encodeURIComponent(nextEmail)}&message=password-reset-complete`
      );
    } catch (resetError) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : "Password could not be updated."
      );
      setLoading(false);
    }
  }

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <Card className="w-full max-w-md shadow-sm">
          <CardHeader>
            <CardTitle>Preparing password reset</CardTitle>
            <CardDescription>
              Verifying your secure recovery link...
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (!email) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <Card className="w-full max-w-md shadow-sm">
          <CardHeader>
            <CardTitle>Password reset link is invalid</CardTitle>
            <CardDescription>
              The recovery link is missing, expired, or has already been used.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/forgot-password"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--muted)]"
            >
              Request a new reset link
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader>
          <CardTitle>Choose a new password</CardTitle>
          <CardDescription>
            Update the password for <span className="font-medium text-[var(--foreground)]">{email}</span>.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-password">New password</Label>
              <Input
                id="reset-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reset-password-confirm">Confirm password</Label>
              <Input
                id="reset-password-confirm"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                placeholder="Repeat your new password"
                required
              />
            </div>

            <p className="text-sm text-[var(--muted-foreground)]">
              Use at least {MIN_PASSWORD_LENGTH} characters with uppercase, lowercase, and numeric characters.
            </p>

            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Updating password..." : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
