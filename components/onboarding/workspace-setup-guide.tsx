"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { OrganizationRole } from "@prisma/client";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  FileSpreadsheet,
  Lightbulb,
  Plus,
  Settings2,
  Users,
} from "lucide-react";

import { LoadSampleDataButton } from "@/components/onboarding/load-sample-data-button";
import {
  OnboardingShell,
  onboardingPrimaryClass,
} from "@/components/onboarding/onboarding-shell";
import {
  MASTER_DATA_ONBOARDING_ENTITY_KEYS,
  getMasterDataOnboardingStepConfig,
  getMasterDataTemplateDownloadHref,
} from "@/lib/onboarding/master-data-config";
import type { WorkspaceReadiness } from "@/lib/types";

type StartingPath = "real" | "import" | "sample";

type WorkspaceSetupGuideProps = {
  readiness: WorkspaceReadiness | null;
  readinessError?: string | null;
  userName: string;
  viewerMembershipRole: OrganizationRole;
  canManageData?: boolean;
};

const paths = [
  {
    id: "real" as const,
    icon: Plus,
    title: "Start with one saving card",
    description:
      "Have an opportunity in mind? Add its prices, volume, and owner.",
    hint: "A simple place to begin",
    action: "Create first saving card",
    href: "/saving-cards/new?from=onboarding",
  },
  {
    id: "import" as const,
    icon: FileSpreadsheet,
    title: "Bring your spreadsheet",
    description: "Move existing savings initiatives into a shared workspace.",
    hint: "Use the XLSX import template",
    action: "Open spreadsheet import",
    href: "/reports#import-export",
  },
  {
    id: "sample" as const,
    icon: Lightbulb,
    title: "Explore with sample cards",
    description: "See how the workflow looks before entering your own data.",
    hint: "For a demo or training workspace",
    action: "Add sample cards",
    href: "/dashboard",
  },
];

const preparation: Record<
  StartingPath,
  Array<{ title: string; detail: string }>
> = {
  real: [
    {
      title: "One opportunity",
      detail:
        "A supplier agreement, material change, or another savings initiative.",
    },
    {
      title: "Your commercial assumptions",
      detail: "Baseline and new prices, annual volume, and when savings begin.",
    },
    {
      title: "Evidence when you have it",
      detail: "Attach a quote or supporting file after creating the card.",
    },
  ],
  import: [
    {
      title: "Start from the import template",
      detail: "Download it from Reports and copy in your existing initiatives.",
    },
    {
      title: "Keep currency and units explicit",
      detail: "Use USD or EUR, a volume unit, and unambiguous dates.",
    },
    {
      title: "Review any row errors",
      detail: "Traxium checks the entire file before saving any cards.",
    },
  ],
  sample: [
    {
      title: "Two illustrative saving cards",
      detail:
        "Example suppliers, materials, and prices are added to this workspace.",
    },
    {
      title: "A safe place to learn the workflow",
      detail:
        "Explore the dashboard, evidence, and approval process with demo data.",
    },
    {
      title: "Keep customer reporting separate",
      detail:
        "Use sample data for demo or training, and real data for your live workspace.",
    },
  ],
};

export function WorkspaceSetupGuide({
  readiness,
  readinessError = null,
  userName,
  viewerMembershipRole,
  canManageData,
}: WorkspaceSetupGuideProps) {
  const hasCards = (readiness?.counts.savingCards ?? 0) > 0;
  const canManageMembers =
    viewerMembershipRole === "OWNER" || viewerMembershipRole === "ADMIN";
  const canImport = canManageData ?? canManageMembers;
  const [step, setStep] = useState<2 | 3>(hasCards ? 3 : 2);
  const [showExistingSummary, setShowExistingSummary] = useState(hasCards);
  const [path, setPath] = useState<StartingPath>("real");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  const workspaceName = readiness?.workspace.name ?? "Your workspace";
  const firstName = userName.trim().split(/\s+/u)[0] || "there";
  const selected = paths.find((item) => item.id === path)!;
  const availablePaths = paths.filter(
    (item) =>
      (item.id !== "import" || canImport) &&
      (item.id !== "sample" || (readiness !== null && !hasCards)),
  );

  function chooseStartingPoint() {
    setShowExistingSummary(false);
    setStep(2);
  }

  useEffect(() => {
    if (previousStep.current !== step) headingRef.current?.focus();
    previousStep.current = step;
  }, [step]);

  return (
    <OnboardingShell
      step={step}
      workspaceName={workspaceName}
      onBackToStart={chooseStartingPoint}
    >
      <div className="mb-8">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#36826d]">
          STEP {step} OF 3 ·{" "}
          {step === 2 ? "CHOOSE YOUR PATH" : "LET’S PUT IT TO WORK"}
        </p>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-3xl font-semibold tracking-[-0.035em] outline-none sm:text-4xl"
        >
          {step === 2
            ? "How would you like to start?"
            : showExistingSummary
              ? "Your workspace is ready."
              : "You’re ready for your first step."}
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-7 text-[#6a7e83]">
          {step === 2
            ? `${firstName}, there’s no need to set everything up at once. Choose the starting point that feels right for your team.`
            : showExistingSummary
              ? `${workspaceName} already has ${readiness?.counts.savingCards} saving card${readiness?.counts.savingCards === 1 ? "" : "s"}. Keep going from your dashboard.`
              : `Your workspace is saved. Here’s what comes next for ${workspaceName}.`}
        </p>
      </div>

      {readinessError ? (
        <div
          role="status"
          className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
        >
          We couldn’t refresh your setup progress. Your workspace is available,
          and you can continue with a real saving card.
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-[#e1e8e8] bg-white shadow-[0_8px_32px_-16px_rgba(27,45,50,0.15)]">
        {step === 2 ? (
          <>
            <fieldset className="space-y-3 p-5 sm:p-8">
              <legend className="sr-only">Choose a starting point</legend>
              {availablePaths.map((item) => {
                const Icon = item.icon;
                const active = path === item.id;
                return (
                  <label
                    key={item.id}
                    className={`relative flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition sm:p-5 ${active ? "border-[#3e8b73] bg-[#f1f8f4] shadow-[0_0_0_1px_#3e8b73]" : "border-[#e2e8e8] hover:border-[#9bb8ad] hover:bg-[#fafcfb]"}`}
                  >
                    <input
                      type="radio"
                      name="starting-path"
                      value={item.id}
                      checked={active}
                      onChange={() => setPath(item.id)}
                      className="peer sr-only"
                    />
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${active ? "bg-[#deeee5] text-[#22664f]" : "bg-[#f1f4f5] text-[#6e8388]"}`}
                    >
                      <Icon size={22} strokeWidth={1.6} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-[#253d43]">
                        {item.title}
                      </span>
                      <span className="mt-1.5 block text-sm leading-6 text-[#6e8185]">
                        {item.description}
                      </span>
                      <span
                        className={`mt-2 block text-xs ${active ? "font-medium text-[#3b8065]" : "text-[#5b7075]"}`}
                      >
                        {item.hint}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${active ? "border-[#26765c] bg-[#26765c]" : "border-[#cbd7d9]"}`}
                    >
                      {active ? (
                        <Check size={12} className="text-white" />
                      ) : null}
                    </span>
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-[-4px] rounded-2xl peer-focus-visible:ring-2 peer-focus-visible:ring-[#155e52]"
                    />
                  </label>
                );
              })}
            </fieldset>
            <div className="flex flex-col-reverse gap-4 border-t border-[#edf0f1] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
              <p className="text-xs text-[#5b7075]">
                You can use the other options later.
              </p>
              <button
                type="button"
                onClick={() => setStep(3)}
                className={onboardingPrimaryClass}
              >
                Continue <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="p-6 sm:p-8">
              <div className="mb-7 flex items-center gap-3 border-b border-[#edf0f1] pb-6">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#e6f3ec] text-[#28785a]">
                  <CheckCircle2
                    size={24}
                    strokeWidth={1.6}
                    aria-hidden="true"
                  />
                </span>
                <div>
                  <p className="text-sm font-semibold">
                    {showExistingSummary
                      ? "Your first saving card is in place"
                      : selected.title}
                  </p>
                  <p className="mt-1 text-xs text-[#5b7075]">
                    {showExistingSummary
                      ? "You can add more detail as you go."
                      : "A clear next step. Everything else can wait."}
                  </p>
                </div>
              </div>
              <div className="space-y-6">
                {(showExistingSummary
                  ? [
                      {
                        title: "See your savings portfolio",
                        detail:
                          "Open the dashboard to review your cards and the current forecast.",
                      },
                      {
                        title: "Bring finance into the conversation",
                        detail:
                          "Add evidence and request finance validation when a card is ready.",
                      },
                      {
                        title: "Build at your own pace",
                        detail:
                          "Add more initiatives, invite colleagues, or refine settings whenever you need.",
                      },
                    ]
                  : preparation[path]
                ).map((item, index) => (
                  <div key={item.title} className="flex gap-4">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f0f4f3] text-[11px] font-semibold text-[#6b8480]">
                      {index + 1}
                    </span>
                    <div>
                      <h2 className="text-sm font-semibold text-[#314b50]">
                        {item.title}
                      </h2>
                      <p className="mt-1 text-sm leading-6 text-[#5b7075]">
                        {item.detail}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col-reverse gap-4 border-t border-[#edf0f1] px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
              <button
                type="button"
                onClick={chooseStartingPoint}
                className="inline-flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-[#72868a] hover:text-[#155e52] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155e52]"
              >
                <ArrowLeft size={15} aria-hidden="true" /> Change starting point
              </button>
              {showExistingSummary ? (
                <Link href="/dashboard" className={onboardingPrimaryClass}>
                  Open dashboard <ArrowRight size={16} aria-hidden="true" />
                </Link>
              ) : path === "sample" ? (
                <LoadSampleDataButton
                  variant="default"
                  size="lg"
                  className={onboardingPrimaryClass}
                  successHref="/dashboard"
                >
                  Add sample cards <ArrowRight size={16} aria-hidden="true" />
                </LoadSampleDataButton>
              ) : (
                <Link href={selected.href} className={onboardingPrimaryClass}>
                  {selected.action} <ArrowRight size={16} aria-hidden="true" />
                </Link>
              )}
            </div>
          </>
        )}
      </div>

      <details className="group mt-6 rounded-xl border border-[#e0e7e7] bg-white/60">
        <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl px-5 py-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155e52] [&::-webkit-details-marker]:hidden">
          <Settings2 size={17} className="text-[#7b9189]" aria-hidden="true" />
          <span className="flex-1 font-medium text-[#556f72]">
            Set up a little more{" "}
            <span className="ml-1 font-normal text-[#5b7075]">— optional</span>
          </span>
          <ChevronDown
            size={16}
            className="text-[#8c9c9f] transition group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div className="space-y-5 border-t border-[#e3e9e8] p-5 text-sm">
          <div className="flex items-start gap-3">
            <Users
              size={18}
              className="mt-1 shrink-0 text-[#6f8880]"
              aria-hidden="true"
            />
            <div>
              <h2 className="font-medium">Bring your team along</h2>
              <p className="mt-1 text-xs leading-6 text-[#5b7075]">
                Procurement Lead and Finance Reviewer roles are needed for
                finance validation. Team setup can wait until you’re ready to
                request approval.
              </p>
              {canManageMembers ? (
                <Link
                  href="/admin/members"
                  className="mt-2 inline-block text-xs font-semibold text-[#216f56] underline underline-offset-4"
                >
                  Invite team members
                </Link>
              ) : (
                <p className="mt-2 text-xs text-[#5b7075]">
                  Ask your workspace owner or admin to invite your colleagues.
                </p>
              )}
            </div>
          </div>
          {canManageMembers ? (
            <div className="border-t border-[#e3e9e8] pt-4">
              <Link
                href="/admin/settings"
                className="text-xs font-semibold text-[#216f56] underline underline-offset-4"
              >
                Edit workspace and regional preferences
              </Link>
              <p className="mt-2 text-xs leading-5 text-[#5b7075]">
                Choose display formats, time zone, suggested units, and USD or
                EUR currency settings.
              </p>
            </div>
          ) : null}
          {canImport ? (
            <div className="border-t border-[#e3e9e8] pt-4">
              <p className="font-medium">
                Already have supplier or buyer lists?
              </p>
              <p className="mt-1 text-xs leading-6 text-[#5b7075]">
                Download a template, then use Reports to import buyers,
                suppliers, materials, or categories. Plants and business units
                can be added in Admin.
              </p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-3">
                {MASTER_DATA_ONBOARDING_ENTITY_KEYS.map((key) => {
                  const config = getMasterDataOnboardingStepConfig(key);
                  return (
                    <a
                      key={key}
                      href={getMasterDataTemplateDownloadHref(key)}
                      download={config.templateFileName}
                      className="text-xs font-medium text-[#216f56] underline underline-offset-4"
                    >
                      {config.pluralLabel} template
                    </a>
                  );
                })}
              </div>
              <div className="mt-4 flex gap-4">
                <Link
                  href="/reports#import-export"
                  className="text-xs font-semibold text-[#216f56] underline underline-offset-4"
                >
                  Open imports
                </Link>
                <Link
                  href="/admin"
                  className="text-xs font-semibold text-[#216f56] underline underline-offset-4"
                >
                  Manage reference data
                </Link>
              </div>
            </div>
          ) : null}
          {hasCards ? (
            <div className="border-t border-[#e3e9e8] pt-4">
              <Link
                href="/saving-cards/new?from=onboarding"
                className="text-xs font-semibold text-[#216f56] underline underline-offset-4"
              >
                Create another saving card
              </Link>
            </div>
          ) : null}
        </div>
      </details>
    </OnboardingShell>
  );
}
