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
  return (
    <form method="post" action="/billing/recover" className={className}>
      <input type="hidden" name="intent" value={intent} />
      {planCode ? (
        <input type="hidden" name="planCode" value={planCode} />
      ) : null}
      <Button type="submit">{label}</Button>
    </form>
  );
}
