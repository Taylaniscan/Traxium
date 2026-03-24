"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";

type InvitationAcceptancePanelProps = {
  token: string;
  invitationEmail: string;
  signedInEmail: string | null;
  canAccept: boolean;
  loginHref: string;
};

type InvitationAcceptanceErrorPayload = {
  error?: string;
};

export function InvitationAcceptancePanel({
  token,
  invitationEmail,
  signedInEmail,
  canAccept,
  loginHref,
}: InvitationAcceptancePanelProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleAccept() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/invitations/${token}/accept`, {
        method: "POST",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as InvitationAcceptanceErrorPayload | null;

        if (response.status === 401) {
          window.location.assign(loginHref);
          return;
        }

        setError(payload?.error ?? "Invitation could not be accepted.");
        setLoading(false);
        return;
      }

      window.location.assign("/dashboard");
    } catch (acceptanceError) {
      setError(
        acceptanceError instanceof Error
          ? acceptanceError.message
          : "Invitation could not be accepted."
      );
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {!signedInEmail ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Sign in with <span className="font-medium text-slate-900">{invitationEmail}</span> to accept this workspace invitation.
          </p>

          <Link
            href={loginHref}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] transition hover:bg-[#1d4ed8]"
          >
            Sign in to accept
          </Link>
        </div>
      ) : null}

      {signedInEmail && !canAccept ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You are signed in as <span className="font-medium">{signedInEmail}</span>. This invitation can only be accepted by <span className="font-medium">{invitationEmail}</span>.
        </div>
      ) : null}

      {signedInEmail && canAccept ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            You are signed in as <span className="font-medium text-slate-900">{signedInEmail}</span>.
          </p>

          <Button type="button" onClick={handleAccept} disabled={loading}>
            {loading ? "Accepting invitation..." : "Accept invitation"}
          </Button>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
    </div>
  );
}
