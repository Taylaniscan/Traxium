import type { Phase } from "@prisma/client";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PhaseBadge } from "@/components/ui/phase-badge";
import { cn } from "@/lib/utils";

type DashboardTone = "neutral" | "info" | "warning" | "implemented" | "success" | "risk";

/*
 * Finance rule: monetary values always sit on white cards. Tone colors the
 * small icon chip (rounded square, soft tint, solid color glyph) and the
 * accent dot — never the background behind the number.
 */
const toneStyles: Record<
  DashboardTone,
  {
    card: string;
    chip: string;
    dot: string;
    accent: string;
    muted: string;
  }
> = {
  neutral: {
    card: "border-[var(--border)] bg-[var(--surface)]",
    chip: "bg-[var(--primary-soft)] text-[var(--primary-action)]",
    dot: "bg-[var(--primary-action)]",
    accent: "text-[var(--foreground)]",
    muted: "text-[var(--muted-foreground)]",
  },
  info: {
    card: "border-[var(--border)] bg-[var(--surface)]",
    chip: "bg-[var(--phase-proposed-soft)] text-[var(--phase-proposed-text)]",
    dot: "bg-[var(--phase-proposed)]",
    accent: "text-[var(--phase-proposed-text)]",
    muted: "text-[var(--text-secondary)]",
  },
  warning: {
    card: "border-[var(--border)] bg-[var(--surface)]",
    chip: "bg-[var(--phase-validated-soft)] text-[var(--phase-validated-text)]",
    dot: "bg-[var(--phase-validated)]",
    accent: "text-[var(--phase-validated-text)]",
    muted: "text-[var(--text-secondary)]",
  },
  implemented: {
    card: "border-[var(--border)] bg-[var(--surface)]",
    chip: "bg-[var(--phase-implemented-soft)] text-[var(--phase-implemented-text)]",
    dot: "bg-[var(--phase-implemented)]",
    accent: "text-[var(--phase-implemented-text)]",
    muted: "text-[var(--text-secondary)]",
  },
  success: {
    card: "border-[var(--border)] bg-[var(--surface)]",
    chip: "bg-[var(--phase-captured-soft)] text-[var(--phase-captured-text)]",
    dot: "bg-[var(--phase-captured)]",
    accent: "text-[var(--phase-captured-text)]",
    muted: "text-[var(--text-secondary)]",
  },
  risk: {
    card: "border-[var(--border)] bg-[var(--surface)]",
    chip: "bg-[var(--phase-canceled-soft)] text-[var(--phase-canceled-text)]",
    dot: "bg-[var(--phase-canceled)]",
    accent: "text-[var(--phase-canceled-text)]",
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
      ? "border-transparent bg-[var(--success-surface)] text-[var(--success)]"
      : tone === "caution"
        ? "border-transparent bg-[var(--warning-surface)] text-[var(--warning)]"
        : tone === "negative"
          ? "border-transparent bg-[var(--risk-surface)] text-[var(--risk)]"
          : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted-foreground)]";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
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
  icon,
  tone = "neutral",
  size = "primary",
  className,
}: {
  label: string;
  value: string;
  description: string;
  delta?: ReactNode;
  icon?: ReactNode;
  tone?: DashboardTone;
  size?: "hero" | "primary" | "secondary";
  className?: string;
}) {
  const styles = toneStyles[tone];

  return (
    <Card variant="kpi" className={cn(styles.card, className)}>
      <CardContent
        className={cn(
          "flex h-full flex-col justify-between gap-4",
          size === "hero"
            ? "min-h-[180px] p-6"
            : size === "primary"
              ? "min-h-[168px] p-5"
              : "min-h-[132px] p-4"
        )}
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className={cn(
                "inline-flex h-7 w-7 items-center justify-center rounded-md [&_svg]:h-4 [&_svg]:w-4",
                styles.chip
              )}
            >
              {icon ?? <span className={cn("h-2 w-2 rounded-full", styles.dot)} />}
            </span>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
              {label}
            </p>
          </div>
          <p
            className={cn(
              "text-numeric font-semibold tracking-[-0.03em]",
              size === "hero"
                ? "text-[2.6rem] leading-none"
                : size === "primary"
                  ? "text-[2rem] leading-none"
                  : "text-[1.4rem] leading-none"
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
