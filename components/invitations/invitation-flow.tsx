"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getPasswordConfirmationError,
  getPasswordValidationError,
  MIN_PASSWORD_LENGTH,
} from "@/lib/passwords";
import {
  captureException,
  trackClientEvent,
} from "@/lib/observability";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type InvitationFlowProps = {
  token: string;
  mode: "setup" | "accept" | null;
  loginHref: string;
  invitation: {
    id: string;
    email: string;
    role: string;
    status: string;
    expiresAt: string;
    organization: {
      id: string;
      name: string;
      slug: string;
    };
    invitedBy: {
      id: string;
      name: string;
      email: string;
    };
  };
};

type InvitationActionErrorPayload = {
  error?: string;
};

type AuthState = {
  loading: boolean;
  email: string | null;
};

function normalizeEmail(value: string | null) {
  return value?.trim().toLowerCase() ?? null;
}

export function InvitationFlow({
  token,
  mode,
  loginHref,
  invitation,
}: InvitationFlowProps) {
  const [authState, setAuthState] = useState<AuthState>({
    loading: true,
    email: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [acceptLoading, setAcceptLoading] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let active = true;

    async function syncAuthState() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) {
        return;
      }

      const metadataName =
        typeof user?.user_metadata?.name === "string"
          ? user.user_metadata.name
          : typeof user?.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name
            : "";

      setName((currentName) => currentName || metadataName);
      setAuthState({
        loading: false,
        email: normalizeEmail(user?.email ?? null),
      });
    }

    void syncAuthState();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void syncAuthState();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const invitedEmail = normalizeEmail(invitation.email);
  const signedInEmail = authState.email;
  const emailsMatch = Boolean(invitedEmail && signedInEmail && invitedEmail === signedInEmail);
  const setupMode = mode === "setup";

  async function handleAcceptInvitation() {
    setAcceptLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/invitations/${token}/accept`, {
        method: "POST",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as InvitationActionErrorPayload | null;

        if (response.status === 401) {
          trackClientEvent(
            {
              event: "invitation.accept.unauthorized",
              payload: {
                organizationId: invitation.organization.id,
              },
            },
            "warn"
          );
          window.location.assign(loginHref);
          return;
        }

        trackClientEvent(
          {
            event: "invitation.accept.rejected",
            message: payload?.error ?? "Invitation could not be accepted.",
            payload: {
              organizationId: invitation.organization.id,
              status: response.status,
            },
          },
          "warn"
        );
        setError(payload?.error ?? "Invitation could not be accepted.");
        setAcceptLoading(false);
        return;
      }

      window.location.assign("/dashboard");
    } catch (acceptanceError) {
      captureException(acceptanceError, {
        event: "invitation.accept.failed",
        runtime: "client",
        organizationId: invitation.organization.id,
      });
      setError(
        acceptanceError instanceof Error
          ? acceptanceError.message
          : "Invitation could not be accepted."
      );
      setAcceptLoading(false);
    }
  }

  async function handleCompleteAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = name.trim();
    const passwordError = getPasswordValidationError(password);
    const confirmPasswordError = getPasswordConfirmationError(password, confirmPassword);

    if (!normalizedName) {
      setError("Full name is required.");
      return;
    }

    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (confirmPasswordError) {
      setError(confirmPasswordError);
      return;
    }

    setSetupLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/invitations/${token}/complete`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: normalizedName,
          password,
          confirmPassword,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as InvitationActionErrorPayload | null;
        trackClientEvent(
          {
            event: "invitation.complete.rejected",
            message: payload?.error ?? "Your account could not be completed.",
            payload: {
              organizationId: invitation.organization.id,
              status: response.status,
            },
          },
          "warn"
        );
        setError(payload?.error ?? "Your account could not be completed.");
        setSetupLoading(false);
        return;
      }

      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      window.location.assign(
        `/login?email=${encodeURIComponent(invitation.email)}&message=invite-complete`
      );
    } catch (completionError) {
      captureException(completionError, {
        event: "invitation.complete.failed",
        runtime: "client",
        organizationId: invitation.organization.id,
      });
      setError(
        completionError instanceof Error
          ? completionError.message
          : "Your account could not be completed."
      );
      setSetupLoading(false);
    }
  }

  async function handleSignOutWrongAccount() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.assign(loginHref);
  }

  if (authState.loading) {
    return (
      <div className="rounded-md border border-[var(--border)] bg-[var(--muted)]/40 px-4 py-3 text-sm text-[var(--muted-foreground)]">
        Securing your invitation session...
      </div>
    );
  }

  if (signedInEmail && !emailsMatch) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You are signed in as <span className="font-medium">{signedInEmail}</span>. This invitation belongs to <span className="font-medium">{invitation.email}</span>.
        </div>

        <Button type="button" variant="outline" onClick={handleSignOutWrongAccount}>
          Sign out and continue with invited email
        </Button>
      </div>
    );
  }

  if (!setupMode && !signedInEmail) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Sign in with <span className="font-medium">{invitation.email}</span> to accept this workspace invitation.
        </div>

        <Link
          href={loginHref}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] transition hover:bg-[#1d4ed8]"
        >
          Sign in to accept
        </Link>
      </div>
    );
  }

  if (!setupMode) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          You are signed in as <span className="font-medium">{signedInEmail}</span>. Accept this invite to join <span className="font-medium">{invitation.organization.name}</span>.
        </div>

        <Button type="button" onClick={handleAcceptInvitation} disabled={acceptLoading}>
          {acceptLoading ? "Accepting invitation..." : "Accept invitation"}
        </Button>

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={handleCompleteAccount} className="space-y-5">
      <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        {signedInEmail ? (
          <>
            You are signed in as <span className="font-medium">{signedInEmail}</span>. Complete your Traxium account for <span className="font-medium">{invitation.organization.name}</span>.
          </>
        ) : (
          <>
            Complete your Traxium account directly from this invitation for <span className="font-medium">{invitation.organization.name}</span>.
          </>
        )}
      </div>

      {!signedInEmail ? (
        <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--muted-foreground)]">
          <span>If this email already has a Traxium account, sign in instead.</span>
          <Link href={loginHref} className="font-medium text-[var(--primary)] hover:underline">
            Sign in
          </Link>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="invite-full-name">Full name</Label>
          <Input
            id="invite-full-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            placeholder="Jane Doe"
            required
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="invite-email">Invited email</Label>
          <Input
            id="invite-email"
            type="email"
            value={invitation.email}
            readOnly
            aria-readonly="true"
            className="bg-slate-100 text-slate-700"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="invite-password">Create password</Label>
          <Input
            id="invite-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="invite-confirm-password">Confirm password</Label>
          <Input
            id="invite-confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            placeholder="Repeat your password"
            required
          />
        </div>
      </div>

      <p className="text-sm text-[var(--muted-foreground)]">
        Your password must be at least {MIN_PASSWORD_LENGTH} characters and include uppercase, lowercase, and numeric characters.
      </p>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <Button type="submit" disabled={setupLoading}>
        {setupLoading ? "Completing account..." : "Complete account"}
      </Button>
    </form>
  );
}
