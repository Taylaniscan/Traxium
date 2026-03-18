"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { phaseLabels } from "@/lib/constants";
import type { SavingCardWithRelations } from "@/lib/types";

export function ApprovalPanel({
  card,
  canApprove,
  canLock,
  currentUserId
}: {
  card: SavingCardWithRelations;
  canApprove: boolean;
  canLock: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const actionableRequests = useMemo(
    () =>
      card.phaseChangeRequests.filter(
        (request) =>
          request.approvalStatus === "PENDING" &&
          request.approvals.some((approval) => approval.approverId === currentUserId && approval.status === "PENDING")
      ),
    [card.phaseChangeRequests, currentUserId]
  );
  const hasPendingRequests = useMemo(
    () => card.phaseChangeRequests.some((request) => request.approvalStatus === "PENDING"),
    [card.phaseChangeRequests]
  );

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
        return apiMessage ?? "Approval failed.";
    }
  }

  async function submitApproval(requestId: string, approved: boolean) {
    setLoading(requestId);
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
      setLoading(null);
    }
  }

  async function toggleFinanceLock() {
    const response = await fetch(`/api/saving-cards/${card.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "finance-lock", locked: !card.financeLocked })
    });

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      setError(result?.error ?? "Finance lock update failed.");
      return;
    }

    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workflow Controls</CardTitle>
        <CardDescription>Review pending phase-change requests assigned to you and manage finance lock.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        {actionableRequests.length ? (
          actionableRequests.map((request) => (
            <div key={request.id} className="rounded-2xl border bg-[var(--muted)] p-4">
              <p className="font-semibold">
                {phaseLabels[request.currentPhase]} to {phaseLabels[request.requestedPhase]}
              </p>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">{request.comment ?? "No request comment provided."}</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Button onClick={() => submitApproval(request.id, true)} disabled={loading === request.id}>
                  {loading === request.id ? "Processing..." : "Approve Phase Change"}
                </Button>
                <Button variant="outline" onClick={() => submitApproval(request.id, false)} disabled={loading === request.id}>
                  Reject
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl bg-[var(--muted)] p-4 text-sm text-[var(--muted-foreground)]">
            {hasPendingRequests && !canApprove
              ? "A phase-change request is pending on this saving card, but it is not assigned to you."
              : "No pending phase-change approvals are currently assigned to you for this saving card."}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={toggleFinanceLock} disabled={!canLock}>
            {card.financeLocked ? "Unlock Finance Fields" : "Lock Finance Fields"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
