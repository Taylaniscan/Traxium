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
  canDecide: boolean;
  pendingApproverSummary: string;
};

type WorkspaceReadiness = Awaited<ReturnType<typeof import("@/lib/data").getWorkspaceReadiness>>;

export function OpenActionsList({
  actions,
  readiness,
  view = "mine",
  viewOptions = [],
}: {
  actions: OpenAction[];
  readiness?: WorkspaceReadiness | null;
  view?: "mine" | "all";
  viewOptions?: Array<{
    label: string;
    href: string;
    active: boolean;
  }>;
}) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [requestedPhaseFilter, setRequestedPhaseFilter] = useState("");
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);
  const [bulkSummary, setBulkSummary] = useState<{ message: string; tone: "success" | "error" } | null>(null);

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
    setBulkSummary(null);

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
  const canBulkApprove =
    view === "mine" && !activeFilters && filteredActions.length >= 2;
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
  const viewDescription =
    view === "all"
      ? "Portfolio-wide queue of pending phase-change requests across the workspace."
      : "Approval requests currently assigned to you.";

  function clearFilters() {
    setSearch("");
    setRequestedPhaseFilter("");
    setBulkConfirmOpen(false);
    setBulkSummary(null);
  }

  async function approveAllActions() {
    const total = actions.length;

    if (total < 2) {
      return;
    }

    setBulkConfirmOpen(false);
    setBulkSummary(null);
    setError(null);

    let approvedCount = 0;
    let failedCount = 0;

    for (const [index, action] of actions.entries()) {
      setBulkProgress({ current: index + 1, total });

      try {
        const response = await fetch("/api/approve-phase-change", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: action.requestId, approved: true })
        });

        if (!response.ok) {
          failedCount += 1;
          continue;
        }

        approvedCount += 1;
      } catch {
        failedCount += 1;
      }
    }

    setBulkProgress(null);
    setBulkSummary({
      message:
        failedCount > 0
          ? `${approvedCount} approved, ${failedCount} failed`
          : `${approvedCount} initiative${approvedCount === 1 ? "" : "s"} approved`,
      tone: failedCount > 0 ? "error" : "success"
    });
    router.refresh();
  }

  if (!actions.length && !hasWorkspaceCards) {
    return (
      <div className="space-y-6">
        {viewOptions.length ? (
          <WorkflowViewCard description={viewDescription} options={viewOptions} />
        ) : null}
        <Card className="border-0 bg-[linear-gradient(135deg,#113b61_0%,#194f7a_58%,#1b7f87_100%)] text-white">
          <CardContent className="grid gap-6 p-8 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4">
              <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-cyan-100">
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
      {viewOptions.length ? (
        <WorkflowViewCard description={viewDescription} options={viewOptions} />
      ) : null}
      {showRampUpState ? (
        <Card className="border-dashed">
          <CardHeader>
              <CardTitle>
              {readiness?.isWorkspaceReady
                ? view === "all"
                  ? "Workspace workflow queue is live and still ramping up"
                  : "Workflow queue is live and still ramping up"
                : view === "all"
                  ? "Workspace workflow queue is live, but setup is still in progress"
                  : "Workflow queue is live, but setup is still in progress"}
            </CardTitle>
            <CardDescription>
              {readiness?.isWorkspaceReady
                ? view === "all"
                  ? `There ${actions.length === 1 ? "is" : "are"} currently ${actions.length} open action${actions.length === 1 ? "" : "s"} across the workspace. The queue becomes more representative as more saving cards advance through the workflow.`
                  : `You currently have ${actions.length} open action${actions.length === 1 ? "" : "s"} assigned to you. The queue becomes more representative as more saving cards advance through the workflow.`
                : view === "all"
                  ? `There ${actions.length === 1 ? "is" : "are"} already ${actions.length} open action${actions.length === 1 ? "" : "s"} in the workspace, but shared setup still needs attention to keep approval routing consistent.`
                  : `You already have ${actions.length} open action${actions.length === 1 ? "" : "s"}, but shared setup still needs attention to keep approval routing consistent.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="grid gap-3 md:grid-cols-3">
              <OpenActionsMetric
                label="Open Actions"
                value={String(actions.length)}
                detail={
                  view === "all"
                    ? "Pending workflow decisions across the workspace"
                    : "Pending workflow decisions assigned to you"
                }
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
              {view === "all"
                ? readiness?.isWorkspaceReady
                  ? "No open actions exist in the workspace right now"
                  : "No open actions exist yet, and setup is still in progress"
                : readiness?.isWorkspaceReady
                  ? "No open actions are assigned to you right now"
                  : "No open actions are assigned to you, but setup is still in progress"}
            </CardTitle>
            <CardDescription>
              {view === "all"
                ? typeof workspaceCardCount === "number" && workspaceCardCount > 0
                  ? `Your workspace has ${workspaceCardCount} saving card${workspaceCardCount === 1 ? "" : "s"}, but there are no pending approvals anywhere in the portfolio at the moment.`
                  : "There are no pending approvals or workflow tasks in the workspace yet."
                : typeof workspaceCardCount === "number" && workspaceCardCount > 0
                  ? `Your workspace has ${workspaceCardCount} saving card${workspaceCardCount === 1 ? "" : "s"}, but there are no pending approvals waiting on you at the moment.`
                  : "There are no pending approvals or workflow tasks currently waiting on you."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-[var(--muted-foreground)]">
              {view === "all"
                ? readiness?.isWorkspaceReady
                  ? "As cards move into approval steps, pending workflow requests from across the workspace will appear here automatically."
                  : "Finish the missing setup items and progress active cards through the workflow so the workspace queue becomes fully operational."
                : readiness?.isWorkspaceReady
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
              <CardTitle>{view === "all" ? "Workspace Workflow Filters" : "Workflow Filters"}</CardTitle>
              <p className="mt-1 text-[14px] text-[var(--muted-foreground)]">
                Search by saving card, requester, or comment, and narrow the queue by requested phase.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/60 p-2">
              <Filter className="h-4 w-4 text-[var(--muted-foreground)]" />
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-[1.4fr_0.8fr_auto_auto]">
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
            {canBulkApprove ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setBulkSummary(null);
                  setBulkConfirmOpen(true);
                }}
                disabled={Boolean(bulkProgress)}
              >
                Approve All
              </Button>
            ) : null}

            {bulkConfirmOpen ? (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/35 px-4 py-3 text-sm md:col-span-4">
                <p className="font-medium text-[var(--foreground)]">
                  Are you sure you want to approve the {actions.length} approval request{actions.length === 1 ? "" : "s"} on this page?
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <Button type="button" onClick={approveAllActions}>
                    Yes, Approve
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setBulkConfirmOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}

            {bulkProgress ? (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/35 px-4 py-3 text-sm text-[var(--foreground)] md:col-span-4">
                Processing {bulkProgress.current} / {bulkProgress.total}...
              </div>
            ) : null}

            {bulkSummary ? (
              <div
                className={cn(
                  "rounded-xl px-4 py-3 text-sm md:col-span-4",
                  bulkSummary.tone === "success"
                    ? "border border-emerald-200 bg-emerald-50/80 text-emerald-900"
                    : "border border-rose-200 bg-rose-50/80 text-rose-900"
                )}
              >
                {bulkSummary.message}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {actions.length && !filteredActions.length ? (
        <Card>
          <CardHeader>
            <CardTitle>No open actions match the current view</CardTitle>
            <CardDescription>
              {view === "all"
                ? `The workspace still has ${actions.length} open action${actions.length === 1 ? "" : "s"}, but none match the active search or requested-phase filter.`
                : `Your queue still has ${actions.length} open action${actions.length === 1 ? "" : "s"}, but none match the active search or requested-phase filter.`}
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
                <p className="text-xs text-[var(--muted-foreground)]">
                  {action.pendingApproverSummary}
                </p>
              </div>
              <div className="text-right text-sm text-[var(--muted-foreground)]">
                <p>Requested by {action.requestedBy}</p>
                <p>{formatDate(action.requestedAt)}</p>
              </div>
            </div>

            {action.comment ? <p className="text-sm text-[var(--muted-foreground)]">{action.comment}</p> : null}

            <div className="flex flex-wrap gap-3">
              {action.canDecide ? (
                <>
                  <Button
                    onClick={() => submitDecision(action.requestId, true)}
                    disabled={loadingId === action.requestId || Boolean(bulkProgress)}
                    className="rounded-[8px] bg-[#059669] px-5 py-2 text-white hover:bg-[#047857]"
                  >
                    {loadingId === action.requestId ? "Processing..." : "Approve"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => submitDecision(action.requestId, false)}
                    disabled={loadingId === action.requestId || Boolean(bulkProgress)}
                    className="rounded-[8px] border-[1.5px] border-[#f43f5e] bg-white px-5 py-2 text-[#e11d48] hover:bg-[#fff1f2] hover:text-[#e11d48]"
                  >
                    Reject
                  </Button>
                </>
              ) : (
                <div className="inline-flex items-center rounded-[8px] border border-[var(--border)] bg-[var(--muted)]/45 px-4 py-2 text-sm text-[var(--muted-foreground)]">
                  Approval is assigned to another reviewer
                </div>
              )}
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

function WorkflowViewCard({
  description,
  options,
}: {
  description: string;
  options: Array<{
    label: string;
    href: string;
    active: boolean;
  }>;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--foreground)]">Action Views</p>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {options.map((option) => (
            <Link
              key={option.href}
              href={option.href}
              aria-current={option.active ? "page" : undefined}
              className={buttonVariants({
                variant: option.active ? "default" : "outline",
                size: "sm",
              })}
            >
              {option.label}
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
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
      <p className="text-[11px] font-semibold text-[var(--muted-foreground)]">
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
