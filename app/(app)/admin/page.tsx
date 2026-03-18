export const dynamic = "force-dynamic";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireUser } from "@/lib/auth";
import { getWorkspaceReadiness } from "@/lib/data";

type WorkspaceReadiness = Awaited<ReturnType<typeof getWorkspaceReadiness>>;

const EMPTY_WORKSPACE_READINESS: WorkspaceReadiness = {
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
  const user = await requireUser();

  let readiness: WorkspaceReadiness = EMPTY_WORKSPACE_READINESS;

  try {
    readiness = await getWorkspaceReadiness(user.organizationId);
  } catch (error) {
    console.log("Workspace readiness could not be loaded:", error);
  }

  const setupActions = readiness.isWorkspaceReady
    ? [
        "Core master data is configured and approval coverage is in place.",
        "This workspace is ready for standardized saving-card creation and workflow routing.",
      ]
    : [
        ...readiness.missingCoreSetup.map((item) => `Add ${item}.`),
        ...readiness.missingWorkflowCoverage.map((item) => `Assign at least one ${item} user.`),
      ];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <SectionHeading title="Settings" />
        <p className="max-w-3xl text-sm text-[var(--muted-foreground)]">
          Review workspace readiness, core master data coverage, and approval-role coverage before onboarding more users or scaling saving-card creation.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Workspace Readiness</CardTitle>
            <CardDescription>Use this as the first-run check for master data, governance coverage, and live workspace activity.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <MetricCard
              label="Workspace Status"
              value={readiness.isWorkspaceReady ? "Configured" : "Setup in progress"}
              detail={
                readiness.isWorkspaceReady
                  ? "Master data and approval coverage are in place."
                  : "Some setup items still need attention."
              }
              ready={readiness.isWorkspaceReady}
            />
            <MetricCard
              label="Card Creation Readiness"
              value={readiness.isMasterDataReady ? "Standardized" : `${readiness.missingCoreSetup.length} gaps`}
              detail={
                readiness.isMasterDataReady
                  ? "Core master data exists for repeatable card creation."
                  : "Settings still has missing master-data collections."
              }
              ready={readiness.isMasterDataReady}
            />
            <MetricCard
              label="Users"
              value={String(readiness.counts.users)}
              detail="Authenticated workspace users"
              ready={readiness.counts.users > 0}
            />
            <MetricCard
              label="Saving Cards"
              value={String(readiness.counts.savingCards)}
              detail="Cards currently stored in this workspace"
              ready={readiness.counts.savingCards > 0}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Next Setup Steps</CardTitle>
            <CardDescription>Focus on the remaining gaps that affect structured data entry and approval routing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {setupActions.map((item) => (
              <div key={item} className="rounded-xl bg-[var(--muted)] px-4 py-3">
                {item}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Core Master Data</CardTitle>
          <CardDescription>These collections support consistent saving-card creation, filtering, and reporting.</CardDescription>
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
            <CardTitle>Access Base</CardTitle>
            <CardDescription>Users remain the authenticated actors for approvals, comments, audit, and notifications.</CardDescription>
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
            <CardTitle>Workflow Role Coverage</CardTitle>
            <CardDescription>These roles support the seeded phase-approval workflow and should exist before wider rollout.</CardDescription>
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
      <p className="mt-3 text-xs uppercase tracking-wide text-[var(--muted-foreground)]">{label}</p>
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
