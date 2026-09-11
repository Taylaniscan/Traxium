import type { Metadata } from "next";
import Link from "next/link";

import { PilotLeadForm } from "@/components/pilot/pilot-lead-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Request a Guided Paid Pilot | Traxium",
  description:
    "Request a guided Traxium paid pilot for finance-trusted procurement savings governance at a US manufacturing or industrial SME.",
};

const buyerFit = [
  "US manufacturing and industrial SMEs",
  "Approximately 50-500 employees",
  "Procurement savings tracked in Excel, email, PowerPoint, or manual reports",
  "Finance needs stronger confidence in savings assumptions, evidence, and status",
];

const pilotSteps = [
  "Review your current savings tracker and reporting pain.",
  "Agree one focused workspace, team, and 30-45 day pilot scope.",
  "Create real saving cards with owners and commercial assumptions.",
  "Attach evidence and review finance-validation and approval flow.",
  "Export a reconciled controller-review workbook.",
];

const exclusions = [
  "Not ERP or MRP integration",
  "Not accounting-system posting",
  "Not a free trial or instant-access signup",
  "Not a replacement for every procurement-suite module",
];

export default function PilotPage() {
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="text-base font-semibold">
            Traxium
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link
              href="/trust"
              className="rounded-md px-3 py-2 font-medium"
            >
              Trust &amp; security
            </Link>
            <Link
              href="/login"
              className="rounded-md border border-[var(--border)] px-3 py-2 font-medium"
            >
              Existing pilot sign in
            </Link>
          </nav>
        </div>
      </header>

      <section className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 lg:grid-cols-[minmax(0,0.95fr)_minmax(380px,0.85fr)] lg:items-start">
          <div className="space-y-7">
            <div className="space-y-4">
              <p className="text-sm font-semibold text-[var(--primary)]">
                Founder-led pilot for qualified manufacturing teams
              </p>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
                Request a guided Traxium paid pilot
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-[var(--muted-foreground)]">
                Traxium helps US manufacturing procurement and finance teams
                replace Excel-based savings trackers with evidence-backed saving
                cards, approvals, finance validation, and controller-ready
                reporting.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold">Designed for teams that:</h2>
              <ul className="mt-4 grid gap-3">
                {buyerFit.map((item) => (
                  <li
                    key={item}
                    className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <Card id="demo-preview" className="scroll-mt-6">
              <CardHeader>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">
                  UtopiaTrax demo preview
                </p>
                <CardTitle>See the operating model before using live data.</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-6 text-[var(--muted-foreground)]">
                  UtopiaTrax is a 25-card specialty manufacturing demo portfolio
                  with six procurement categories, evidence coverage, approval
                  history, finance locks, open actions, forecast/actual volume,
                  and a reconciled controller workbook.
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    ["25", "saving cards"],
                    ["6", "direct categories"],
                    ["74%", "active-card evidence coverage"],
                  ].map(([value, label]) => (
                    <div
                      key={label}
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3"
                    >
                      <p className="text-2xl font-semibold">{value}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="text-xs leading-5 text-[var(--muted-foreground)]">
                  The demo is shown in a guided meeting. Internal workspace
                  routes are not exposed as a public product account.
                </p>
              </CardContent>
            </Card>
          </div>

          <PilotLeadForm />
        </div>
      </section>

      <section>
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold">What happens in a pilot</h2>
            <ol className="mt-5 grid gap-3">
              {pilotSteps.map((step, index) => (
                <li
                  key={step}
                  className="flex gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-sm"
                >
                  <span className="font-semibold text-[var(--primary)]">
                    {index + 1}.
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div>
            <h2 className="text-2xl font-semibold">What it is not</h2>
            <ul className="mt-5 grid gap-3">
              {exclusions.map((item) => (
                <li
                  key={item}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-sm"
                >
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-5 text-sm leading-6 text-[var(--muted-foreground)]">
              A pilot request starts a fit conversation. It does not promise
              guaranteed savings, audited accounting recognition, SOC 2
              certification, custom approval builders, or 24/7 support.
            </p>
            <Link
              href="/trust"
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-5 py-3 text-sm font-medium"
            >
              Review pilot trust boundaries
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
