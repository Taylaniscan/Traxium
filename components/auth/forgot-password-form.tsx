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
import { Label } from "@/components/ui/label";

type ForgotPasswordErrorPayload = {
  error?: string;
};

type ForgotPasswordSuccessPayload = {
  success: true;
  delivery?: {
    transport?: "supabase-auth" | "generated-link";
    requiresManualDelivery?: boolean;
  };
  developmentRecoveryLink?: string;
};

function resolvePrefilledEmail(value: string | null) {
  return value?.trim() ?? "";
}

export function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(() =>
    resolvePrefilledEmail(searchParams.get("email"))
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [developmentRecoveryLink, setDevelopmentRecoveryLink] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setDevelopmentRecoveryLink(null);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as ForgotPasswordErrorPayload | null;
        setError(payload?.error ?? "Password reset email could not be sent.");
        setLoading(false);
        return;
      }

      const payload = (await response.json()) as ForgotPasswordSuccessPayload;
      setDevelopmentRecoveryLink(payload.developmentRecoveryLink ?? null);
      setSent(true);
      setLoading(false);
    } catch (forgotPasswordError) {
      setError(
        forgotPasswordError instanceof Error
          ? forgotPasswordError.message
          : "Password reset email could not be sent."
      );
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
          <CardDescription>
            Enter your email and Traxium will send a secure password reset link.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {sent ? (
            <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
              {developmentRecoveryLink
                ? "Supabase hosted email delivery is unavailable right now. Use the secure recovery link below."
                : "Password reset email sent. Check your inbox for the secure reset link."}
            </div>
          ) : null}

          {developmentRecoveryLink ? (
            <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
              <p className="font-medium">Development recovery link</p>
              <Input value={developmentRecoveryLink} readOnly className="font-mono text-xs" />
              <a
                href={developmentRecoveryLink}
                className="inline-flex text-sm font-medium text-[var(--primary)] hover:underline"
              >
                Open reset link
              </a>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-password-email">Email</Label>
              <Input
                id="forgot-password-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
                required
              />
            </div>

            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending reset email..." : "Send reset email"}
            </Button>
          </form>

          <Link
            href={`/login${email.trim() ? `?email=${encodeURIComponent(email.trim())}` : ""}`}
            className="inline-flex text-sm font-medium text-[var(--primary)] hover:underline"
          >
            Back to sign in
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
