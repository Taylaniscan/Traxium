"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  captureException,
  trackClientEvent,
} from "@/lib/observability";

type JobRetryButtonProps = {
  jobId: string;
  jobType: string;
  disabled?: boolean;
  disabledReason?: string | null;
};

type JobRetrySuccessPayload = {
  message?: string;
  retryQueued?: boolean;
};

type JobRetryErrorPayload = {
  error?: string;
};

export function JobRetryButton({
  jobId,
  jobType,
  disabled = false,
  disabledReason = null,
}: JobRetryButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  async function handleRetry() {
    if (disabled || loading || inFlightRef.current) {
      return;
    }

    inFlightRef.current = true;
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/admin/jobs/${jobId}/retry`, {
        method: "POST",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as JobRetryErrorPayload | null;
        trackClientEvent(
          {
            event: "admin.jobs.retry.rejected",
            message: payload?.error ?? "Job retry could not be scheduled.",
            payload: {
              jobId,
              jobType,
              status: response.status,
            },
          },
          "warn"
        );
        setError(payload?.error ?? "Job retry could not be scheduled.");
        inFlightRef.current = false;
        setLoading(false);
        return;
      }

      const payload = (await response.json()) as JobRetrySuccessPayload;
      setNotice(payload.message ?? "Job retry queued.");
      inFlightRef.current = false;
      setLoading(false);

      if (payload.retryQueued) {
        router.refresh();
      }
    } catch (requestError) {
      captureException(requestError, {
        event: "admin.jobs.retry.failed",
        runtime: "client",
        payload: {
          jobId,
          jobType,
        },
      });
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Job retry could not be scheduled."
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
        onClick={handleRetry}
        disabled={disabled || loading}
      >
        {loading ? "Retrying..." : "Retry"}
      </Button>

      {disabledReason ? (
        <p className="text-xs text-[var(--muted-foreground)]">{disabledReason}</p>
      ) : null}

      {notice ? <p className="text-xs text-emerald-700">{notice}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
