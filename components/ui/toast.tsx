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
      ? "border-l-[var(--success-solid)] text-[var(--success)]"
      : tone === "warning"
        ? "border-l-[var(--warning-solid)] text-[var(--warning)]"
        : "border-l-[var(--risk-solid)] text-[var(--risk)]";

  return (
    <div
      role="status"
      aria-live="polite"
      onAnimationEnd={onDone}
      style={{ animation: "toast-fade 3s ease forwards" }}
      className={cn(
        "fixed bottom-4 right-4 z-50 flex min-w-[280px] max-w-[420px] items-start gap-3 rounded-lg border border-[var(--border)] border-l-4 bg-[var(--surface)] px-4 py-3 opacity-0 shadow-[var(--shadow-pop)]",
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
