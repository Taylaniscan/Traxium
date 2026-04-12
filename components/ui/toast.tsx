"use client";

import { cn } from "@/lib/utils";

export function Toast({
  message,
  tone,
  onDone,
}: {
  message: string;
  tone: "success" | "warning" | "error";
  onDone?: () => void;
}) {
  const toneStyles =
    tone === "success"
      ? "border-[rgba(31,107,77,0.18)] bg-[var(--success-surface)] text-[var(--success)]"
      : tone === "warning"
        ? "border-[rgba(139,94,21,0.18)] bg-[var(--warning-surface)] text-[var(--warning)]"
        : "border-[rgba(161,59,45,0.18)] bg-[var(--risk-surface)] text-[var(--risk)]";

  return (
    <div
      role="status"
      aria-live="polite"
      onAnimationEnd={onDone}
      style={{ animation: "toast-fade 3s ease forwards" }}
      className={cn(
        "fixed bottom-4 right-4 z-50 flex min-w-[280px] max-w-[420px] items-start gap-3 rounded-lg border px-4 py-3 opacity-0 shadow-[0_10px_30px_rgba(15,23,42,0.08)]",
        toneStyles
      )}
    >
      <span className="mt-0.5 text-sm font-semibold" aria-hidden="true">
        {tone === "success" ? "✓" : tone === "warning" ? "!" : "✗"}
      </span>
      <span className="text-sm font-medium leading-6">{message}</span>
    </div>
  );
}
