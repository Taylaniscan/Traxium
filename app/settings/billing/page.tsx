import Link from "next/link";
import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { bootstrapCurrentUser } from "@/lib/auth";

type BillingReturnPageProps = {
  searchParams: Promise<{
    checkout?: string | string[];
  }>;
};

function readSingleSearchParam(value: string | string[] | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function buildBillingRequiredPath(
  recovery: "checkout_cancelled" | "processing" | null
) {
  if (!recovery) {
    return "/billing-required";
  }

  return `/billing-required?recovery=${recovery}`;
}

export default async function BillingReturnPage({
  searchParams,
}: BillingReturnPageProps) {
  const resolvedSearchParams = await searchParams;
  const checkoutState = readSingleSearchParam(resolvedSearchParams.checkout);
  const session = await bootstrapCurrentUser();

  if (session.ok) {
    redirect("/dashboard");
  }

  if (session.code === "UNAUTHENTICATED") {
    redirect("/login");
  }

  if (session.code === "ORGANIZATION_ACCESS_REQUIRED") {
    redirect("/onboarding");
  }

  if (session.code === "BILLING_REQUIRED") {
    if (checkoutState === "success") {
      redirect(buildBillingRequiredPath("processing"));
    }

    if (checkoutState === "cancelled") {
      redirect(buildBillingRequiredPath("checkout_cancelled"));
    }

    redirect(buildBillingRequiredPath(null));
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-6 py-16 text-[var(--foreground)]">
      <div className="mx-auto max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle>Billing return could not be completed</CardTitle>
            <CardDescription>
              Traxium could not route the billing return into a valid workspace session.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {session.message}
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/billing-required"
                className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--muted)]"
              >
                Back to billing recovery
              </Link>
              <Link
                href="/logout"
                className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--muted)]"
              >
                Sign out
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
