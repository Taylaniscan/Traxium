"use client";

import { useState } from "react";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";

export type BillingRecoveryIntent =
  | "open_billing_portal"
  | "resume_subscription"
  | "update_payment_method";

export type BillingRecoveryPlanCode = "starter" | "growth";

type BillingRecoveryFormProps = {
  intent?: BillingRecoveryIntent;
  label?: string;
  planCode?: BillingRecoveryPlanCode;
  className?: string;
};

export function BillingRecoveryForm({
  intent = "open_billing_portal",
  label = "Manage billing",
  planCode,
  className,
}: BillingRecoveryFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const form = event.currentTarget;
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        credentials: "same-origin",
        headers: {
          accept: "application/json",
          "x-billing-recovery-mode": "json",
        },
      });
      const payload = (await response.json().catch(() => null)) as {
        url?: string;
      } | null;

      if (!response.ok || !payload?.url) {
        throw new Error("Stripe billing could not be opened.");
      }

      window.location.assign(payload.url);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Stripe billing could not be opened."
      );
      setIsSubmitting(false);
    }
  }

  return (
    <form
      method="post"
      action="/billing/recover"
      className={className}
      onSubmit={handleSubmit}
    >
      <input type="hidden" name="intent" value={intent} />
      {planCode ? (
        <input type="hidden" name="planCode" value={planCode} />
      ) : null}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Opening Stripe..." : label}
      </Button>
      {error ? (
        <p className="mt-2 text-sm text-[var(--destructive)]" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
