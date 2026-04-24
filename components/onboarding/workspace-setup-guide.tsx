import Link from "next/link";
import type { OrganizationRole } from "@prisma/client";

import { FirstValueLaunchpad } from "@/components/onboarding/first-value-launchpad";
import { MasterDataStarterTable } from "@/components/onboarding/master-data-starter-table";
import { MasterDataUploadStep } from "@/components/onboarding/master-data-upload-step";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  MASTER_DATA_IMPORT_ENTITY_KEYS,
  MASTER_DATA_ONBOARDING_ENTITY_KEYS,
  getMasterDataOnboardingStepConfig,
  getMasterDataTemplateDownloadHref,
  isMasterDataImportEntityKey,
} from "@/lib/onboarding/master-data-config";
import type { WorkspaceMasterDataItem, WorkspaceReadiness } from "@/lib/types";

type WorkspaceSetupGuideProps = {
  readiness: WorkspaceReadiness | null;
  readinessError?: string | null;
  userName: string;
  viewerMembershipRole: OrganizationRole;
};

type StepStatus = "complete" | "current" | "pending" | "recommended";

type ActivationCheck = {
  key: string;
  label: string;
  description: string;
  ready: boolean;
};

const LINK_BUTTON_CLASS_NAME =
  "inline-flex items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]";

const PRIMARY_LINK_BUTTON_CLASS_NAME =
  "inline-flex items-center justify-center rounded-md border border-transparent bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] shadow-[0_1px_2px_rgba(15,23,42,0.08)] transition hover:bg-[var(--primary-action-hover)]";

const GHOST_LINK_BUTTON_CLASS_NAME =
  "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[rgba(23,33,43,0.04)] hover:text-[var(--text-primary)]";

const MASTER_DATA_BUSINESS_COPY: Record<
  WorkspaceMasterDataItem["key"],
  string
> = {
  buyers:
    "Buyers show who owns a savings initiative and who should keep it moving.",
  suppliers:
    "Suppliers make baseline and negotiated prices credible instead of anonymous.",
  materials:
    "Materials anchor volume, price, and scope so savings calculations are concrete.",
  categories:
    "Categories make savings easier to review by procurement area and ownership.",
  plants:
    "Plants show where operational impact lands and improve site-level reporting.",
  businessUnits:
    "Business units help leaders compare savings by division or operating group.",
};

function getFirstName(name: string) {
  const normalized = name.trim();

  if (!normalized) {
    return "there";
  }

  return normalized.split(/\s+/u)[0] ?? normalized;
}

function formatCount(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function getMasterDataItem(
  readiness: WorkspaceReadiness | null,
  key: WorkspaceMasterDataItem["key"]
) {
  return readiness?.masterData.find((item) => item.key === key) ?? null;
}

function getWorkflowItem(
  readiness: WorkspaceReadiness | null,
  key: "HEAD_OF_GLOBAL_PROCUREMENT" | "GLOBAL_CATEGORY_LEADER" | "FINANCIAL_CONTROLLER"
) {
  return readiness?.workflowCoverage.find((item) => item.key === key) ?? null;
}

function getActivationModel(readiness: WorkspaceReadiness | null) {
  const buyerCount = readiness?.counts.buyers ?? 0;
  const supplierCount = readiness?.counts.suppliers ?? 0;
  const materialCount = readiness?.counts.materials ?? 0;
  const categoryCount = readiness?.counts.categories ?? 0;
  const plantCount = readiness?.counts.plants ?? 0;
  const businessUnitCount = readiness?.counts.businessUnits ?? 0;
  const savingCardCount = readiness?.counts.savingCards ?? 0;
  const financialControllerReady =
    getWorkflowItem(readiness, "FINANCIAL_CONTROLLER")?.ready ?? false;
  const headOfGlobalProcurementReady =
    getWorkflowItem(readiness, "HEAD_OF_GLOBAL_PROCUREMENT")?.ready ?? false;
  const globalCategoryLeaderReady =
    getWorkflowItem(readiness, "GLOBAL_CATEGORY_LEADER")?.ready ?? false;
  const materialOrCategoryReady = materialCount > 0 || categoryCount > 0;

  const requiredChecks: ActivationCheck[] = [
    {
      key: "workspace",
      label: "Workspace identity",
      description:
        "Name and tenant boundary are ready for procurement savings work.",
      ready: true,
    },
    {
      key: "buyer",
      label: "At least one buyer",
      description:
        "A named owner keeps the first saving card accountable.",
      ready: buyerCount > 0,
    },
    {
      key: "supplier",
      label: "At least one supplier",
      description:
        "A supplier makes baseline and new price comparison credible.",
      ready: supplierCount > 0,
    },
    {
      key: "material-or-category",
      label: "At least one material or category",
      description:
        "One commercial scope dimension is enough to start first value.",
      ready: materialOrCategoryReady,
    },
    {
      key: "saving-card",
      label: "At least one saving card",
      description:
        "First value is created from one real savings initiative.",
      ready: savingCardCount > 0,
    },
  ];

  const recommendedChecks: ActivationCheck[] = [
    {
      key: "plants",
      label: "Plants",
      description: "Useful for site-level savings reporting.",
      ready: plantCount > 0,
    },
    {
      key: "business-units",
      label: "Business units",
      description: "Useful for division-level portfolio reviews.",
      ready: businessUnitCount > 0,
    },
    {
      key: "categories",
      label: "More complete categories",
      description: "Improves ownership, targets, and reports.",
      ready: categoryCount > 0,
    },
    {
      key: "finance-team",
      label: "Finance approver/team setup",
      description: "Finance validation and procurement approvals become clearer.",
      ready:
        financialControllerReady &&
        headOfGlobalProcurementReady &&
        globalCategoryLeaderReady,
    },
    {
      key: "evidence",
      label: "Evidence attached to saving cards",
      description:
        "Quotes, confirmations, and calculation files strengthen finance trust.",
      ready: savingCardCount > 0,
    },
  ];

  const requiredReadyCount = requiredChecks.filter((check) => check.ready).length;
  const progressPercent = Math.round(
    (requiredReadyCount / requiredChecks.length) * 100
  );
  const firstValueReady = requiredChecks.every((check) => check.ready);
  const businessStructureReady =
    buyerCount > 0 && supplierCount > 0 && materialOrCategoryReady;
  const roleCoverageReady =
    financialControllerReady && headOfGlobalProcurementReady;

  return {
    buyerCount,
    supplierCount,
    materialCount,
    categoryCount,
    plantCount,
    businessUnitCount,
    savingCardCount,
    requiredChecks,
    recommendedChecks,
    requiredReadyCount,
    progressPercent,
    firstValueReady,
    businessStructureReady,
    roleCoverageReady,
    missingRequired: requiredChecks.filter((check) => !check.ready),
    missingRecommended: recommendedChecks.filter((check) => !check.ready),
  };
}

function getStepBadge(status: StepStatus) {
  switch (status) {
    case "complete":
      return { label: "Complete", tone: "emerald" as const };
    case "current":
      return { label: "Recommended next", tone: "blue" as const };
    case "recommended":
      return { label: "Recommended", tone: "amber" as const };
    default:
      return { label: "Pending", tone: "slate" as const };
  }
}

function StepShell({
  stepNumber,
  title,
  description,
  status,
  children,
}: {
  stepNumber: number;
  title: string;
  description: string;
  status: StepStatus;
  children: React.ReactNode;
}) {
  const badge = getStepBadge(status);

  return (
    <Card className={status === "current" ? "border-[rgba(37,99,235,0.24)]" : undefined}>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={badge.tone}>{badge.label}</Badge>
          <span className="text-sm font-semibold text-[var(--muted-foreground)]">
            Step {stepNumber} of 7
          </span>
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function ReadinessCheckList({
  title,
  checks,
}: {
  title: string;
  checks: ActivationCheck[];
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p>
      <div className="mt-4 space-y-3">
        {checks.map((check) => (
          <div key={check.key} className="flex gap-3">
            <Badge tone={check.ready ? "emerald" : "amber"}>
              {check.ready ? "Ready" : "Missing"}
            </Badge>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--foreground)]">
                {check.label}
              </p>
              <p className="text-sm leading-6 text-[var(--muted-foreground)]">
                {check.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReadinessSnapshot({
  readiness,
  model,
}: {
  readiness: WorkspaceReadiness | null;
  model: ReturnType<typeof getActivationModel>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>First-value readiness</CardTitle>
        <CardDescription>
          Required checks keep the first saving card credible. Recommended checks
          improve reporting, but they should not stop you from starting.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/35 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
            First-value progress
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
            {model.progressPercent}%
          </p>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {model.requiredReadyCount} of {model.requiredChecks.length} required
            checks ready
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--muted)]">
            <div
              className="h-full rounded-full bg-[var(--primary)] transition-[width]"
              style={{ width: `${model.progressPercent}%` }}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <SnapshotFact
            label="Saving cards"
            value={String(readiness?.counts.savingCards ?? 0)}
          />
          <SnapshotFact
            label="Buyers"
            value={String(readiness?.counts.buyers ?? 0)}
          />
          <SnapshotFact
            label="Suppliers"
            value={String(readiness?.counts.suppliers ?? 0)}
          />
          <SnapshotFact
            label="Optional gaps"
            value={String(model.missingRecommended.length)}
          />
        </div>

        <ReadinessCheckList
          title="Required for first value"
          checks={model.requiredChecks}
        />
        <ReadinessCheckList
          title="Recommended for better reporting"
          checks={model.recommendedChecks}
        />
      </CardContent>
    </Card>
  );
}

function SnapshotFact({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold tracking-tight text-[var(--foreground)]">
        {value}
      </p>
    </div>
  );
}

function MasterDataAreaCard({
  item,
}: {
  item: WorkspaceMasterDataItem;
}) {
  const config = getMasterDataOnboardingStepConfig(item.key);

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {item.label}
          </p>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Current count: {item.count}
          </p>
        </div>
        <Badge tone={item.ready ? "emerald" : "amber"}>
          {item.ready ? "Ready" : "Missing"}
        </Badge>
      </div>
      <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
        {MASTER_DATA_BUSINESS_COPY[item.key]}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={getMasterDataTemplateDownloadHref(item.key)}
          className={GHOST_LINK_BUTTON_CLASS_NAME}
          download={config.templateFileName}
        >
          Download template
        </a>
        <MasterDataStarterTable entityKey={item.key} count={item.count} compact />
      </div>
    </div>
  );
}

function buildMasterDataItems(readiness: WorkspaceReadiness | null) {
  return MASTER_DATA_ONBOARDING_ENTITY_KEYS.map((key) => {
    const liveItem = getMasterDataItem(readiness, key);
    const config = getMasterDataOnboardingStepConfig(key);

    return (
      liveItem ?? {
        key,
        label: config.title.replace("Set up ", "").replace(/^\w/u, (match) =>
          match.toUpperCase()
        ),
        count: 0,
        ready: false,
        description: config.description,
      }
    );
  });
}

function BusinessStructureStep({
  readiness,
  status,
}: {
  readiness: WorkspaceReadiness | null;
  status: StepStatus;
}) {
  const masterDataItems = buildMasterDataItems(readiness);
  const uploadFocusKey =
    MASTER_DATA_IMPORT_ENTITY_KEYS.find(
      (key) => !getMasterDataItem(readiness, key)?.ready
    ) ?? MASTER_DATA_IMPORT_ENTITY_KEYS[0];
  const uploadFocusItem = getMasterDataItem(readiness, uploadFocusKey);
  const uploadStatus: "complete" | "current" | "pending" =
    uploadFocusItem?.ready ? "complete" : status === "pending" ? "pending" : "current";

  return (
    <StepShell
      stepNumber={2}
      title="Business structure and master data"
      description="Add enough procurement structure to create a credible first saving card. You do not need a perfect setup to begin."
      status={status}
    >
      <div id="business-structure-master-data" className="space-y-5">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/35 p-4 text-sm leading-6 text-[var(--muted-foreground)]">
          Start with one real savings initiative. Buyers, suppliers, and either
          a material or category are enough for first value. Plants and business
          units can be completed later for better reporting.
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {masterDataItems.map((item) => (
            <MasterDataAreaCard key={item.key} item={item} />
          ))}
        </div>

        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-[var(--foreground)]">
              Upload-ready template
            </h3>
            <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
              Use the next missing upload-ready area below, or download any
              template from the cards above.
            </p>
          </div>
          {isMasterDataImportEntityKey(uploadFocusKey) ? (
            <MasterDataUploadStep
              stepNumber={2}
              entityKey={uploadFocusKey}
              status={uploadStatus}
              count={uploadFocusItem?.count ?? 0}
            />
          ) : null}
        </div>
      </div>
    </StepShell>
  );
}

function RoleCoverageRow({
  label,
  detail,
  count,
  readyLabel,
}: {
  label: string;
  detail: string;
  count: number;
  readyLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[var(--foreground)]">{label}</p>
        <Badge tone={count > 0 ? "emerald" : "amber"}>
          {count > 0 ? readyLabel : "Missing"}
        </Badge>
      </div>
      <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
        {detail}
      </p>
    </div>
  );
}

function TeamAndRolesStep({
  readiness,
  status,
  viewerMembershipRole,
}: {
  readiness: WorkspaceReadiness | null;
  status: StepStatus;
  viewerMembershipRole: OrganizationRole;
}) {
  const financialController = getWorkflowItem(readiness, "FINANCIAL_CONTROLLER");
  const headOfProcurement = getWorkflowItem(readiness, "HEAD_OF_GLOBAL_PROCUREMENT");
  const categoryLeader = getWorkflowItem(readiness, "GLOBAL_CATEGORY_LEADER");

  return (
    <StepShell
      stepNumber={3}
      title="Team and roles"
      description="Workspace roles control administration. Business roles control procurement workflow actions and approval coverage."
      status={status}
    >
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <RoleCoverageRow
            label="Workspace Admin / Owner"
            detail={`Your current workspace access is ${viewerMembershipRole.toLowerCase()}. Owners and admins control workspace setup, members, and billing/admin actions.`}
            count={1}
            readyLabel="Available"
          />
          <RoleCoverageRow
            label="Financial Controller"
            detail="Needed for finance validation and confidence in reported savings."
            count={financialController?.count ?? 0}
            readyLabel="Covered"
          />
          <RoleCoverageRow
            label="Head of Global Procurement"
            detail="Needed for Validated approvals and senior procurement governance."
            count={headOfProcurement?.count ?? 0}
            readyLabel="Covered"
          />
          <RoleCoverageRow
            label="Business procurement roles"
            detail="Category leaders and buyers keep saving cards moving through real commercial workflow."
            count={categoryLeader?.count ?? 0}
            readyLabel="Covered"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--muted)]/35 p-4">
          <p className="max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
            Invite team members in Admin Members. Onboarding explains who is
            needed, but the member and invitation system stays in the admin area.
          </p>
          <Link href="/admin/members" className={PRIMARY_LINK_BUTTON_CLASS_NAME}>
            Invite team members in Admin Members
          </Link>
        </div>
      </div>
    </StepShell>
  );
}

function FirstSavingCardStep({
  savingCardCount,
  status,
}: {
  savingCardCount: number;
  status: StepStatus;
}) {
  return (
    <StepShell
      stepNumber={4}
      title="First saving card"
      description="First value comes from one complete savings card, not from perfect setup."
      status={status}
    >
      <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
            Current saving cards
          </p>
          <p className="mt-2 text-3xl font-semibold text-[var(--foreground)]">
            {savingCardCount}
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
            {savingCardCount > 0
              ? "At least one saving card exists, so this step is complete."
              : "Create one real saving card to turn setup into a live savings portfolio."}
          </p>
        </div>
        <div className="space-y-4">
          <p className="text-sm leading-6 text-[var(--muted-foreground)]">
            Add baseline price, new price, annual volume, currency, and impact
            dates. Attach evidence if available and submit a phase change when
            the record is ready for review.
          </p>
          <p className="text-sm leading-6 text-[var(--muted-foreground)]">
            You can complete master data later. Traxium becomes more useful as
            your data improves.
          </p>
          <Link href="/saving-cards/new" className={PRIMARY_LINK_BUTTON_CLASS_NAME}>
            Create first saving card
          </Link>
        </div>
      </div>
    </StepShell>
  );
}

function EvidenceTrustStep({
  savingCardCount,
  status,
}: {
  savingCardCount: number;
  status: StepStatus;
}) {
  return (
    <StepShell
      stepNumber={5}
      title="Evidence and finance trust"
      description="Finance trust improves when savings cards include evidence and approval history."
      status={status}
    >
      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            "Supplier quotes",
            "Supplier letters",
            "Price confirmations",
            "Calculation files",
            "Finance approval support",
          ].map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-medium text-[var(--foreground)]"
            >
              {item}
            </div>
          ))}
        </div>
        <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--muted)]/35 p-4">
          <p className="text-sm leading-6 text-[var(--muted-foreground)]">
            Evidence upload is available inside the saving card context after a
            record exists. Keep supporting files linked to the relevant card so
            approval history and finance validation stay together.
          </p>
          <Link
            href={savingCardCount > 0 ? "/saving-cards" : "/saving-cards/new"}
            className={LINK_BUTTON_CLASS_NAME}
          >
            {savingCardCount > 0 ? "Open Saving Cards" : "Create first saving card"}
          </Link>
        </div>
      </div>
    </StepShell>
  );
}

function ReportingStep({
  model,
  status,
}: {
  model: ReturnType<typeof getActivationModel>;
  status: StepStatus;
}) {
  const missingRequiredLabels = model.missingRequired.map((item) => item.label);
  const message = model.firstValueReady
    ? "Your workspace is ready for first portfolio review."
    : `Dashboard and reports are available, but first-value reporting will be limited until ${missingRequiredLabels.join(", ")} ${missingRequiredLabels.length === 1 ? "is" : "are"} ready.`;

  return (
    <StepShell
      stepNumber={6}
      title="Reporting and dashboard"
      description="Move from setup into the operating surfaces your team will use every week."
      status={status}
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/35 p-4">
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {message}
          </p>
          {model.missingRecommended.length ? (
            <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
              Recommended gaps such as {model.missingRecommended
                .slice(0, 3)
                .map((item) => item.label)
                .join(", ")} can be completed later for cleaner reporting.
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {[
            ["Dashboard", "Portfolio totals and current savings value."],
            ["Kanban", "Move savings initiatives through workflow stages."],
            ["Open Actions", "See approvals and pending work."],
            ["Reports", "Review executive summaries and exports."],
            ["Command Center", "Compare portfolio and governance signals."],
          ].map(([label, detail]) => (
            <div
              key={label}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
            >
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {label}
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                {detail}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard" className={PRIMARY_LINK_BUTTON_CLASS_NAME}>
            Go to Dashboard
          </Link>
          <Link href="/reports" className={LINK_BUTTON_CLASS_NAME}>
            Go to Reports
          </Link>
          <Link href="/kanban" className={LINK_BUTTON_CLASS_NAME}>
            Go to Kanban
          </Link>
        </div>
      </div>
    </StepShell>
  );
}

function FinishStep({
  model,
  completedStepLabels,
  status,
}: {
  model: ReturnType<typeof getActivationModel>;
  completedStepLabels: string[];
  status: StepStatus;
}) {
  const primaryAction =
    model.savingCardCount <= 0
      ? { href: "/saving-cards/new", label: "Create first saving card" }
      : !model.businessStructureReady
        ? { href: "/onboarding", label: "Complete setup" }
        : { href: "/dashboard", label: "Open dashboard" };

  return (
    <StepShell
      stepNumber={7}
      title="Finish or continue later"
      description="Use this checkpoint to decide whether to create first value now or come back after daily work."
      status={status}
    >
      <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/35 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
            Progress percentage
          </p>
          <p className="mt-2 text-4xl font-semibold text-[var(--foreground)]">
            {model.progressPercent}%
          </p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--muted)]">
            <div
              className="h-full rounded-full bg-[var(--primary)] transition-[width]"
              style={{ width: `${model.progressPercent}%` }}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              Completed steps
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
              {completedStepLabels.length
                ? completedStepLabels.join(", ")
                : "No guided steps are complete yet."}
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              Remaining blockers
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
              {model.missingRequired.length
                ? model.missingRequired.map((item) => item.label).join(", ")
                : "No first-value blockers remain."}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href={primaryAction.href} className={PRIMARY_LINK_BUTTON_CLASS_NAME}>
              {primaryAction.label}
            </Link>
            <Link href="/dashboard" className={LINK_BUTTON_CLASS_NAME}>
              Continue later
            </Link>
          </div>
        </div>
      </div>
    </StepShell>
  );
}

export function WorkspaceSetupGuide({
  readiness,
  readinessError = null,
  userName,
  viewerMembershipRole,
}: WorkspaceSetupGuideProps) {
  const model = getActivationModel(readiness);
  const workspaceName = readiness?.workspace.name ?? "Your workspace";
  const workspaceDescription = readiness?.workspace.description ?? null;
  const currentMissingKey = model.missingRequired[0]?.key ?? null;
  const workspaceStatus: StepStatus = "complete";
  const businessStatus: StepStatus = model.businessStructureReady
    ? "complete"
    : currentMissingKey && ["buyer", "supplier", "material-or-category"].includes(currentMissingKey)
      ? "current"
      : "pending";
  const teamStatus: StepStatus = model.roleCoverageReady ? "complete" : "recommended";
  const savingCardStatus: StepStatus =
    model.savingCardCount > 0
      ? "complete"
      : currentMissingKey === "saving-card"
        ? "current"
        : "pending";
  const evidenceStatus: StepStatus =
    model.savingCardCount > 0 ? "recommended" : "pending";
  const reportingStatus: StepStatus = model.firstValueReady ? "complete" : "pending";
  const finishStatus: StepStatus = model.firstValueReady ? "complete" : "current";
  const completedStepLabels = [
    workspaceStatus === "complete" ? "Workspace identity" : null,
    businessStatus === "complete" ? "Business structure and master data" : null,
    teamStatus === "complete" ? "Team and roles" : null,
    savingCardStatus === "complete" ? "First saving card" : null,
    reportingStatus === "complete" ? "Reporting and dashboard" : null,
  ].filter((value): value is string => Boolean(value));

  return (
    <main className="min-h-screen bg-[var(--background)] px-6 py-10 text-[var(--foreground)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <Card className="bg-white/95 shadow-[0_18px_44px_rgba(15,23,42,0.06)]">
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="blue">Guided setup</Badge>
                <Badge tone="slate">
                  {completedStepLabels.length} of 7 steps completed
                </Badge>
              </div>
              <CardTitle>
                Set up {workspaceName} for first value
              </CardTitle>
              <CardDescription>
                {getFirstName(userName)}, this wizard helps a new workspace move
                from empty account to the first credible procurement savings
                value with clear next steps.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/35 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                      First-value progress
                    </p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
                      {model.progressPercent}%
                    </p>
                  </div>
                  <div className="max-w-sm text-right">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                      Next best action
                    </p>
                    <p className="mt-2 text-sm font-medium text-[var(--foreground)]">
                      {model.savingCardCount <= 0
                        ? "Create one real saving card"
                        : model.businessStructureReady
                          ? "Open dashboard for first portfolio review"
                          : "Complete the missing first-value master data"}
                    </p>
                  </div>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--muted)]">
                  <div
                    className="h-full rounded-full bg-[var(--primary)] transition-[width]"
                    style={{ width: `${model.progressPercent}%` }}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-sm leading-6 text-[var(--muted-foreground)]">
                Start with one real savings initiative. You can complete master
                data later. Use sample data only for demo/training; use real data
                when preparing a pilot or customer workspace.
              </div>
            </CardContent>
          </Card>

          <ReadinessSnapshot readiness={readiness} model={model} />
        </section>

        {readinessError ? (
          <Card>
            <CardContent className="py-4">
              <p className="text-sm text-[var(--muted-foreground)]">
                Live workspace progress could not be refreshed right now. You
                can still continue setup, and this page will catch up as soon as
                readiness data is available again.
              </p>
            </CardContent>
          </Card>
        ) : null}

        <StepShell
          stepNumber={1}
          title="Workspace identity"
          description="This workspace is where your procurement savings initiatives, evidence, approvals, and reports will live."
          status={workspaceStatus}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                Workspace name
              </p>
              <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                {workspaceName}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                Short description
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                {workspaceDescription ??
                  "Add or refine the workspace description from Workspace Settings when the pilot scope is clearer."}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <Link href="/admin/settings" className={LINK_BUTTON_CLASS_NAME}>
              Review workspace identity
            </Link>
          </div>
        </StepShell>

        <BusinessStructureStep readiness={readiness} status={businessStatus} />

        <TeamAndRolesStep
          readiness={readiness}
          status={teamStatus}
          viewerMembershipRole={viewerMembershipRole}
        />

        <FirstSavingCardStep
          savingCardCount={model.savingCardCount}
          status={savingCardStatus}
        />

        <EvidenceTrustStep
          savingCardCount={model.savingCardCount}
          status={evidenceStatus}
        />

        <ReportingStep model={model} status={reportingStatus} />

        <FirstValueLaunchpad
          viewerMembershipRole={viewerMembershipRole}
          title="Training and acceleration"
          description="Use sample data only for demo/training. Use real data when preparing a pilot or customer workspace."
          primaryActionLabel="Create first saving card"
          reviewSetupLabel="Review readiness"
        />

        <FinishStep
          model={model}
          completedStepLabels={completedStepLabels}
          status={finishStatus}
        />
      </div>
    </main>
  );
}
