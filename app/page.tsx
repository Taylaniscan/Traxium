import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Ban,
  CalendarCheck,
  Calculator,
  ClipboardList,
  CreditCard,
  FileSpreadsheet,
  Layers,
  Lock,
  ScrollText,
  ShieldCheck,
  ShieldQuestion,
  Users,
} from "lucide-react";

import { getWorkspaceOnboardingState } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Color tone -> literal token utility classes. Kept as full literal strings so
// Tailwind v4 can statically detect them, and so every color traces back to the
// shared design tokens in app/globals.css (no second palette).
const chipTones = {
  primary: "bg-[var(--primary-soft)] text-[var(--primary-action)]",
  proposed: "bg-[var(--phase-proposed-soft)] text-[var(--phase-proposed-text)]",
  validated: "bg-[var(--phase-validated-soft)] text-[var(--phase-validated-text)]",
  implemented: "bg-[var(--phase-implemented-soft)] text-[var(--phase-implemented-text)]",
  captured: "bg-[var(--phase-captured-soft)] text-[var(--phase-captured-text)]",
  canceled: "bg-[var(--phase-canceled-soft)] text-[var(--phase-canceled-text)]",
} as const;

type Tone = keyof typeof chipTones;

const primaryCtaClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-[var(--primary-foreground)] shadow-[var(--shadow-card)] transition-colors hover:bg-[var(--primary-action-hover)]";
const secondaryCtaClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border bg-surface px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-[var(--surface-muted)]";

function IconChip({
  tone,
  children,
}: {
  tone: Tone;
  children: React.ReactNode;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-10 w-10 items-center justify-center rounded-xl [&_svg]:h-5 [&_svg]:w-5 ${chipTones[tone]}`}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Hero product mockup — pure HTML/CSS, no images. Illustrative sample data.
// ---------------------------------------------------------------------------

const MOCKUP_COLUMNS: Array<{ label: string; count: number; tone: Tone }> = [
  { label: "Proposed", count: 6, tone: "proposed" },
  { label: "Finance Validated", count: 4, tone: "validated" },
  { label: "Implemented", count: 3, tone: "implemented" },
  { label: "Captured", count: 5, tone: "captured" },
  { label: "Canceled", count: 1, tone: "canceled" },
];

function ProductMockup() {
  return (
    <figure className="m-0">
      <div
        aria-hidden="true"
        className="overflow-hidden rounded-2xl border bg-surface shadow-[var(--shadow-pop)]"
      >
        {/* Window chrome */}
        <div className="flex items-center gap-2 border-b bg-[var(--surface-muted)] px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--phase-canceled)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--phase-validated)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--phase-captured)]" />
          <p className="ml-2 text-xs font-medium text-muted-foreground">
            Savings register
          </p>
          <span className="ml-auto rounded-full bg-[var(--phase-captured-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--phase-captured-text)]">
            Finance view
          </span>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          {/* KPI tiles */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border bg-surface p-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[var(--primary-soft)] text-[var(--primary-action)]">
                  <CalendarCheck className="h-3.5 w-3.5" />
                </span>
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  In-Year Value
                </p>
              </div>
              <p className="text-numeric mt-2 text-2xl font-semibold sm:text-3xl">
                $2.4M
              </p>
            </div>
            <div className="rounded-xl border bg-surface p-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[var(--phase-captured-soft)] text-[var(--phase-captured-text)]">
                  <Layers className="h-3.5 w-3.5" />
                </span>
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Annualized Run-Rate
                </p>
              </div>
              <p className="text-numeric mt-2 text-2xl font-semibold sm:text-3xl">
                $3.1M
              </p>
            </div>
          </div>

          {/* Mini phase board */}
          <div className="grid grid-cols-5 gap-2">
            {MOCKUP_COLUMNS.map((column) => (
              <div
                key={column.label}
                className={`rounded-lg border-t-[3px] bg-[var(--surface-muted)] px-1.5 pb-2 pt-1.5 ${
                  {
                    proposed: "border-t-[var(--phase-proposed)]",
                    validated: "border-t-[var(--phase-validated)]",
                    implemented: "border-t-[var(--phase-implemented)]",
                    captured: "border-t-[var(--phase-captured)]",
                    canceled: "border-t-[var(--phase-canceled)]",
                    primary: "border-t-[var(--primary-action)]",
                  }[column.tone]
                }`}
              >
                <p
                  className={`truncate text-center text-[8px] font-semibold leading-tight ${chipTones[column.tone].split(" ")[1]}`}
                >
                  {column.label}
                </p>
                <p className="text-numeric mt-1 text-center text-xs font-semibold">
                  {column.count}
                </p>
              </div>
            ))}
          </div>

          {/* Card row with finance-validated pill + lock */}
          <div className="flex items-center gap-3 rounded-xl border bg-surface px-3 py-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--phase-validated-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--phase-validated-text)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--phase-validated)]" />
              Finance Validated
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
              Titanium dioxide dual-source award
            </span>
            <Lock className="h-4 w-4 shrink-0 text-[var(--finance-lock)]" />
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs text-muted-foreground">
        Illustrative dashboard — sample data, not a customer result.
      </figcaption>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Section data
// ---------------------------------------------------------------------------

const PROBLEMS: Array<{
  tone: Tone;
  icon: React.ReactNode;
  title: string;
  body: string;
}> = [
  {
    tone: "proposed",
    icon: <FileSpreadsheet />,
    title: "Savings live in scattered spreadsheets",
    body: "Tracking sits across Excel, email, and slide decks, so ownership, evidence, and approval state get lost between updates.",
  },
  {
    tone: "canceled",
    icon: <ShieldQuestion />,
    title: "Finance doesn't trust the number",
    body: "Without assumptions, evidence, and approvals in one place, finance can't confirm that the savings are real.",
  },
  {
    tone: "validated",
    icon: <ScrollText />,
    title: "Every report is rebuilt by hand",
    body: "Pulling a controller-ready savings summary means re-keying spreadsheets instead of exporting a reconciled workbook.",
  },
];

const WORKFLOW: Array<{ tone: Tone; label: string; body: string }> = [
  {
    tone: "proposed",
    label: "Proposed",
    body: "A new saving card enters the register with its commercial case.",
  },
  {
    tone: "validated",
    label: "Finance Validated",
    body: "Finance reviews the assumptions and approves the savings case.",
  },
  {
    tone: "implemented",
    label: "Implemented",
    body: "The change is in place and savings begin to land.",
  },
  {
    tone: "captured",
    label: "Captured",
    body: "Confirmed value, backed by evidence and an audit trail.",
  },
];

const FEATURES: Array<{
  tone: Tone;
  icon: React.ReactNode;
  title: string;
  body: string;
}> = [
  {
    tone: "proposed",
    icon: <ClipboardList />,
    title: "Savings register with evidence",
    body: "One governed register of saving cards with buyers, suppliers, materials, categories, sites, commercial assumptions, and private evidence files.",
  },
  {
    tone: "validated",
    icon: <ShieldCheck />,
    title: "Approval workflow & finance lock",
    body: "Phase changes run through procurement and finance approval, with finance lock protecting validated price, volume, and savings assumptions.",
  },
  {
    tone: "implemented",
    icon: <Calculator />,
    title: "In-year vs. annualized math",
    body: "See in-year value and full annualized run-rate from baseline price, new price, and annual volume — (Baseline − New) × Annual Volume.",
  },
  {
    tone: "captured",
    icon: <CalendarCheck />,
    title: "Monthly close & actuals reconciliation",
    body: "Track forecast against actual volumes each month and reconcile captured value against what really landed.",
  },
  {
    tone: "primary",
    icon: <FileSpreadsheet />,
    title: "Controller-ready XLSX export",
    body: "Export a controller-review workbook — portfolio summary, saving cards, data dictionary, import template, and evidence coverage — with no storage paths or secrets.",
  },
  {
    tone: "implemented",
    icon: <Users />,
    title: "Workspace roles & audit trail",
    body: "Workspace and business roles, named finance-reviewer coverage, and organization-scoped audit events for workflow, evidence, and admin actions.",
  },
];

const EXAMPLE_INITIATIVES: Array<{
  tone: Tone;
  phase: string;
  title: string;
  tag: string;
}> = [
  {
    tone: "implemented",
    phase: "Implemented",
    title: "Titanium dioxide dual-source award",
    tag: "Hard savings",
  },
  {
    tone: "captured",
    phase: "Captured",
    title: "Packaging film gauge reduction",
    tag: "Hard savings",
  },
  {
    tone: "validated",
    phase: "Finance Validated",
    title: "Mitigated resin price increase",
    tag: "Cost avoidance",
  },
];

const TRUST_POINTS: Array<{
  tone: Tone;
  icon: React.ReactNode;
  title: string;
  body: string;
}> = [
  {
    tone: "proposed",
    icon: <Layers />,
    title: "Workspace tenant isolation",
    body: "Every workspace's data is isolated. Users need an active membership, and cross-tenant access is rejected in application authorization and query constraints.",
  },
  {
    tone: "captured",
    icon: <Lock />,
    title: "Private evidence, expiring links",
    body: "Evidence files live in a private bucket. Downloads go through an authenticated route, and signed links expire after 60 seconds.",
  },
  {
    tone: "validated",
    icon: <CreditCard />,
    title: "Stripe-handled payments",
    body: "Stripe manages payment collection and methods. Traxium never stores payment-card or bank-account details.",
  },
  {
    tone: "canceled",
    icon: <Ban />,
    title: "What we don't claim",
    body: "No SOC 2 or ISO 27001 certification. No SSO/SAML, ERP connector, or accounting posting in the first pilot. We put the boundaries in writing.",
  },
];

const PILOT_INCLUDED = [
  "Kickoff to confirm categories, sites, buyers, finance reviewers, and your first saving cards",
  "Guided demo walkthrough before any live data entry",
  "Excel savings-tracker migration with all-or-nothing validated import",
  "Guided creation of the first real saving card, with inline master-data setup",
  "At least one phase change reviewed through the finance approval flow",
  "Weekly operating reviews of open actions, finance locks, and reporting fit",
  "End-of-pilot recap with decision summary, blockers, and a rollout recommendation",
];

// ---------------------------------------------------------------------------

export default async function HomePage() {
  const state = await getWorkspaceOnboardingState();

  if (state.ok) {
    if (state.needsWorkspace) {
      redirect("/onboarding");
    }

    redirect("/dashboard");
  }

  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="text-base font-semibold tracking-tight">
            Traxium
          </Link>
          <nav className="flex items-center gap-1 text-sm sm:gap-2">
            <Link
              href="/trust"
              className="rounded-md px-3 py-2 font-medium text-muted-foreground transition-colors hover:bg-[var(--surface-muted)] hover:text-foreground"
            >
              Trust &amp; security
            </Link>
            <Link
              href="/login"
              className="rounded-md px-3 py-2 font-medium text-muted-foreground transition-colors hover:bg-[var(--surface-muted)] hover:text-foreground"
            >
              Sign in
            </Link>
            <Link
              href="/pilot"
              className="rounded-md bg-primary px-3 py-2 font-semibold text-[var(--primary-foreground)] transition-colors hover:bg-[var(--primary-action-hover)]"
            >
              Request paid pilot
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* 1. HERO */}
        <section
          aria-labelledby="hero-heading"
          className="border-b bg-surface"
        >
          <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.92fr)] lg:items-center lg:py-24">
            <div className="space-y-6">
              <p className="inline-flex items-center gap-2 rounded-full bg-[var(--primary-soft)] px-3 py-1 text-sm font-semibold text-[var(--primary-action)]">
                Finance-trusted savings governance for US manufacturing SMEs
              </p>
              <h1
                id="hero-heading"
                className="text-4xl font-semibold tracking-[-0.03em] sm:text-5xl lg:text-6xl"
              >
                Stop defending your savings numbers.
              </h1>
              <p className="max-w-xl text-lg leading-7 text-muted-foreground">
                Track procurement savings with finance approval, evidence, and an
                audit trail — without the Excel chaos.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/pilot" className={primaryCtaClass}>
                  Request paid pilot
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link href="#how-it-works" className={secondaryCtaClass}>
                  See how it works
                </Link>
              </div>
              <p className="text-sm text-muted-foreground">
                Sales-led, guided paid pilot — no self-serve signup, no card
                required to talk to us.
              </p>
            </div>

            <ProductMockup />
          </div>
        </section>

        {/* 2. PROBLEM STRIP */}
        <section aria-labelledby="problem-heading" className="border-b">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <div className="max-w-2xl space-y-3">
              <h2 id="problem-heading" className="text-3xl font-semibold tracking-[-0.02em]">
                Spreadsheets can&rsquo;t prove savings
              </h2>
              <p className="text-muted-foreground">
                By the time finance asks how the number was built, the trail has
                gone cold.
              </p>
            </div>
            <div className="mt-10 grid gap-5 sm:grid-cols-3">
              {PROBLEMS.map((problem) => (
                <article
                  key={problem.title}
                  className="card-interactive rounded-2xl border bg-surface p-6 shadow-[var(--shadow-card)]"
                >
                  <IconChip tone={problem.tone}>{problem.icon}</IconChip>
                  <h3 className="mt-4 text-lg font-semibold">{problem.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {problem.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 3. HOW IT WORKS — workflow lifecycle */}
        <section
          id="how-it-works"
          aria-labelledby="workflow-heading"
          className="scroll-mt-20 border-b bg-surface"
        >
          <div className="mx-auto max-w-6xl px-6 py-16">
            <div className="max-w-2xl space-y-3">
              <h2 id="workflow-heading" className="text-3xl font-semibold tracking-[-0.02em]">
                One governed savings lifecycle
              </h2>
              <p className="text-muted-foreground">
                Every saving card moves through the same finance-reviewed phases.
                Each move is an approved phase change, not a silent edit.
              </p>
            </div>

            <ol className="mt-10 flex flex-col gap-4 md:flex-row md:items-stretch md:gap-2">
              {WORKFLOW.map((step, index) => (
                <li
                  key={step.label}
                  className="flex items-stretch gap-2 md:flex-1 md:flex-col"
                >
                  <div className="card-interactive flex-1 rounded-2xl border bg-surface p-5 shadow-[var(--shadow-card)]">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${chipTones[step.tone]}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          {
                            proposed: "bg-[var(--phase-proposed)]",
                            validated: "bg-[var(--phase-validated)]",
                            implemented: "bg-[var(--phase-implemented)]",
                            captured: "bg-[var(--phase-captured)]",
                            canceled: "bg-[var(--phase-canceled)]",
                            primary: "bg-[var(--primary-action)]",
                          }[step.tone]
                        }`}
                      />
                      Step {index + 1}
                    </span>
                    <h3 className="mt-3 text-base font-semibold">{step.label}</h3>
                    <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                      {step.body}
                    </p>
                  </div>
                  {index < WORKFLOW.length - 1 ? (
                    <div
                      aria-hidden="true"
                      className="flex items-center justify-center text-muted-foreground md:py-1"
                    >
                      <ArrowRight className="h-5 w-5 md:rotate-90 lg:rotate-0" />
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>

            <p className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[var(--phase-canceled-soft)] px-3 py-2 text-sm text-[var(--phase-canceled-text)]">
              <Ban className="h-4 w-4 shrink-0" aria-hidden="true" />
              Any initiative can be Canceled with a recorded reason — the history
              stays intact.
            </p>
          </div>
        </section>

        {/* 4. FEATURE GRID */}
        <section aria-labelledby="features-heading" className="border-b">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <div className="max-w-2xl space-y-3">
              <h2 id="features-heading" className="text-3xl font-semibold tracking-[-0.02em]">
                Built to make finance say yes
              </h2>
              <p className="text-muted-foreground">
                Everything procurement and finance need to govern a savings
                program in one workspace.
              </p>
            </div>
            <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <article
                  key={feature.title}
                  className="card-interactive rounded-2xl border bg-surface p-6 shadow-[var(--shadow-card)]"
                >
                  <IconChip tone={feature.tone}>{feature.icon}</IconChip>
                  <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {feature.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 5. BUILT FOR MANUFACTURING */}
        <section aria-labelledby="icp-heading" className="border-b bg-surface">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[0.85fr_1fr] lg:items-center">
            <div className="space-y-3">
              <h2 id="icp-heading" className="text-3xl font-semibold tracking-[-0.02em]">
                Made for US manufacturing
              </h2>
              <p className="text-muted-foreground">
                Traxium is built for 50–500 employee US manufacturers where
                procurement and finance both need to trust the same savings
                register — direct and indirect, hard savings and cost avoidance.
              </p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-3">
              {EXAMPLE_INITIATIVES.map((item) => (
                <li
                  key={item.title}
                  className="rounded-2xl border bg-surface p-4 shadow-[var(--shadow-card)]"
                >
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${chipTones[item.tone]}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        {
                          proposed: "bg-[var(--phase-proposed)]",
                          validated: "bg-[var(--phase-validated)]",
                          implemented: "bg-[var(--phase-implemented)]",
                          captured: "bg-[var(--phase-captured)]",
                          canceled: "bg-[var(--phase-canceled)]",
                          primary: "bg-[var(--primary-action)]",
                        }[item.tone]
                      }`}
                    />
                    {item.phase}
                  </span>
                  <p className="mt-3 text-sm font-semibold leading-snug text-foreground">
                    {item.title}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.tag}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 6. HONEST TRUST */}
        <section aria-labelledby="trust-heading" className="border-b">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <div className="rounded-3xl border bg-surface p-6 shadow-[var(--shadow-card)] sm:p-10">
              <div className="max-w-2xl space-y-3">
                <h2 id="trust-heading" className="text-3xl font-semibold tracking-[-0.02em]">
                  Honest about what we do &mdash; and don&rsquo;t
                </h2>
                <p className="text-muted-foreground">
                  This is a product and technical boundary, not a certification
                  report. Being clear about the limits is part of the pitch.
                </p>
              </div>
              <div className="mt-8 grid gap-5 sm:grid-cols-2">
                {TRUST_POINTS.map((point) => (
                  <div key={point.title} className="flex gap-4">
                    <IconChip tone={point.tone}>{point.icon}</IconChip>
                    <div>
                      <h3 className="text-base font-semibold">{point.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {point.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8">
                <Link href="/trust" className={secondaryCtaClass}>
                  Read the full trust pack
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* 7. PILOT OFFER */}
        <section aria-labelledby="pilot-heading" className="border-b bg-surface">
          <div className="mx-auto max-w-3xl px-6 py-16">
            <div className="rounded-3xl border bg-background p-6 shadow-[var(--shadow-pop)] sm:p-10">
              <div className="text-center">
                <p className="inline-flex items-center gap-2 rounded-full bg-[var(--primary-soft)] px-3 py-1 text-sm font-semibold text-[var(--primary-action)]">
                  The paid pilot
                </p>
                <h2 id="pilot-heading" className="mt-4 text-3xl font-semibold tracking-[-0.02em]">
                  A guided 30–45 day paid pilot
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
                  One manufacturing workspace, one focused procurement and finance
                  team, and your real saving cards — proven before any wider
                  rollout decision.
                </p>
              </div>

              <ul className="mx-auto mt-8 grid max-w-xl gap-3">
                {PILOT_INCLUDED.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--phase-captured-soft)] text-[var(--phase-captured-text)]"
                    >
                      <ShieldCheck className="h-3 w-3" />
                    </span>
                    <span className="leading-6 text-foreground">{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex flex-col items-center gap-3">
                <Link href="/pilot" className={primaryCtaClass}>
                  Request paid pilot
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <p className="text-center text-xs text-muted-foreground">
                  Pricing is scoped with you — no public price, no self-serve tiers.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <p className="text-sm font-semibold">Traxium</p>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/trust" className="transition-colors hover:text-foreground">
              Trust &amp; security
            </Link>
            <Link href="/pilot" className="transition-colors hover:text-foreground">
              Request paid pilot
            </Link>
            <Link href="/login" className="transition-colors hover:text-foreground">
              Sign in
            </Link>
          </nav>
          <p className="text-xs text-muted-foreground">
            © {year} Traxium
          </p>
        </div>
      </footer>
    </div>
  );
}
