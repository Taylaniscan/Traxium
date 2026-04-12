"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  captureException,
  trackClientEvent,
} from "@/lib/observability";

type MemberRemoveButtonProps = {
  membershipId: string;
  memberName: string;
  disabled?: boolean;
  disabledReason?: string | null;
};

type MemberRemoveErrorPayload = {
  error?: string;
};

export function MemberRemoveButton({
  membershipId,
  memberName,
  disabled = false,
  disabledReason = null,
}: MemberRemoveButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  async function handleRemove() {
    if (disabled || loading || inFlightRef.current) {
      return;
    }

    const confirmed = window.confirm(
      `Remove ${memberName} from this workspace? They will lose access immediately.`
    );

    if (!confirmed) {
      return;
    }

    inFlightRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/members/${membershipId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as MemberRemoveErrorPayload | null;
        trackClientEvent(
          {
            event: "admin.members.remove.rejected",
            message: payload?.error ?? `${memberName} could not be removed.`,
            payload: {
              membershipId,
              status: response.status,
            },
          },
          "warn"
        );
        setError(payload?.error ?? `${memberName} could not be removed.`);
        inFlightRef.current = false;
        setLoading(false);
        return;
      }

      inFlightRef.current = false;
      setLoading(false);
      router.refresh();
    } catch (requestError) {
      captureException(requestError, {
        event: "admin.members.remove.failed",
        runtime: "client",
        payload: {
          membershipId,
        },
      });
      setError(
        requestError instanceof Error
          ? requestError.message
          : `${memberName} could not be removed.`
      );
      inFlightRef.current = false;
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="border-red-200 text-red-700 hover:bg-red-50"
        onClick={handleRemove}
        disabled={disabled || loading}
      >
        {loading ? "Removing..." : "Remove"}
      </Button>

      {disabledReason ? (
        <p className="text-xs text-[var(--muted-foreground)]">{disabledReason}</p>
      ) : null}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
