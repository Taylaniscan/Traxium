import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

type CardVariant = "default" | "kpi" | "elevated";

const cardVariants: Record<CardVariant, string> = {
  default:
    "border-[var(--border)] bg-[var(--card)] shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
  kpi:
    "border-[rgba(23,33,43,0.08)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(15,23,42,0.03)]",
  elevated:
    "border-[rgba(23,33,43,0.08)] bg-[var(--surface-elevated)] shadow-[0_12px_30px_rgba(15,23,42,0.08)]",
};

export function Card({
  className,
  variant = "default",
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: CardVariant }) {
  return (
    <div
      className={cn(
        "rounded-lg border text-[var(--card-foreground)]",
        cardVariants[variant],
        className
      )}
      data-card-variant={variant}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 border-b border-[var(--border)] px-5 py-4",
        className
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "text-[1.05rem] font-semibold tracking-[-0.015em] text-[var(--foreground)]",
        className
      )}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-sm leading-6 text-[var(--muted-foreground)]", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-5", className)} {...props} />;
}
