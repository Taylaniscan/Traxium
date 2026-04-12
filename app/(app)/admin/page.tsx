export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { isAuthGuardError, requirePermission } from "@/lib/auth";
import { getWorkspaceReadiness } from "@/lib/data";
import type { WorkspaceReadiness } from "@/lib/types";

const EMPTY_WORKSPACE_READINESS: WorkspaceReadiness = {
  workspace: {
    id: "workspace",
    name: "Workspace",
    slug: "workspace",
    createdAt: new Date(0),
    updatedAt: new Date(0),
  },
  counts: {
    users: 0,
    buyers: 0,
    suppliers: 0,
    materials: 0,
    categories: 0,
    plants: 0,
    businessUnits: 0,
    savingCards: 0,
  },
  masterData: [
    {
      key: "buyers",
      label: "Buyers",
      count: 0,
      ready: false,
      description: "Commercial ownership for saving cards.",
    },
    {
      key: "suppliers",
      label: "Suppliers",
      count: 0,
      ready: false,
      description: "Baseline and alternative sourcing counterparties.",
    },
    {
      key: "materials",
      label: "Materials",
      count: 0,
      ready: false,
      description: "Material or part master records for sourcing cases.",
    },
    {
      key: "categories",
      label: "Categories",
      count: 0,
      ready: false,
      description: "Category ownership and savings target structure.",
    },
    {
      key: "plants",
      label: "Plants",
      count: 0,
      ready: false,
      description: "Operational scope for plant-level initiatives.",
    },
    {
      key: "businessUnits",
      label: "Business Units",
      count: 0,
      ready: false,
      description: "Reporting and accountability structure.",
    },
  ],
  workflowCoverage: [
    {
      key: "HEAD_OF_GLOBAL_PROCUREMENT",
      label: "Head of Global Procurement",
      count: 0,
      ready: false,
    },
    {
      key: "GLOBAL_CATEGORY_LEADER",
      label: "Global Category Leader",
      count: 0,
      ready: false,
    },
    {
      key: "FINANCIAL_CONTROLLER",
      label: "Financial Controller",
      count: 0,
      ready: false,
    },
  ],
  coverage: {
    masterDataReadyCount: 0,
    masterDataTotal: 6,
    workflowReadyCount: 0,
    workflowTotal: 3,
    overallPercent: 0,
  },
  activity: {
    firstSavingCardCreatedAt: null,
    lastPortfolioUpdateAt: null,
  },
  isMasterDataReady: false,
  isWorkflowReady: false,
  isWorkspaceReady: false,
  missingCoreSetup: ["Buyers", "Suppliers", "Materials", "Categories", "Plants", "Business Units"],
  missingWorkflowCoverage: [
    "Head of Global Procurement",
    "Global Category Leader",
    "Financial Controller",
  ],
};

export default async function AdminPage() {
  let user: Awaited<ReturnType<typeof requirePermission>>;

  try {
    user = await requirePermission("manageWorkspace");
  } catch (error) {
    if (isAuthGuardError(error) && error.code === "FORBIDDEN") {
      redirect("/dashboard");
    }

    throw error;
  }

  let readiness: WorkspaceReadiness = EMPTY_WORKSPACE_READINESS;

  try {
    readiness = await getWorkspaceReadiness(user.organizationId);
  } catch (error) {
    console.log("Workspace readiness could not be loaded:", error);
  }

  const workspaceName = readiness.workspace.name;
  const liveDataStatus =
    readiness.counts.savingCards > 0
      ? `${readiness.counts.savingCards} live saving card${readiness.counts.savingCards === 1 ? "" : "s"}`
      : "No live saving cards yet";
  const setupActions = readiness.isWorkspaceReady
    ? [
        "Core master data is configured and approval coverage is in place.",
        "Operational controls are ready for wider rollout and standardized saving-card execution.",
      ]
    : [
        ...readiness.missingCoreSetup.map((item) => `Add ${item}.`),
        ...readiness.missingWorkflowCoverage.map((item) => `Assign at least one ${item} user.`),
      ];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <SectionHeading title="Workspace Settings" />
        <p className="max-w-3xl text-sm text-[var(--muted-foreground)]">
          Review operational readiness, control coverage, and master-data health before onboarding more users or scaling saving-card creation.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Workspace Identity</CardTitle>
            <CardDescription>Core account details that anchor this workspace as an organization-scoped operating environment.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/45 p-5 md:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-[var(--muted-foreground)]">Workspace</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight">{workspaceName}</p>
                  <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                    Organization slug <span className="font-medium text-[var(--foreground)]">{readiness.workspace.slug}</span>
                  </p>
                </div>
                <StatusPill ready={readiness.isWorkspaceReady} />
              </div>
            </div>
            <MetricCard
              label="Launched"
              value={formatDateLabel(readiness.workspace.createdAt, "Unknown")}
              detail="Workspace creation date"
              ready
            />
            <MetricCard
              label="Portfolio Activity"
              value={formatDateLabel(readiness.activity.lastPortfolioUpdateAt, "No updates yet")}
              detail="Latest saving-card activity recorded in this workspace"
              ready={Boolean(readiness.activity.lastPortfolioUpdateAt)}
            />
            <MetricCard
              label="Live Data Status"
              value={liveDataStatus}
              detail="Saving cards currently contributing live portfolio data"
              ready={readiness.counts.savingCards > 0}
            />
            <MetricCard
              label="Authenticated Users"
              value={String(readiness.counts.users)}
              detail="Named users available for workflow, audit, and notifications"
              ready={readiness.counts.users > 0}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Operational Control Posture</CardTitle>
            <CardDescription>Use this as the commercial readiness summary for rollout, governance, and operational data quality.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <MetricCard
              label="Setup Completeness"
              value={`${readiness.coverage.overallPercent}%`}
              detail={
                readiness.isWorkspaceReady
                  ? "Core setup checks are complete."
                  : "Some setup checks still need attention."
              }
              ready={readiness.isWorkspaceReady}
            />
            <MetricCard
              label="Master Data Health"
              value={`${readiness.coverage.masterDataReadyCount}/${readiness.coverage.masterDataTotal}`}
              detail={
                readiness.isMasterDataReady
                  ? "Collections are in place for repeatable card creation."
                  : "Some collections still need to be configured."
              }
              ready={readiness.isMasterDataReady}
            />
            <MetricCard
              label="Approval Coverage"
              value={`${readiness.coverage.workflowReadyCount}/${readiness.coverage.workflowTotal}`}
              detail="Required approval roles currently staffed"
              ready={readiness.isWorkflowReady}
            />
            <MetricCard
              label="Workspace Status"
              value={readiness.isWorkspaceReady ? "Operationally ready" : "Setup in progress"}
              detail="Master data, workflow roles, and access base in this tenant"
              ready={readiness.isWorkspaceReady}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Rollout Priorities</CardTitle>
            <CardDescription>Focus on the remaining gaps that affect structured data entry, approval routing, and operational trust.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {setupActions.map((item) => (
              <div key={item} className="rounded-xl bg-[var(--muted)] px-4 py-3">
                {item}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Operational Trust Signals</CardTitle>
            <CardDescription>Practical cues that show whether the workspace is ready for broader adoption.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <MetricCard
              label="Org-Scoped Workspace"
              value={readiness.workspace.slug}
              detail="All cards, buyers, approvals, and audit data are tied to this workspace boundary"
              ready
            />
            <MetricCard
              label="Buyer Separation"
              value={String(readiness.counts.buyers)}
              detail="Buyer master data is maintained separately from authenticated users"
              ready={readiness.counts.buyers > 0}
            />
            <MetricCard
              label="Workflow Roles"
              value={readiness.isWorkflowReady ? "Covered" : "Incomplete"}
              detail="Approval routing is only production-ready when all required roles are assigned"
              ready={readiness.isWorkflowReady}
            />
            <MetricCard
              label="Portfolio Footprint"
              value={String(readiness.counts.savingCards)}
              detail="Saving cards currently stored inside this workspace"
              ready={readiness.counts.savingCards > 0}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Master Data Health</CardTitle>
          <CardDescription>These collections underpin standardized card creation, filtering, reporting, and buyer assignment.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {readiness.masterData.map((item) => (
            <ReadinessCard
              key={item.key}
              title={item.label}
              count={item.count}
              description={item.description}
              ready={item.ready}
            />
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Access Model</CardTitle>
            <CardDescription>Users remain the authenticated actors for approvals, comments, audit, notifications, and evidence actions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ReadinessCard
              title="Workspace Users"
              count={readiness.counts.users}
              description="Users can log in, appear in stakeholder lists, and receive workflow tasks."
              ready={readiness.counts.users > 0}
            />
            <ReadinessCard
              title="Buyer Master Data"
              count={readiness.counts.buyers}
              description="Buyers are separate business master data and can be assigned on saving cards."
              ready={readiness.counts.buyers > 0}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Approval Control Coverage</CardTitle>
            <CardDescription>These roles support the live phase-approval workflow and should be staffed before wider rollout.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            {readiness.workflowCoverage.map((item) => (
              <ReadinessCard
                key={item.key}
                title={item.label}
                count={item.count}
                description="At least one active user should cover this approval responsibility."
                ready={item.ready}
              />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function formatDateLabel(value: Date | null, fallback: string) {
  if (!value) {
    return fallback;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function MetricCard({
  label,
  value,
  detail,
  ready,
}: {
  label: string;
  value: string;
  detail: string;
  ready: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/45 p-4">
      <StatusPill ready={ready} />
      <p className="mt-3 text-xs text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">{detail}</p>
    </div>
  );
}

function ReadinessCard({
  title,
  count,
  description,
  ready,
}: {
  title: string;
  count: number;
  description: string;
  ready: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">{description}</p>
        </div>
        <StatusPill ready={ready} />
      </div>
      <p className="mt-4 text-2xl font-semibold tracking-tight">{count}</p>
    </div>
  );
}

function StatusPill({ ready }: { ready: boolean }) {
  return (
    <span
      className={
        ready
          ? "inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800"
          : "inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800"
      }
    >
      {ready ? "Ready" : "Needs setup"}
    </span>
  );
}
