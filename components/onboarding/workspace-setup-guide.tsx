"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { OrganizationRole } from "@prisma/client";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  FileSpreadsheet,
  Layers3,
  Package,
  Tags,
  Truck,
  Users,
} from "lucide-react";

import { InviteColleague } from "@/components/onboarding/invite-colleague";
import { QuickAddRecord } from "@/components/onboarding/quick-add-record";
import {
  OnboardingShell,
  onboardingPrimaryClass,
  onboardingSteps,
} from "@/components/onboarding/onboarding-shell";
import {
  getMasterDataOnboardingStepConfig,
  getMasterDataTemplateDownloadHref,
} from "@/lib/onboarding/master-data-config";
import type { WorkspaceReadiness } from "@/lib/types";

type GuideStep = 2 | 3 | 4 | 5 | 6;
type SetupKey = "buyers" | "materials" | "suppliers" | "categories";
type WorkspaceSetupGuideProps = {
  readiness: WorkspaceReadiness | null;
  readinessError?: string | null;
  userName: string;
  viewerMembershipRole: OrganizationRole;
  canManageData?: boolean;
};

const stages: Record<
  2 | 3 | 4 | 5,
  {
    key: SetupKey;
    title: string;
    subtitle: string;
    label: string;
    example: string;
    suggestion: string;
    icon: typeof Users;
  }
> = {
  2: {
    key: "buyers",
    title: "Introduce your team.",
    subtitle:
      "Start with the person who owns a procurement opportunity. Invite other colleagues when you are ready to collaborate.",
    label: "Buyer",
    example: "e.g. Alex Morgan",
    suggestion:
      "A buyer is the named owner on a saving card. Invited teammates receive workspace access separately.",
    icon: Users,
  },
  3: {
    key: "materials",
    title: "What does your team buy?",
    subtitle:
      "Add a material, part, or service you want to track. One familiar example is enough to begin.",
    label: "Material",
    example: "e.g. PET resin or maintenance service",
    suggestion:
      "You will choose the unit on each saving card, so quantities stay explicit.",
    icon: Package,
  },
  4: {
    key: "suppliers",
    title: "Who do you buy from?",
    subtitle:
      "Add a current supplier. You can add alternative suppliers and more detail as opportunities take shape.",
    label: "Supplier",
    example: "e.g. Northstar Components",
    suggestion:
      "Use the supplier name your finance and procurement teams already recognize.",
    icon: Truck,
  },
  5: {
    key: "categories",
    title: "How do you group your work?",
    subtitle:
      "Create a category for reporting, such as Packaging, Logistics, or Direct Materials.",
    label: "Category",
    example: "e.g. Packaging",
    suggestion:
      "Categories help the portfolio make sense. Sites and business units can be added later if useful.",
    icon: Tags,
  },
};

function suggestedStep(readiness: WorkspaceReadiness | null): GuideStep {
  if (!readiness) return 2;
  if (readiness.counts.savingCards > 0) return 6;
  if (!readiness.counts.buyers) return 2;
  if (!readiness.counts.materials) return 3;
  if (!readiness.counts.suppliers) return 4;
  if (!readiness.counts.categories) return 5;
  return 6;
}

export function WorkspaceSetupGuide({
  readiness,
  readinessError = null,
  userName,
  viewerMembershipRole,
  canManageData,
}: WorkspaceSetupGuideProps) {
  const router = useRouter();
  const hasCards = (readiness?.counts.savingCards ?? 0) > 0;
  const canInvite =
    viewerMembershipRole === "OWNER" || viewerMembershipRole === "ADMIN";
  const canAddData = canManageData ?? canInvite;
  const [step, setStep] = useState<GuideStep>(() => suggestedStep(readiness));
  const [added, setAdded] = useState<Partial<Record<SetupKey, number>>>({});
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  const workspaceName = readiness?.workspace.name ?? "Your workspace";
  const storageKey = readiness?.workspace.id
    ? `traxium-onboarding:${readiness.workspace.id}`
    : null;
  const firstName = userName.trim().split(/\s+/u)[0] || "there";
  const stage = step < 6 ? stages[step as 2 | 3 | 4 | 5] : null;
  const count = stage
    ? Math.max(readiness?.counts[stage.key] ?? 0, added[stage.key] ?? 0)
    : 0;
  const completedSteps = [
    1,
    ...([2, 3, 4, 5] as const).filter((number) => {
      const key = stages[number].key;
      return Math.max(readiness?.counts[key] ?? 0, added[key] ?? 0) > 0;
    }),
  ];

  useEffect(() => {
    if (!storageKey || hasCards) return;
    const saved = Number(window.sessionStorage.getItem(storageKey));
    if (saved >= 2 && saved <= 6) setStep(saved as GuideStep);
  }, [storageKey, hasCards]);

  useEffect(() => {
    if (storageKey && !hasCards)
      window.sessionStorage.setItem(storageKey, String(step));
    if (previousStep.current !== step) headingRef.current?.focus();
    previousStep.current = step;
  }, [step, storageKey, hasCards]);

  function goTo(next: GuideStep) {
    setStep(next);
  }

  function recordCreated(key: SetupKey) {
    setAdded((current) => ({
      ...current,
      [key]: Math.max(current[key] ?? 0, readiness?.counts[key] ?? 0) + 1,
    }));
    router.refresh();
  }

  return (
    <OnboardingShell
      step={step}
      workspaceName={workspaceName}
      onNavigate={goTo}
      completedSteps={completedSteps}
    >
      <div className="mb-8">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#36826d]">
          STEP {step} OF {onboardingSteps.length} ·{" "}
          {stage
            ? onboardingSteps[step - 1].title.toUpperCase()
            : "FIRST SAVING CARD"}
        </p>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-3xl font-semibold tracking-[-0.035em] outline-none sm:text-4xl"
        >
          {stage
            ? stage.title
            : hasCards
              ? "Your work is underway."
              : "Ready for your first saving card?"}
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-7 text-[#5b7075]">
          {stage
            ? stage.subtitle
            : hasCards
              ? `${workspaceName} already has ${readiness?.counts.savingCards} saving card${readiness?.counts.savingCards === 1 ? "" : "s"}. Explore your portfolio or add another opportunity.`
              : `${firstName}, your workspace now has a place for the people, materials, suppliers, and categories behind your savings. Start with one real opportunity.`}
        </p>
      </div>

      {readinessError ? (
        <div
          role="status"
          className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
        >
          We couldn’t refresh your workspace counts. You can continue; saved
          records remain in your workspace.
        </div>
      ) : null}

      {stage ? (
        <>
          <div className="overflow-hidden rounded-2xl border border-[#e1e8e8] bg-white shadow-[0_8px_32px_-16px_rgba(27,45,50,0.15)]">
            <div className="space-y-6 p-5 sm:p-8">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#e8f3ed] text-[#226f55]">
                  <stage.icon size={24} strokeWidth={1.7} aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-[#253d43]">
                    {stage.label} records
                  </p>
                  <p className="mt-1 text-sm text-[#5b7075]">
                    {count > 0
                      ? `${count} already in this workspace. Add more if you like.`
                      : `Add your first ${stage.label.toLowerCase()} to make the next step easier.`}
                  </p>
                </div>
              </div>
              <p className="rounded-xl bg-[#f3f7f5] px-4 py-3 text-sm leading-6 text-[#46665c]">
                {stage.suggestion}
              </p>
              {canAddData ? (
                <QuickAddRecord
                  key={stage.key}
                  entity={stage.key}
                  label={stage.label}
                  example={stage.example}
                  allowEmail={stage.key === "buyers"}
                  onCreated={() => recordCreated(stage.key)}
                />
              ) : (
                <p className="rounded-xl border border-[#e1e8e8] p-5 text-sm text-[#5b7075]">
                  A workspace admin can add shared {stage.label.toLowerCase()}{" "}
                  records. You can still continue to your saving card and create
                  the record there.
                </p>
              )}
              {step === 2 ? (
                <div className="border-t border-[#edf0f1] pt-6">
                  <h2 className="mb-3 text-sm font-semibold">
                    Bring your colleagues in
                  </h2>
                  <InviteColleague canInvite={canInvite} />
                </div>
              ) : null}
            </div>
            <div className="flex flex-col-reverse gap-3 border-t border-[#edf0f1] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
              {step > 2 ? (
                <button
                  type="button"
                  onClick={() => goTo((step - 1) as GuideStep)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-[#5b7075] hover:text-[#155e52] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155e52]"
                >
                  <ArrowLeft size={16} aria-hidden="true" /> Back
                </button>
              ) : (
                <span className="text-xs text-[#5b7075]">
                  You can return to any step later.
                </span>
              )}
              <button
                type="button"
                onClick={() => goTo((step + 1) as GuideStep)}
                className={onboardingPrimaryClass}
              >
                {count > 0 ? "Continue" : "Skip for now"}{" "}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
          {canAddData && step > 2 ? (
            <details className="group mt-6 rounded-xl border border-[#e1e8e8] bg-white/80">
              <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl px-5 py-4 text-sm font-medium text-[#506d66] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155e52] [&::-webkit-details-marker]:hidden">
                <FileSpreadsheet size={18} aria-hidden="true" />
                <span className="flex-1">
                  Have many{" "}
                  {getMasterDataOnboardingStepConfig(stage.key).pluralLabel}?
                  Use a spreadsheet
                </span>
                <ChevronDown
                  size={16}
                  className="group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <div className="space-y-2 border-t border-[#edf0f1] px-5 py-4 text-sm text-[#5b7075]">
                <p>
                  Download the{" "}
                  {getMasterDataOnboardingStepConfig(stage.key).pluralLabel}{" "}
                  template, then upload it from Reports.
                </p>
                <div className="flex flex-wrap gap-4">
                  <a
                    href={getMasterDataTemplateDownloadHref(stage.key)}
                    download
                    className="font-semibold text-[#216f56] underline underline-offset-4"
                  >
                    Download template
                  </a>
                  <Link
                    href="/reports#import-export"
                    className="font-semibold text-[#216f56] underline underline-offset-4"
                  >
                    Open import
                  </Link>
                </div>
              </div>
            </details>
          ) : null}
          <p className="mt-5 text-center text-sm text-[#5b7075]">
            Have a saving opportunity already?{" "}
            <Link
              href="/saving-cards/new?from=onboarding"
              className="font-semibold text-[#216f56] underline underline-offset-4"
            >
              Create a saving card now
            </Link>
          </p>
        </>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-[#e1e8e8] bg-white shadow-[0_8px_32px_-16px_rgba(27,45,50,0.15)]">
            <div className="space-y-6 p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e6f3ec] text-[#28785a]">
                  <CheckCircle2 size={26} aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold">
                    Your workspace is ready for real work
                  </p>
                  <p className="mt-1 text-xs text-[#5b7075]">
                    Start one card and add more detail as you go.
                  </p>
                </div>
              </div>
              <div className="grid gap-3 border-t border-[#edf0f1] pt-6 sm:grid-cols-2">
                <div className="rounded-xl bg-[#f3f7f5] p-4">
                  <Layers3
                    size={20}
                    className="text-[#26765c]"
                    aria-hidden="true"
                  />
                  <h2 className="mt-3 text-sm font-semibold">
                    Use your foundation
                  </h2>
                  <p className="mt-1 text-xs leading-6 text-[#5b7075]">
                    Select the buyer, material, supplier, and category you
                    introduced. Missing records can still be created in the
                    card.
                  </p>
                </div>
                <div className="rounded-xl bg-[#f3f7f5] p-4">
                  <CheckCircle2
                    size={20}
                    className="text-[#26765c]"
                    aria-hidden="true"
                  />
                  <h2 className="mt-3 text-sm font-semibold">
                    Track a credible saving
                  </h2>
                  <p className="mt-1 text-xs leading-6 text-[#5b7075]">
                    Enter baseline and new prices, annual volume, currency, and
                    supporting evidence. Finance approval happens afterward.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col-reverse gap-3 border-t border-[#edf0f1] px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
              <button
                type="button"
                onClick={() => goTo(5)}
                className="inline-flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-[#5b7075] hover:text-[#155e52]"
              >
                <ArrowLeft size={16} aria-hidden="true" /> Back to categories
              </button>
              <Link
                href={
                  hasCards ? "/dashboard" : "/saving-cards/new?from=onboarding"
                }
                className={onboardingPrimaryClass}
              >
                {hasCards ? "Open dashboard" : "Create first saving card"}{" "}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
          {hasCards ? (
            <p className="mt-5 text-center text-sm text-[#5b7075]">
              Have another idea?{" "}
              <Link
                href="/saving-cards/new?from=onboarding"
                className="font-semibold text-[#216f56] underline underline-offset-4"
              >
                Create another saving card
              </Link>
            </p>
          ) : null}
        </>
      )}
    </OnboardingShell>
  );
}
