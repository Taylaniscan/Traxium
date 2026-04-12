import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

const tones: Record<string, string> = {
  slate: "border-[var(--border)] bg-[rgba(91,102,117,0.08)] text-[var(--text-secondary)]",
  neutral: "border-[var(--border)] bg-[rgba(91,102,117,0.08)] text-[var(--text-secondary)]",
  amber: "border-[rgba(139,94,21,0.2)] bg-[rgba(139,94,21,0.1)] text-[var(--warning)]",
  warn: "border-[rgba(139,94,21,0.2)] bg-[rgba(139,94,21,0.1)] text-[var(--warning)]",
  teal: "border-[rgba(53,93,122,0.18)] bg-[rgba(53,93,122,0.1)] text-[var(--info-forecast)]",
  blue: "border-[rgba(53,93,122,0.18)] bg-[rgba(53,93,122,0.1)] text-[var(--info-forecast)]",
  emerald: "border-[rgba(31,107,77,0.18)] bg-[rgba(31,107,77,0.1)] text-[var(--success)]",
  success: "border-[rgba(31,107,77,0.18)] bg-[rgba(31,107,77,0.1)] text-[var(--success)]",
  rose: "border-[rgba(161,59,45,0.2)] bg-[rgba(161,59,45,0.1)] text-[var(--risk)]",
  error: "border-[rgba(161,59,45,0.2)] bg-[rgba(161,59,45,0.1)] text-[var(--risk)]",
  orange: "border-[rgba(139,94,21,0.2)] bg-[rgba(139,94,21,0.1)] text-[var(--warning)]",
  violet: "border-[rgba(71,84,103,0.18)] bg-[rgba(71,84,103,0.1)] text-[var(--finance-lock)]",
  lock: "border-[rgba(71,84,103,0.22)] bg-[var(--finance-lock-surface)] text-[var(--finance-lock)]"
};

export function Badge({
  className,
  tone = "slate",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-semibold tracking-[0.01em]",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}
