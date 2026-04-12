import type { Phase } from "@prisma/client";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PhaseBadge } from "@/components/ui/phase-badge";
import { cn } from "@/lib/utils";

type DashboardTone = "neutral" | "info" | "warning" | "success" | "risk";

const toneStyles: Record<
  DashboardTone,
  {
    card: string;
    accent: string;
    muted: string;
  }
> = {
  neutral: {
    card: "border-[var(--border)] bg-[var(--surface)]",
    accent: "text-[var(--foreground)]",
    muted: "text-[var(--muted-foreground)]",
  },
  info: {
    card: "border-[rgba(53,93,122,0.18)] bg-[var(--info-forecast-surface)]/72",
    accent: "text-[var(--info-forecast)]",
    muted: "text-[var(--text-secondary)]",
  },
  warning: {
    card: "border-[rgba(139,94,21,0.18)] bg-[var(--warning-surface)]/72",
    accent: "text-[var(--warning)]",
    muted: "text-[var(--text-secondary)]",
  },
  success: {
    card: "border-[rgba(31,107,77,0.18)] bg-[var(--success-surface)]/72",
    accent: "text-[var(--success)]",
    muted: "text-[var(--text-secondary)]",
  },
  risk: {
    card: "border-[rgba(161,59,45,0.18)] bg-[var(--risk-surface)]/76",
    accent: "text-[var(--risk)]",
    muted: "text-[var(--text-secondary)]",
  },
};

export function DashboardSection({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h2 className="text-[1.1rem] font-semibold tracking-[-0.02em] text-[var(--foreground)]">
            {title}
          </h2>
          {description ? (
            <p className="max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function MetricDelta({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "caution" | "negative";
}) {
  const styles =
    tone === "positive"
      ? "border-[rgba(31,107,77,0.18)] bg-[rgba(31,107,77,0.08)] text-[var(--success)]"
      : tone === "caution"
        ? "border-[rgba(139,94,21,0.18)] bg-[rgba(139,94,21,0.08)] text-[var(--warning)]"
        : tone === "negative"
          ? "border-[rgba(161,59,45,0.18)] bg-[rgba(161,59,45,0.08)] text-[var(--risk)]"
          : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)]";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-[11px] font-medium",
        styles
      )}
    >
      <span>{value}</span>
      <span className="text-[10px] opacity-80">{label}</span>
    </div>
  );
}

export function KpiCard({
  label,
  value,
  description,
  delta,
  tone = "neutral",
  size = "primary",
  className,
}: {
  label: string;
  value: string;
  description: string;
  delta?: ReactNode;
  tone?: DashboardTone;
  size?: "primary" | "secondary";
  className?: string;
}) {
  const styles = toneStyles[tone];

  return (
    <Card
      variant={size === "primary" ? "elevated" : "kpi"}
      className={cn(styles.card, className)}
    >
      <CardContent
        className={cn(
          "flex h-full flex-col justify-between gap-4",
          size === "primary" ? "min-h-[168px] p-5" : "min-h-[132px] p-4"
        )}
      >
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
            {label}
          </p>
          <p
            className={cn(
              "font-semibold tracking-[-0.03em] text-[var(--foreground)]",
              size === "primary" ? "text-[2rem] leading-none" : "text-[1.4rem] leading-none"
            )}
          >
            {value}
          </p>
        </div>

        <div className="space-y-2">
          {delta ? <div>{delta}</div> : null}
          <p className={cn("text-sm leading-5", styles.muted)}>{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export type DashboardExceptionItem = {
  kind: string;
  tone: "error" | "warn" | "teal";
  title: string;
  detail: string;
  value: string;
  meta: string;
  phase: Phase;
  phaseLabel: string;
};

export function ExceptionList({
  title,
  description,
  items,
  emptyTitle,
  emptyDescription,
}: {
  title: string;
  description: string;
  items: DashboardExceptionItem[];
  emptyTitle: string;
  emptyDescription: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length ? (
          items.map((item) => (
            <div
              key={`${item.kind}-${item.title}-${item.value}`}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-4"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={item.tone}>{item.kind}</Badge>
                    <PhaseBadge phase={item.phase}>{item.phaseLabel}</PhaseBadge>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {item.title}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
                      {item.detail}
                    </p>
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {item.meta}
                  </p>
                </div>
                <div className="rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
                    Value at stake
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                    {item.value}
                  </p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-8 text-center">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {emptyTitle}
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
              {emptyDescription}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
