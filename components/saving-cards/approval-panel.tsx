"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Toast } from "@/components/ui/toast";
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
  const [toast, setToast] = useState<{ id: number; message: string; tone: "success" | "error" } | null>(null);

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
  const openRequestCount = useMemo(
    () => card.phaseChangeRequests.filter((request) => request.approvalStatus === "PENDING").length,
    [card.phaseChangeRequests]
  );
  const decidedApprovalCount = useMemo(
    () => card.approvals.filter((approval) => approval.status !== "PENDING").length,
    [card.approvals]
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
        const message = getApprovalErrorMessage(response.status, result?.error);
        setError(message);
        setToast({ id: Date.now(), message, tone: "error" });
        return;
      }

      setToast({
        id: Date.now(),
        message: approved ? "Approval recorded" : "Request rejected",
        tone: "success"
      });
      router.refresh();
    } catch {
      const message = "Unable to reach the workflow service. Please retry.";
      setError(message);
      setToast({ id: Date.now(), message, tone: "error" });
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
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-[var(--border)] bg-[var(--surface-elevated)]/75">
        <div className="flex flex-col gap-4">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold text-[var(--muted-foreground)]">
              Workflow Control
            </p>
            <CardTitle>Review Actions</CardTitle>
            <CardDescription>Pending approvals and finance controls stay here so the business record remains easy to scan while reviewers still have immediate action access.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={actionableRequests.length ? "amber" : "slate"}>
              {actionableRequests.length} assigned to you
            </Badge>
            <Badge tone={openRequestCount ? "teal" : "slate"}>
              {openRequestCount} open request{openRequestCount === 1 ? "" : "s"}
            </Badge>
            <Badge tone={card.financeLocked ? "lock" : "slate"}>
              {card.financeLocked ? "Finance locked" : "Finance open"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
          <WorkflowMetric label="Pending for You" value={String(actionableRequests.length)} />
          <WorkflowMetric label="Open Requests" value={String(openRequestCount)} />
          <WorkflowMetric label="Finance Lock" value={card.financeLocked ? "Locked" : "Open"} />
        </div>

        <div className="space-y-3">
          <p className="text-[11px] font-semibold text-[var(--muted-foreground)]">
            Pending approvals
          </p>

          {actionableRequests.length ? (
            actionableRequests.map((request) => (
              <div key={request.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {phaseLabels[request.currentPhase]} to {phaseLabels[request.requestedPhase]}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                      {request.approvals.filter((approval) => approval.status === "PENDING").length} approver action pending
                    </p>
                  </div>
                  <Badge tone="amber">Awaiting decision</Badge>
                </div>
                <p className="mt-3 text-sm text-[var(--muted-foreground)]">{request.comment ?? "No request comment provided."}</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <Button
                    onClick={() => submitApproval(request.id, true)}
                    disabled={loading === request.id}
                    className="px-5 py-2"
                  >
                    {loading === request.id ? "Processing..." : "Approve Phase Change"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => submitApproval(request.id, false)}
                    disabled={loading === request.id}
                    className="px-5 py-2 text-[var(--risk)]"
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--muted)]/20 p-4 text-sm text-[var(--muted-foreground)]">
              {hasPendingRequests && !canApprove
                ? "A phase-change request is pending on this saving card, but it is not assigned to you."
                : "No pending phase-change approvals are currently assigned to you for this saving card."}
            </div>
          )}
        </div>

        <div className="space-y-3 border-t border-[var(--border)] pt-5">
          <p className="text-[11px] font-semibold text-[var(--muted-foreground)]">
            Finance control
          </p>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {card.financeLocked ? "Finance fields are locked" : "Finance fields are open"}
                </p>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  Locking prevents changes to core finance inputs once validation is complete.
                </p>
              </div>
              <Badge tone={card.financeLocked ? "lock" : "slate"}>
                {card.financeLocked ? "Locked" : "Open"}
              </Badge>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <Button variant="secondary" onClick={toggleFinanceLock} disabled={!canLock}>
                {card.financeLocked ? "Unlock Finance Fields" : "Lock Finance Fields"}
              </Button>
            </div>

            {!canLock ? (
              <p className="mt-3 text-xs text-[var(--muted-foreground)]">
                Only authorized finance reviewers can change the lock state.
              </p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/55 p-4">
            <p className="text-[11px] font-semibold text-[var(--muted-foreground)]">
              Decision history
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <WorkflowMetric label="Decisions Recorded" value={String(decidedApprovalCount)} />
              <WorkflowMetric label="All Requests" value={String(card.phaseChangeRequests.length)} />
            </div>
          </div>
        </div>
      </CardContent>
      {toast ? (
        <Toast
          key={toast.id}
          message={toast.message}
          tone={toast.tone}
          onDone={() => setToast((current) => (current?.id === toast.id ? null : current))}
        />
      ) : null}
    </Card>
  );
}

function WorkflowMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/20 p-4">
      <p className="text-[11px] font-semibold text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-2 text-base font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}
