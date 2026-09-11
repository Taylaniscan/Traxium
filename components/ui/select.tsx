import { cn } from "@/lib/utils";
import type { SelectHTMLAttributes } from "react";

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "flex h-10 w-full rounded-md border border-[var(--input)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--foreground)] outline-none transition-[border-color,box-shadow] focus-visible:border-[var(--primary-action)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
        className
      )}
      {...props}
    />
  );
}
