"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Phase } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { phaseLabels } from "@/lib/constants";
import { cn } from "@/lib/utils";

type OpenAction = {
  id: string;
  requestId: string;
  savingCardId: string;
  savingCardTitle: string;
  requestedBy: string;
  requestedAt: string;
  currentPhase: Phase;
  requestedPhase: Phase;
  comment: string | null;
};

export function OpenActionsList({ actions }: { actions: OpenAction[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function getApprovalErrorMessage(status: number, apiMessage?: string) {
    switch (status) {
      case 401:
        return apiMessage ?? "Your session has expired. Sign in again and retry.";
      case 403:
        return apiMessage ?? "You are not assigned to approve this phase change request.";
      case 404:
        return apiMessage ?? "This phase change request is no longer available or you do not have access.";
      case 409:
        return apiMessage ?? "This phase change request was already processed or is no longer pending.";
      default:
        return apiMessage ?? "Unable to update this action.";
    }
  }

  async function submitDecision(requestId: string, approved: boolean) {
    setLoadingId(requestId);
    setError(null);

    try {
      const response = await fetch("/api/approve-phase-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, approved })
      });

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        setError(getApprovalErrorMessage(response.status, result?.error));
        return;
      }

      router.refresh();
    } catch {
      setError("Unable to reach the workflow service. Please retry.");
    } finally {
      setLoadingId(null);
    }
  }

  if (!actions.length) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-[var(--muted-foreground)]">
          No pending approvals or workflow tasks are currently assigned to you.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {actions.map((action) => (
        <Card key={action.id}>
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold">Phase Change Approval</p>
                <p className="text-lg font-semibold tracking-tight">{action.savingCardTitle}</p>
                <p className="text-sm text-[var(--muted-foreground)]">
                  {phaseLabels[action.currentPhase]} to {phaseLabels[action.requestedPhase]}
                </p>
              </div>
              <div className="text-right text-sm text-[var(--muted-foreground)]">
                <p>Requested by {action.requestedBy}</p>
                <p>{formatDate(action.requestedAt)}</p>
              </div>
            </div>

            {action.comment ? <p className="text-sm text-[var(--muted-foreground)]">{action.comment}</p> : null}

            <div className="flex flex-wrap gap-3">
              <Button onClick={() => submitDecision(action.requestId, true)} disabled={loadingId === action.requestId}>
                {loadingId === action.requestId ? "Processing..." : "Approve"}
              </Button>
              <Button variant="outline" onClick={() => submitDecision(action.requestId, false)} disabled={loadingId === action.requestId}>
                Reject
              </Button>
              <Link href={`/saving-cards/${action.savingCardId}`} className={cn(buttonVariants({ variant: "secondary" }))}>
                View
              </Link>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(date));
}
