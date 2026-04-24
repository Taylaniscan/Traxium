import Link from "next/link";
import type { OrganizationRole } from "@prisma/client";

import { FirstValueLaunchpad } from "@/components/onboarding/first-value-launchpad";
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
  MASTER_DATA_ONBOARDING_ENTITY_KEYS,
  MASTER_DATA_ONBOARDING_STEP_CONFIG,
  isMasterDataOnboardingEntityKey,
} from "@/lib/onboarding/master-data-config";
import type { WorkspaceMasterDataItem, WorkspaceReadiness } from "@/lib/types";

type WorkspaceSetupGuideProps = {
  readiness: WorkspaceReadiness | null;
  readinessError?: string | null;
  userName: string;
  viewerMembershipRole: OrganizationRole;
};

type SetupStep = {
  key: string;
  title: string;
  description: string;
  status: "complete" | "current" | "pending";
  helper?: string;
  detail?: string;
  actionLabel?: string;
  actionHref?: string;
};

const LINK_BUTTON_CLASS_NAME =
  "inline-flex items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]";

function getFirstName(name: string) {
  const normalized = name.trim();

  if (!normalized) {
    return "there";
  }

  return normalized.split(/\s+/u)[0] ?? normalized;
}

function getMasterDataItem(
  readiness: WorkspaceReadiness | null,
  key: WorkspaceMasterDataItem["key"]
) {
  return readiness?.masterData.find((item) => item.key === key) ?? null;
}

function buildReadinessDetail(count: number, singular: string, plural: string) {
  if (count <= 0) {
    return `No ${plural} added yet.`;
  }

  return `${count} ${count === 1 ? singular : plural} configured.`;
}

function buildSetupSteps(readiness: WorkspaceReadiness | null): SetupStep[] {
  const savingCardCount = readiness?.counts.savingCards ?? 0;
  const userCount = readiness?.counts.users ?? 1;
  const acceleratedSetupComplete = userCount > 1 || savingCardCount > 1;
  const masterDataSteps = MASTER_DATA_ONBOARDING_ENTITY_KEYS.map((key) => {
    const config = MASTER_DATA_ONBOARDING_STEP_CONFIG[key];
    const item = getMasterDataItem(readiness, key);

    return {
      key,
      title: config.title,
      description: config.description,
      complete: item?.ready ?? false,
      detail: buildReadinessDetail(
        item?.count ?? 0,
        config.singularLabel,
        config.pluralLabel
      ),
      helper: config.helper,
    };
  });

  const steps: Array<Omit<SetupStep, "status"> & { complete: boolean }> = [
    {
      key: "workspace",
      title: "Workspace basics",
      description: "Create the workspace boundary so Traxium can store portfolio, approvals, and audit history inside one organization.",
      complete: true,
      detail: readiness?.workspace.name
        ? `${readiness.workspace.name} is ready for setup.`
        : "Workspace is created and ready for setup.",
      actionLabel: "View dashboard",
      actionHref: "/dashboard",
    },
    ...masterDataSteps,
    {
      key: "saving-card",
      title: "Create first saving card",
      description: "The first live record turns setup into a working portfolio and unlocks the downstream workflow surfaces.",
      complete: savingCardCount > 0,
      detail:
        savingCardCount > 0
          ? `${savingCardCount} saving card${savingCardCount === 1 ? "" : "s"} already created.`
          : "No saving cards created yet.",
      actionLabel: "Create first saving card",
      actionHref: "/saving-cards/new",
    },
    {
      key: "accelerate",
      title: "Invite teammate or load sample data",
      description: "Expand the workspace with another user or seed it with sample records so the rest of the product becomes easier to evaluate.",
      complete: acceleratedSetupComplete,
      detail: acceleratedSetupComplete
        ? userCount > 1
          ? `${userCount} users are already active in this workspace.`
          : `${savingCardCount} saving cards are already present in the workspace.`
        : "No teammate has joined yet and only the initial record set is available.",
      helper: "This step is satisfied when a teammate joins or when the sample portfolio creates additional activity.",
    },
  ];

  const currentIndex = steps.findIndex((step) => !step.complete);

  return steps.map((step, index) => ({
    ...step,
    status:
      step.complete
        ? "complete"
        : currentIndex === index
          ? "current"
          : "pending",
  }));
}

function getStatusBadge(step: SetupStep) {
  switch (step.status) {
    case "complete":
      return { label: "Complete", tone: "emerald" as const };
    case "current":
      return { label: "Recommended next", tone: "blue" as const };
    default:
      return { label: "Pending", tone: "slate" as const };
  }
}

function SetupStepCard({
  index,
  step,
}: {
  index: number;
  step: SetupStep;
}) {
  const badge = getStatusBadge(step);

  return (
    <Card className={step.status === "current" ? "border-[rgba(37,99,235,0.24)]" : undefined}>
      <CardContent className="flex flex-col gap-4 py-5 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 gap-4">
          <div
            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${
              step.status === "complete"
                ? "border-[rgba(22,163,74,0.24)] bg-[rgba(22,163,74,0.08)] text-[var(--success)]"
                : step.status === "current"
                  ? "border-[rgba(37,99,235,0.24)] bg-[rgba(37,99,235,0.08)] text-[var(--info)]"
                  : "border-[var(--border)] bg-[var(--muted)]/45 text-[var(--muted-foreground)]"
            }`}
          >
            {step.status === "complete" ? "✓" : index + 1}
          </div>

          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Step {index + 1}
              </p>
              <Badge tone={badge.tone}>{badge.label}</Badge>
            </div>
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                {step.description}
              </p>
            </div>
            {step.detail ? (
              <p className="text-sm font-medium text-[var(--foreground)]">{step.detail}</p>
            ) : null}
            {step.helper ? (
              <p className="text-sm text-[var(--muted-foreground)]">{step.helper}</p>
            ) : null}
          </div>
        </div>

        {step.actionLabel && step.actionHref ? (
          <Link href={step.actionHref} className={LINK_BUTTON_CLASS_NAME}>
            {step.actionLabel}
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ReadinessSnapshot({
  readiness,
}: {
  readiness: WorkspaceReadiness | null;
}) {
  const overallPercent = readiness?.coverage.overallPercent ?? 0;
  const masterDataSummary = readiness
    ? `${readiness.coverage.masterDataReadyCount}/${readiness.coverage.masterDataTotal}`
    : "Unavailable";
  const workflowSummary = readiness
    ? `${readiness.coverage.workflowReadyCount}/${readiness.coverage.workflowTotal}`
    : "Unavailable";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace readiness</CardTitle>
        <CardDescription>
          This uses the same readiness model as the rest of the product, so setup progress stays grounded in live workspace data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/35 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
            Overall readiness
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
            {overallPercent}%
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--muted)]">
            <div
              className="h-full rounded-full bg-[var(--primary)] transition-[width]"
              style={{ width: `${overallPercent}%` }}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <SnapshotFact label="Master data" value={masterDataSummary} />
          <SnapshotFact label="Workflow coverage" value={workflowSummary} />
          <SnapshotFact
            label="Saving cards"
            value={String(readiness?.counts.savingCards ?? 0)}
          />
          <SnapshotFact
            label="Active users"
            value={String(readiness?.counts.users ?? 1)}
          />
        </div>

        {readiness && (!readiness.isWorkspaceReady || readiness.missingCoreSetup.length) ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              Still missing
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
              {[...readiness.missingCoreSetup, ...readiness.missingWorkflowCoverage]
                .slice(0, 4)
                .join(", ") || "No blockers right now."}
            </p>
          </div>
        ) : null}

        <Link href="/admin" className={LINK_BUTTON_CLASS_NAME}>
          Review workspace setup
        </Link>
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

export function WorkspaceSetupGuide({
  readiness,
  readinessError = null,
  userName,
  viewerMembershipRole,
}: WorkspaceSetupGuideProps) {
  const steps = buildSetupSteps(readiness);
  const completedCount = steps.filter((step) => step.status === "complete").length;
  const totalSteps = steps.length;
  const progressPercent = Math.round((completedCount / totalSteps) * 100);
  const nextStep = steps.find((step) => step.status === "current") ?? null;
  const workspaceName = readiness?.workspace.name ?? "Your workspace";

  return (
    <main className="min-h-screen bg-[var(--background)] px-6 py-10 text-[var(--foreground)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <Card className="bg-white/95 shadow-[0_18px_44px_rgba(15,23,42,0.06)]">
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="blue">Guided setup</Badge>
                <Badge tone="slate">{completedCount} of 7 steps completed</Badge>
              </div>
              <CardTitle>
                Set up {workspaceName} for first value
              </CardTitle>
              <CardDescription>
                {getFirstName(userName)}, this setup wizard keeps the first-value path visible while staying aligned with Traxium&apos;s live workspace readiness signals.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/35 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                      Progress
                    </p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
                      {progressPercent}%
                    </p>
                  </div>
                  {nextStep ? (
                    <div className="max-w-sm text-right">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                        Recommended next step
                      </p>
                      <p className="mt-2 text-sm font-medium text-[var(--foreground)]">
                        {nextStep.title}
                      </p>
                    </div>
                  ) : (
                    <div className="max-w-sm text-right">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                        Status
                      </p>
                      <p className="mt-2 text-sm font-medium text-[var(--foreground)]">
                        First-value setup is complete.
                      </p>
                    </div>
                  )}
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--muted)]">
                  <div
                    className="h-full rounded-full bg-[var(--primary)] transition-[width]"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-sm leading-6 text-[var(--muted-foreground)]">
                Complete the steps below in order, or jump ahead where helpful. Core master data now uses an upload-first setup path inside onboarding, while inline manual creation from the first saving card remains available as a secondary fallback.
              </div>
            </CardContent>
          </Card>

          <ReadinessSnapshot readiness={readiness} />
        </section>

        {readinessError ? (
          <Card>
            <CardContent className="py-4">
              <p className="text-sm text-[var(--muted-foreground)]">
                Live workspace progress could not be refreshed right now. You can still continue setup, and this page will catch up as soon as readiness data is available again.
              </p>
            </CardContent>
          </Card>
        ) : null}

        <section className="space-y-4">
          {steps.slice(0, 6).map((step, index) => (
            isMasterDataOnboardingEntityKey(step.key) ? (
              <MasterDataUploadStep
                key={step.key}
                stepNumber={index + 1}
                entityKey={step.key}
                status={step.status}
                count={getMasterDataItem(readiness, step.key)?.count ?? 0}
                manualHref="/saving-cards/new"
              />
            ) : (
              <SetupStepCard key={step.key} index={index} step={step} />
            )
          ))}
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge tone={getStatusBadge(steps[6]).tone}>
              {getStatusBadge(steps[6]).label}
            </Badge>
            <p className="text-sm font-semibold text-[var(--foreground)]">Step 7</p>
          </div>
          <FirstValueLaunchpad
            viewerMembershipRole={viewerMembershipRole}
            title={steps[6].title}
            description={steps[6].description}
            primaryActionLabel="Create first saving card"
            reviewSetupLabel="Review workspace setup"
          />
        </section>
      </div>
    </main>
  );
}
