import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";

export default async function HomePage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-20">
        <div className="max-w-3xl space-y-6">
          <div className="inline-flex rounded-full border px-3 py-1 text-sm">
            Procurement Savings Governance
          </div>

          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Control procurement savings from idea to realized value.
          </h1>

          <p className="text-lg text-muted-foreground">
            Traxium helps procurement and finance teams replace spreadsheet chaos
            with one governed system for savings initiatives, approvals, and reporting.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground"
            >
              Sign in
            </Link>

            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-md border px-5 py-3 text-sm font-medium"
            >
              View product
            </Link>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border p-5">
            <h2 className="font-medium">Track initiatives</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Capture savings cards with owners, categories, suppliers, plants,
              and financial impact.
            </p>
          </div>

          <div className="rounded-xl border p-5">
            <h2 className="font-medium">Govern approvals</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Move initiatives through controlled workflow phases with visibility
              for procurement leadership and finance.
            </p>
          </div>

          <div className="rounded-xl border p-5">
            <h2 className="font-medium">Report outcomes</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Give stakeholders one trusted view of pipeline, execution status,
              and savings performance.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}