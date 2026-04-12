import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function SectionHeading({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 md:flex-row md:items-start md:justify-between",
        className
      )}
    >
      <div className="space-y-1">
        <h1 className="text-[1.75rem] font-semibold tracking-[-0.03em] text-[var(--foreground)]">
          {title}
        </h1>
        {subtitle ? (
          <p className="max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">
            {subtitle}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
