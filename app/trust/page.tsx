import type { Metadata } from "next";
import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Trust & Security for Guided Pilots | Traxium",
  description:
    "How Traxium handles workspace isolation, evidence files, billing, exports, provider proof, and support during guided paid pilots.",
};

const trustAreas = [
  {
    title: "Workspace isolation",
    description:
      "Application data is scoped to the active workspace. Membership and organization checks are applied to saving cards, administration, billing, import/export, and evidence routes.",
  },
  {
    title: "Roles and access",
    description:
      "Workspace Owner/Admin permissions are separate from procurement and finance workflow roles. Billing management and finance validation remain role-aware.",
  },
  {
    title: "Private evidence storage",
    description:
      "Evidence uses private provider storage when configured. Traxium stores metadata and managed paths rather than public evidence URLs.",
  },
  {
    title: "Signed downloads",
    description:
      "Downloads require authentication and card access. Bucket and tenant namespaces are checked before a server-generated link is signed for 60 seconds.",
  },
  {
    title: "Stripe-managed billing",
    description:
      "Stripe manages payment methods and payment collection. Traxium stores subscription and customer metadata needed to manage workspace access, not card details.",
  },
  {
    title: "Controlled import and export",
    description:
      "Saving-card imports validate all rows before a transactional write. Controller exports exclude signed URLs, storage paths, tokens, secrets, and unrelated workspace data.",
  },
];

const supportPoints = [
  "Business-hours, email-based support through an agreed pilot contact.",
  "Best-effort same-business-day attention for critical access, billing-access, or evidence-availability issues.",
  "Normal product and workflow questions target a response within one business day.",
  "Provider incidents may require coordination with Supabase, Stripe, Vercel, or another configured provider.",
];

const exclusions = [
  "No SOC 2 or ISO 27001 certification claim",
  "No SSO/SAML or SCIM",
  "No ERP/MRP integration or accounting-system posting",
  "No custom approval builder or broad procurement-suite coverage",
  "No audited accounting recognition or guaranteed savings",
  "No 24/7 support or enterprise SLA",
];

export default function TrustPage() {
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="text-base font-semibold">
            Traxium
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link
              href="/pilot"
              className="rounded-md px-3 py-2 font-medium"
            >
              Pilot details
            </Link>
            <Link
              href="/pilot"
              className="rounded-md bg-[var(--primary)] px-3 py-2 font-medium !text-white"
            >
              Request paid pilot
            </Link>
          </nav>
        </div>
      </header>

      <section className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <p className="text-sm font-semibold text-[var(--primary)]">
            Paid-pilot trust package
          </p>
          <h1 className="mt-3 max-w-4xl text-3xl font-semibold tracking-tight sm:text-5xl">
            Trust &amp; security for guided pilots
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-[var(--muted-foreground)]">
            How Traxium protects workspace data, evidence files, billing flows,
            and export boundaries during paid pilots for US manufacturing and
            industrial SMEs.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/pilot"
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--primary)] px-5 py-3 text-sm font-medium !text-white"
            >
              Request paid pilot
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-5 py-3 text-sm font-medium"
            >
              Back to Traxium overview
            </Link>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-semibold">
              Controls buyers can review
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
              These statements describe implemented application controls.
              Environment-specific Supabase and Stripe configuration must still
              be validated separately before handling buyer data.
            </p>
          </div>

          <div className="mt-7 grid gap-4 md:grid-cols-2">
            {trustAreas.map((area) => (
              <Card key={area.title}>
                <CardHeader>
                  <CardTitle>{area.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-6 text-[var(--muted-foreground)]">
                    {area.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 py-12 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Audit and provider proof</CardTitle>
              <CardDescription>
                Application proof and provider proof are kept separate.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-6 text-[var(--muted-foreground)]">
              <p>
                Supported evidence, workflow, member, settings, and billing
                actions create organization-scoped audit events where
                implemented.
              </p>
              <p>
                Local tests cover tenant access, signed-link lifetime, path
                validation, rate limits, export redaction, and billing
                permissions. They do not constitute production provider proof.
              </p>
              <p>
                Supabase redirect settings, Stripe webhook delivery, complete
                preview flows, and production smoke checks remain
                environment-specific validation items.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Support expectations</CardTitle>
              <CardDescription>
                A guided pilot includes a practical operating support model.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-3 text-sm leading-6 text-[var(--muted-foreground)]">
                {supportPoints.map((point) => (
                  <li
                    key={point}
                    className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-3"
                  >
                    {point}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <section>
        <div className="mx-auto grid max-w-6xl gap-6 px-6 py-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <h2 className="text-2xl font-semibold">Data and offboarding</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
              Customers can export the controller-review workbook. Evidence-file
              archives, complete audit-history exports, deletion requests, and
              restore work may require a separately agreed manual process.
            </p>
            <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
              Traxium does not currently offer a self-service full-workspace
              archive, self-service permanent deletion, or formal RPO/RTO
              commitment.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>What Traxium does not claim yet</CardTitle>
              <CardDescription>
                The paid-pilot boundary is intentionally explicit.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-3 sm:grid-cols-2">
                {exclusions.map((item) => (
                  <li
                    key={item}
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3 text-sm"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
