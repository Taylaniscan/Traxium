import Link from "next/link";
import { ArrowUpRight, Check, Layers3, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

const steps = [
  { title: "Your workspace", detail: "Give your team a home" },
  { title: "Your starting point", detail: "Choose what works for you" },
  { title: "Ready to track", detail: "Take the first useful step" },
];

export const onboardingPrimaryClass =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#155e52] px-6 py-3 text-sm font-semibold text-white! transition hover:bg-[#104b42] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155e52] focus-visible:ring-offset-4 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500";

export function OnboardingShell({
  step,
  workspaceName,
  onBackToStart,
  children,
}: {
  step: 1 | 2 | 3;
  workspaceName?: string;
  onBackToStart?: () => void;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#f5f7f8] text-[#1b2d32]">
      <header className="border-b border-[#e2e8e9] bg-white">
        <div className="mx-auto flex h-20 max-w-[1180px] items-center justify-between gap-4 px-5 sm:px-10">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-xl font-semibold tracking-tight"
            aria-label="Traxium home"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#155e52] text-white">
              <Layers3 size={20} aria-hidden="true" />
            </span>
            traxium<span className="text-[#2d8b75]">.</span>
          </Link>
          {step > 1 ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#637579] hover:text-[#155e52]"
            >
              Continue later <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          ) : (
            <span className="text-xs font-medium tracking-wide text-[#637579]">
              LET’S GET YOU STARTED
            </span>
          )}
        </div>
      </header>

      <div className="mx-auto grid max-w-[1180px] gap-8 px-5 py-8 sm:px-10 sm:py-12 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-16 lg:py-16">
        <aside>
          <p className="mb-6 text-xs font-semibold uppercase tracking-[0.15em] text-[#73868a]">
            Your setup, simplified
          </p>
          <nav aria-label="Onboarding progress">
            <ol className="grid grid-cols-3 gap-3 lg:grid-cols-1 lg:gap-0">
              {steps.map((item, index) => {
                const number = index + 1;
                const complete = number < step;
                const active = number === step;
                const content = (
                  <>
                    <span
                      className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${complete ? "bg-[#e1efe9] text-[#155e52]" : active ? "bg-[#155e52] text-white ring-4 ring-[#e2eeea]" : "border border-[#d5dfe1] bg-[#f5f7f8] text-[#5b7075]"}`}
                    >
                      {complete ? (
                        <Check size={17} aria-label="Complete" />
                      ) : (
                        number
                      )}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={`block text-xs font-semibold sm:text-sm ${active ? "text-[#155e52]" : complete ? "text-[#324c51]" : "text-[#5b7075]"}`}
                      >
                        {item.title}
                      </span>
                      <span className="mt-1 hidden text-xs leading-5 text-[#5b7075] lg:block">
                        {item.detail}
                      </span>
                    </span>
                  </>
                );
                return (
                  <li
                    key={item.title}
                    aria-current={active ? "step" : undefined}
                    className="relative lg:pb-9"
                  >
                    {index < 2 ? (
                      <span
                        aria-hidden="true"
                        className="absolute bottom-0 left-[17px] top-9 hidden w-px bg-[#dce5e4] lg:block"
                      />
                    ) : null}
                    {number === 2 && step === 3 && onBackToStart ? (
                      <button
                        type="button"
                        onClick={onBackToStart}
                        className="flex flex-col items-start gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155e52] lg:flex-row"
                      >
                        {content}
                      </button>
                    ) : (
                      <div className="flex flex-col items-start gap-3 lg:flex-row">
                        {content}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
          <div className="mt-8 hidden rounded-2xl bg-[#eaf0ed] p-5 lg:block">
            <ShieldCheck
              className="mb-3 text-[#397966]"
              size={23}
              aria-hidden="true"
            />
            <p className="text-sm font-semibold leading-6">
              A shared view of savings.
            </p>
            <p className="mt-2 text-xs leading-6 text-[#637970]">
              Bring prices, evidence, and finance approvals into one place.
              Start small and build as you go.
            </p>
          </div>
          {workspaceName ? (
            <p className="mt-6 hidden break-words text-xs leading-5 text-[#73868a] lg:block">
              Workspace
              <br />
              <span className="font-semibold text-[#3c555a]">
                {workspaceName}
              </span>
            </p>
          ) : null}
        </aside>

        <section className="min-w-0" aria-label={`Step ${step} of 3`}>
          {children}
          <p className="mt-6 text-center text-xs leading-5 text-[#5b7075]">
            Built for small procurement and finance teams.
          </p>
        </section>
      </div>
    </main>
  );
}
