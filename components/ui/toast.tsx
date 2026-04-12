"use client";

import { cn } from "@/lib/utils";

export function Toast({
  message,
  tone,
  onDone,
}: {
  message: string;
  tone: "success" | "error";
  onDone?: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      onAnimationEnd={onDone}
      style={{ animation: "toast-fade 3s ease forwards" }}
      className={cn(
        "fixed bottom-4 right-4 z-50 flex items-start gap-3 rounded-xl border px-4 py-3 opacity-0 shadow-lg",
        tone === "success"
          ? "border-[#6ee7b7] bg-[#d1fae5] text-[#064e3b]"
          : "border-[#fca5a5] bg-[#fee2e2] text-[#7f1d1d]"
      )}
    >
      <span className="mt-0.5 text-sm font-semibold" aria-hidden="true">
        {tone === "success" ? "✓" : "✗"}
      </span>
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
}
