"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Filter, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { Phase } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { phaseLabels, phases } from "@/lib/constants";
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

type WorkspaceReadiness = Awaited<ReturnType<typeof import("@/lib/data").getWorkspaceReadiness>>;

export function OpenActionsList({
  actions,
  readiness,
}: {
  actions: OpenAction[];
  readiness?: WorkspaceReadiness | null;
}) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [requestedPhaseFilter, setRequestedPhaseFilter] = useState("");

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

  const filteredActions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return actions.filter((action) => {
      if (requestedPhaseFilter && action.requestedPhase !== requestedPhaseFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        action.savingCardTitle,
        action.requestedBy,
        action.comment ?? "",
        phaseLabels[action.currentPhase],
        phaseLabels[action.requestedPhase],
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [actions, requestedPhaseFilter, search]);

  const activeFilters = Boolean(search.trim() || requestedPhaseFilter);
  const workspaceCardCount = readiness?.counts.savingCards;
  const hasWorkspaceCards =
    typeof workspaceCardCount === "number" ? workspaceCardCount > 0 : true;
  const configuredCollections = readiness?.masterData.filter((item) => item.ready).length ?? 0;
  const workflowCoverageReady = readiness?.workflowCoverage.filter((item) => item.ready).length ?? 0;
  const showRampUpState =
    actions.length > 0 &&
    !!readiness &&
    (readiness.counts.savingCards < 3 || !readiness.isWorkspaceReady);
  const nextActions = buildOpenActionsNextActions(readiness, actions.length);

  function clearFilters() {
    setSearch("");
    setRequestedPhaseFilter("");
  }

  if (!actions.length && !hasWorkspaceCards) {
    return (
      <div className="space-y-6">
        <Card className="border-0 bg-[linear-gradient(135deg,#113b61_0%,#194f7a_58%,#1b7f87_100%)] text-white">
          <CardContent className="grid gap-6 p-8 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4">
              <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.12em] text-cyan-100">
                Workflow Launch
              </div>
              <div>
                <h2 className="text-3xl font-semibold tracking-tight">No workflow actions are open yet.</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-cyan-50/85">
                  This queue becomes the working inbox for pending phase approvals and workflow handoffs once saving cards are created and start progressing through the approval path.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/saving-cards/new" className={buttonVariants({ size: "sm" })}>
                  Create first saving card
                </Link>
                <Link
                  href="/admin"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "border-white/20 bg-white/10 text-white hover:bg-white/20"
                  )}
                >
                  Review setup
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <OpenActionsMetric
                label="Workspace Status"
                value={readiness?.isWorkspaceReady ? "Configured" : "Setup in progress"}
                detail={
                  readiness?.isWorkspaceReady
                    ? "Master data and workflow coverage are in place."
                    : "Complete shared setup before broader rollout."
                }
              />
              <OpenActionsMetric
                label="Master Data"
                value={`${configuredCollections}/${readiness?.masterData.length ?? 6}`}
                detail="Configured collections ready for saving-card creation."
              />
              <OpenActionsMetric
                label="Workflow Coverage"
                value={`${workflowCoverageReady}/${readiness?.workflowCoverage.length ?? 3}`}
                detail="Approval roles currently assigned."
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle>Next Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {nextActions.map((item) => (
                <div key={item} className="rounded-xl bg-[var(--muted)] px-4 py-3 text-sm">
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What This Queue Supports</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <OpenActionsPromise
                title="Assigned approval work"
                description="Pending phase-change decisions appear here once initiatives start moving through the workflow."
              />
              <OpenActionsPromise
                title="Fast action routing"
                description="Approvers can review, approve, or reject requests directly from this page without leaving the workflow queue."
              />
              <OpenActionsPromise
                title="Operational visibility"
                description="The list becomes the fastest way to see what is waiting on you across the active savings portfolio."
              />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {showRampUpState ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>
              {readiness?.isWorkspaceReady
                ? "Workflow queue is live and still ramping up"
                : "Workflow queue is live, but setup is still in progress"}
            </CardTitle>
            <CardDescription>
              {readiness?.isWorkspaceReady
                ? `You currently have ${actions.length} open action${actions.length === 1 ? "" : "s"} assigned to you. The queue becomes more representative as more saving cards advance through the workflow.`
                : `You already have ${actions.length} open action${actions.length === 1 ? "" : "s"}, but shared setup still needs attention to keep approval routing consistent.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="grid gap-3 md:grid-cols-3">
              <OpenActionsMetric
                label="Open Actions"
                value={String(actions.length)}
                detail="Pending workflow decisions assigned to you"
              />
              <OpenActionsMetric
                label="Live Cards"
                value={String(workspaceCardCount ?? 0)}
                detail="Saving cards currently in the workspace"
              />
              <OpenActionsMetric
                label="Workflow Coverage"
                value={readiness?.isWorkflowReady ? "Ready" : "Needs setup"}
                detail="Approval-role coverage"
              />
            </div>
            <div className="space-y-2">
              {nextActions.slice(0, 3).map((item) => (
                <div key={item} className="rounded-xl bg-[var(--muted)] px-4 py-3 text-sm">
                  {item}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!actions.length ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {readiness?.isWorkspaceReady
                ? "No open actions are assigned to you right now"
                : "No open actions are assigned to you, but setup is still in progress"}
            </CardTitle>
            <CardDescription>
              {typeof workspaceCardCount === "number" && workspaceCardCount > 0
                ? `Your workspace has ${workspaceCardCount} saving card${workspaceCardCount === 1 ? "" : "s"}, but there are no pending approvals waiting on you at the moment.`
                : "There are no pending approvals or workflow tasks currently waiting on you."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-[var(--muted-foreground)]">
              {readiness?.isWorkspaceReady
                ? "When cards advance into approval steps assigned to your role, they will appear here automatically."
                : "Finish the missing setup items and progress active cards through the workflow so approval routing becomes fully operational."}
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/saving-cards" className={buttonVariants({ size: "sm" })}>
                View saving cards
              </Link>
              <Link href="/admin" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Review setup
              </Link>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {nextActions.slice(0, 3).map((item) => (
                <div key={item} className="rounded-xl bg-[var(--muted)] px-4 py-3 text-sm">
                  {item}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {actions.length ? (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Workflow Filters</CardTitle>
              <p className="mt-1 text-[14px] text-[var(--muted-foreground)]">
                Search by saving card, requester, or comment, and narrow the queue by requested phase.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/60 p-2">
              <Filter className="h-4 w-4 text-[var(--muted-foreground)]" />
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-[1.4fr_0.8fr_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search saving card, requester, comment, or phase"
                className="pl-10"
              />
            </div>
            <Select value={requestedPhaseFilter} onChange={(event) => setRequestedPhaseFilter(event.target.value)}>
              <option value="">All requested phases</option>
              {phases.map((phase) => (
                <option key={phase} value={phase}>
                  {phaseLabels[phase]}
                </option>
              ))}
            </Select>
            <Button
              type="button"
              variant="outline"
              onClick={clearFilters}
              disabled={!activeFilters}
            >
              Clear filters
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {actions.length && !filteredActions.length ? (
        <Card>
          <CardHeader>
            <CardTitle>No open actions match the current view</CardTitle>
            <CardDescription>
              Your queue still has {actions.length} open action{actions.length === 1 ? "" : "s"}, but none match the active search or requested-phase filter.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm text-[var(--muted-foreground)]">
              Clear the filters to return to the full workflow queue, or open the related saving cards directly from the portfolio.
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
              <Link href="/saving-cards" className={buttonVariants({ size: "sm" })}>
                View saving cards
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {filteredActions.map((action) => (
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

function OpenActionsMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white/80 p-4 text-[var(--foreground)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">{detail}</p>
    </div>
  );
}

function OpenActionsPromise({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">{description}</p>
    </div>
  );
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(date));
}

function buildOpenActionsNextActions(
  readiness: WorkspaceReadiness | null | undefined,
  actionCount: number
) {
  const actions: string[] = [];
  const workspaceCardCount = readiness?.counts.savingCards ?? 0;

  if (!workspaceCardCount) {
    actions.push("Create the first saving card to activate approval routing and workflow actions.");
  } else if (!actionCount) {
    actions.push("Advance live saving cards into approval steps so assigned workflow actions start appearing here.");
  } else if (workspaceCardCount < 3) {
    actions.push("Add and progress more saving cards so the approval queue becomes more representative of live workload.");
  }

  readiness?.missingCoreSetup.forEach((item) => {
    actions.push(`Add ${item} in Settings so new saving cards enter the workflow with shared master data.`);
  });

  readiness?.missingWorkflowCoverage.forEach((item) => {
    actions.push(`Assign at least one ${item} user so approvals route cleanly when cards advance phases.`);
  });

  if (!actions.length) {
    actions.push("Monitor this queue as cards move through the workflow and clear assigned approvals promptly.");
  }

  return actions.slice(0, 4);
}
