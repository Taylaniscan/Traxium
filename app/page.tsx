import Link from "next/link";
import { redirect } from "next/navigation";

import { getWorkspaceOnboardingState } from "@/lib/auth";

export const dynamic = "force-dynamic";

const pilotProofPoints = [
  {
    label: "One paid-pilot workspace",
    detail: "Create live saving cards with buyers, suppliers, materials, plants, categories, and business units.",
  },
  {
    label: "Finance-reviewed workflow",
    detail: "Move work through Idea, Validated, Realized, Achieved, and Canceled with approval history.",
  },
  {
    label: "Private evidence trail",
    detail: "Attach support files and serve downloads through signed application routes when storage is configured.",
  },
  {
    label: "Controller-ready export",
    detail: "Export active cards, phase counts, realized value, finance locks, and row-level savings assumptions to XLSX.",
  },
];

const trustBoundaries = [
  "Built for a guided paid pilot, not a broad ERP replacement.",
  "No SSO/SAML, ERP connector, or custom approval-builder promise in the first pilot.",
  "Security review should cover tenant isolation, private evidence storage, billing access, and export handling.",
];

function ProductSnapshot() {
  return (
    <div className="rounded-lg border bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between border-b pb-3">
        <div>
          <p className="text-sm font-medium">UtopiaTrax savings register</p>
          <p className="text-xs text-muted-foreground">
            US manufacturing SME pilot portfolio
          </p>
        </div>
        <span className="rounded-md bg-[var(--success-surface)] px-2 py-1 text-xs font-medium text-success">
          Finance view
        </span>
      </div>

      <div className="grid gap-3 py-4 sm:grid-cols-3">
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Total cards</p>
          <p className="mt-1 text-2xl font-semibold">25</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Pending actions</p>
          <p className="mt-1 text-2xl font-semibold">7</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Finance locked</p>
          <p className="mt-1 text-2xl font-semibold">5</p>
        </div>
      </div>

      <div className="space-y-2">
        {[
          ["Validated", "Bio-based carrier pilot sourcing", "Finance Reviewer"],
          ["Realized", "Titanium dioxide dual-source award", "Procurement Lead"],
          ["Achieved", "Packaging film gauge reduction", "Finance Reviewer"],
        ].map(([phase, title, owner]) => (
          <div
            key={title}
            className="grid grid-cols-[96px_1fr] gap-3 rounded-md border bg-surface-elevated px-3 py-2 text-sm sm:grid-cols-[104px_1fr_132px]"
          >
            <span className="font-medium">{phase}</span>
            <span>{title}</span>
            <span className="hidden text-muted-foreground sm:block">{owner}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function HomePage() {
  const state = await getWorkspaceOnboardingState();

  if (state.ok) {
    if (state.needsWorkspace) {
      redirect("/onboarding");
    }

    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="text-base font-semibold">
            Traxium
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/login" className="rounded-md px-3 py-2 font-medium">
              Sign in
            </Link>
            <Link
              href="/dashboard"
              className="rounded-md border px-3 py-2 font-medium"
            >
              View product
            </Link>
          </nav>
        </div>
      </header>

      <section className="border-b bg-surface">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 lg:grid-cols-[minmax(0,1fr)_minmax(380px,0.86fr)] lg:items-center">
          <div className="space-y-6">
            <p className="text-sm font-medium text-primary">
              Paid pilot package for 50-500 employee US manufacturing SMEs
            </p>
            <h1 className="max-w-3xl text-3xl font-semibold sm:text-5xl">
              Finance-trusted savings governance for US manufacturing SMEs.
            </h1>
            <p className="max-w-2xl text-lg text-muted-foreground">
              Traxium gives SME procurement and finance teams one governed savings
              register for saving cards, evidence, approvals, open actions,
              portfolio views, and controller-ready export.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 py-3 text-sm font-medium !text-white"
              >
                Sign in
              </Link>

              <Link
                href="/dashboard"
                className="inline-flex min-h-11 items-center justify-center rounded-md border bg-surface px-5 py-3 text-sm font-medium"
              >
                View product
              </Link>
            </div>
          </div>

          <ProductSnapshot />
        </div>
      </section>

      <section className="border-b">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="max-w-2xl space-y-3">
            <h2 className="text-2xl font-semibold">What pilot buyers can prove</h2>
            <p className="text-muted-foreground">
              The first pilot is designed to validate governed savings work with a
              focused team before wider rollout decisions.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {pilotProofPoints.map((item) => (
              <article key={item.label} className="rounded-lg border bg-surface p-5">
                <h3 className="font-medium">{item.label}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 lg:grid-cols-[0.75fr_1fr]">
          <div>
            <h2 className="text-2xl font-semibold">Trust boundaries stay clear</h2>
            <p className="mt-3 text-muted-foreground">
              The buyer story is intentionally narrow: help a US manufacturing
              SME prove finance trust, saving-card governance, evidence handling,
              and exportable reporting with the current product.
            </p>
          </div>

          <ul className="grid gap-3">
            {trustBoundaries.map((item) => (
              <li key={item} className="rounded-lg border bg-surface p-4 text-sm">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
