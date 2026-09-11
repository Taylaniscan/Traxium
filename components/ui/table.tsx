import { cn } from "@/lib/utils";
import type { HTMLAttributes, TableHTMLAttributes, ThHTMLAttributes, TdHTMLAttributes } from "react";

export function Table({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={cn("w-full border-separate border-spacing-0 text-[13px]", className)}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("bg-[var(--surface-elevated)]", className)} {...props} />;
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "border-b border-[var(--border)] transition-colors duration-150 hover:bg-[var(--primary-soft)]",
        className
      )}
      {...props}
    />
  );
}

export function TableHeaderCell({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "border-b border-[var(--border)] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-secondary)] data-[numeric=true]:text-right",
        className
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        "border-b border-[var(--border)] px-4 py-4 align-top text-[var(--foreground)] [font-variant-numeric:tabular-nums] data-[numeric=true]:text-right data-[numeric=true]:text-[var(--text-numeric)]",
        className
      )}
      {...props}
    />
  );
}
