"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { InvitationStatus } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  captureException,
  trackClientEvent,
} from "@/lib/observability";

type InvitationActionsProps = {
  invitationId: string;
  inviteeEmail: string;
  inviteStatus: InvitationStatus;
};

type InvitationDelivery = {
  transport: "job-queued";
  state: "queued";
  jobId: string;
} | {
  transport: "queue-unavailable";
  state: "unavailable";
} | {
  channel: "invite" | "magic_link";
  redirectTo: string;
  transport: "supabase-auth" | "generated-link";
  actionLink?: string;
  requiresManualDelivery?: boolean;
};

type InvitationActionSuccessPayload = {
  message?: string;
  delivery?: InvitationDelivery;
};

type InvitationActionErrorPayload = {
  error?: string;
};

export function InvitationActions({
  invitationId,
  inviteeEmail,
  inviteStatus,
}: InvitationActionsProps) {
  const router = useRouter();
  const [loadingAction, setLoadingAction] = useState<"revoke" | "resend" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [manualActionLink, setManualActionLink] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const inFlightRef = useRef(false);

  const canManagePendingInvite = inviteStatus === "PENDING";

  async function handleRevoke() {
    if (!canManagePendingInvite || loadingAction || inFlightRef.current) {
      return;
    }

    const confirmed = window.confirm(
      `Cancel the pending invitation for ${inviteeEmail}?`
    );

    if (!confirmed) {
      return;
    }

    inFlightRef.current = true;
    setLoadingAction("revoke");
    setError(null);
    setNotice(null);
    setManualActionLink(null);
    setCopyState("idle");

    try {
      const response = await fetch(`/api/admin/invitations/${invitationId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as InvitationActionErrorPayload | null;
        trackClientEvent(
          {
            event: "admin.invitations.revoke.rejected",
            message: payload?.error ?? "Invitation could not be cancelled.",
            payload: {
              invitationId,
              status: response.status,
            },
          },
          "warn"
        );
        setError(payload?.error ?? "Invitation could not be cancelled.");
        inFlightRef.current = false;
        setLoadingAction(null);
        return;
      }

      inFlightRef.current = false;
      setLoadingAction(null);
      router.refresh();
    } catch (requestError) {
      captureException(requestError, {
        event: "admin.invitations.revoke.failed",
        runtime: "client",
        payload: {
          invitationId,
        },
      });
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Invitation could not be cancelled."
      );
      inFlightRef.current = false;
      setLoadingAction(null);
    }
  }

  async function handleResend() {
    if (loadingAction || inFlightRef.current) {
      return;
    }

    inFlightRef.current = true;
    setLoadingAction("resend");
    setError(null);
    setNotice(null);
    setManualActionLink(null);
    setCopyState("idle");

    try {
      const response = await fetch(`/api/admin/invitations/${invitationId}/resend`, {
        method: "POST",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as InvitationActionErrorPayload | null;
        trackClientEvent(
          {
            event: "admin.invitations.resend.rejected",
            message: payload?.error ?? "Invitation could not be resent.",
            payload: {
              invitationId,
              status: response.status,
            },
          },
          "warn"
        );
        setError(payload?.error ?? "Invitation could not be resent.");
        inFlightRef.current = false;
        setLoadingAction(null);
        return;
      }

      const payload = (await response.json()) as InvitationActionSuccessPayload;
      setNotice(payload.message ?? "Invitation sent again.");
      setManualActionLink(
        payload.delivery && "actionLink" in payload.delivery
          ? payload.delivery.actionLink ?? null
          : null
      );
      inFlightRef.current = false;
      setLoadingAction(null);
      router.refresh();
    } catch (requestError) {
      captureException(requestError, {
        event: "admin.invitations.resend.failed",
        runtime: "client",
        payload: {
          invitationId,
        },
      });
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Invitation could not be resent."
      );
      inFlightRef.current = false;
      setLoadingAction(null);
    }
  }

  async function handleCopyManualLink() {
    if (!manualActionLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(manualActionLink);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 md:flex-row">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleResend}
          disabled={loadingAction !== null}
        >
          {loadingAction === "resend" ? "Resending..." : "Resend"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-red-200 text-red-700 hover:bg-red-50"
          onClick={handleRevoke}
          disabled={!canManagePendingInvite || loadingAction !== null}
        >
          {loadingAction === "revoke" ? "Cancelling..." : "Cancel"}
        </Button>
      </div>

      {notice ? (
        <p className="text-xs text-emerald-700">{notice}</p>
      ) : null}

      {manualActionLink ? (
        <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--muted)]/35 p-3">
          <p className="text-xs text-[var(--muted-foreground)]">
            Email delivery fell back to a generated secure link. Share this link manually if needed.
          </p>
          <div className="flex flex-col gap-2 md:flex-row">
            <Input value={manualActionLink} readOnly className="font-mono text-xs" />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleCopyManualLink}
            >
              {copyState === "copied"
                ? "Copied"
                : copyState === "failed"
                  ? "Copy failed"
                  : "Copy link"}
            </Button>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
