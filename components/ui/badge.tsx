import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

const tones: Record<string, string> = {
  slate: "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-secondary)]",
  neutral: "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-secondary)]",
  amber: "border-transparent bg-[var(--phase-validated-soft)] text-[var(--phase-validated-text)]",
  warn: "border-transparent bg-[var(--phase-validated-soft)] text-[var(--phase-validated-text)]",
  teal: "border-transparent bg-[var(--phase-implemented-soft)] text-[var(--phase-implemented-text)]",
  blue: "border-transparent bg-[var(--phase-proposed-soft)] text-[var(--phase-proposed-text)]",
  emerald: "border-transparent bg-[var(--phase-captured-soft)] text-[var(--phase-captured-text)]",
  success: "border-transparent bg-[var(--phase-captured-soft)] text-[var(--phase-captured-text)]",
  rose: "border-transparent bg-[var(--phase-canceled-soft)] text-[var(--phase-canceled-text)]",
  error: "border-transparent bg-[var(--phase-canceled-soft)] text-[var(--phase-canceled-text)]",
  orange: "border-transparent bg-[var(--phase-validated-soft)] text-[var(--phase-validated-text)]",
  violet: "border-transparent bg-[var(--primary-soft)] text-[var(--primary-action)]",
  lock: "border-transparent bg-[var(--finance-lock-surface)] text-[var(--finance-lock)]"
};

export function Badge({
  className,
  tone = "slate",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[0.01em]",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}
