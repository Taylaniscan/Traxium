import type { Phase } from "@prisma/client";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type PhaseVisual = {
  badgeClassName: string;
  dotClassName: string;
  headerClassName: string;
  countBadgeClassName: string;
  columnAccentClassName: string;
  rowAccentClassName: string;
  chartColor: string;
};

/**
 * Single source of truth for the five-phase status color language.
 * Every surface that shows a phase (badges, kanban, charts, timeline,
 * table accents, monthly close) consumes these tokens — colors are
 * defined once in app/globals.css.
 */
export const phaseVisuals: Record<Phase, PhaseVisual> = {
  IDEA: {
    badgeClassName:
      "border-transparent bg-[var(--phase-proposed-soft)] text-[var(--phase-proposed-text)]",
    dotClassName: "bg-[var(--phase-proposed)]",
    headerClassName:
      "border-[var(--border)] bg-[var(--phase-proposed-soft)] text-[var(--phase-proposed-text)]",
    countBadgeClassName:
      "border-transparent bg-[var(--phase-proposed-soft)] text-[var(--phase-proposed-text)]",
    columnAccentClassName: "border-t-[3px] border-t-[var(--phase-proposed)]",
    rowAccentClassName: "border-l-[3px] border-l-[var(--phase-proposed)]",
    chartColor: "var(--phase-proposed)",
  },
  VALIDATED: {
    badgeClassName:
      "border-transparent bg-[var(--phase-validated-soft)] text-[var(--phase-validated-text)]",
    dotClassName: "bg-[var(--phase-validated)]",
    headerClassName:
      "border-[var(--border)] bg-[var(--phase-validated-soft)] text-[var(--phase-validated-text)]",
    countBadgeClassName:
      "border-transparent bg-[var(--phase-validated-soft)] text-[var(--phase-validated-text)]",
    columnAccentClassName: "border-t-[3px] border-t-[var(--phase-validated)]",
    rowAccentClassName: "border-l-[3px] border-l-[var(--phase-validated)]",
    chartColor: "var(--phase-validated)",
  },
  REALISED: {
    badgeClassName:
      "border-transparent bg-[var(--phase-implemented-soft)] text-[var(--phase-implemented-text)]",
    dotClassName: "bg-[var(--phase-implemented)]",
    headerClassName:
      "border-[var(--border)] bg-[var(--phase-implemented-soft)] text-[var(--phase-implemented-text)]",
    countBadgeClassName:
      "border-transparent bg-[var(--phase-implemented-soft)] text-[var(--phase-implemented-text)]",
    columnAccentClassName: "border-t-[3px] border-t-[var(--phase-implemented)]",
    rowAccentClassName: "border-l-[3px] border-l-[var(--phase-implemented)]",
    chartColor: "var(--phase-implemented)",
  },
  ACHIEVED: {
    badgeClassName:
      "border-transparent bg-[var(--phase-captured-soft)] text-[var(--phase-captured-text)]",
    dotClassName: "bg-[var(--phase-captured)]",
    headerClassName:
      "border-[var(--border)] bg-[var(--phase-captured-soft)] text-[var(--phase-captured-text)]",
    countBadgeClassName:
      "border-transparent bg-[var(--phase-captured-soft)] text-[var(--phase-captured-text)]",
    columnAccentClassName: "border-t-[3px] border-t-[var(--phase-captured)]",
    rowAccentClassName: "border-l-[3px] border-l-[var(--phase-captured)]",
    chartColor: "var(--phase-captured)",
  },
  CANCELLED: {
    badgeClassName:
      "border-transparent bg-[var(--phase-canceled-soft)] text-[var(--phase-canceled-text)]",
    dotClassName: "bg-[var(--phase-canceled)]",
    headerClassName:
      "border-[var(--border)] bg-[var(--phase-canceled-soft)] text-[var(--phase-canceled-text)]",
    countBadgeClassName:
      "border-transparent bg-[var(--phase-canceled-soft)] text-[var(--phase-canceled-text)]",
    columnAccentClassName: "border-t-[3px] border-t-[var(--phase-canceled)]",
    rowAccentClassName: "border-l-[3px] border-l-[var(--phase-canceled)]",
    chartColor: "var(--phase-canceled)",
  },
};

export function getPhaseVisuals(phase: Phase) {
  return phaseVisuals[phase];
}

export function PhaseBadge({
  phase,
  className,
  children,
}: {
  phase: Phase;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <Badge
      className={cn(
        "gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        phaseVisuals[phase].badgeClassName,
        className
      )}
    >
      <PhaseDot phase={phase} className="h-1.5 w-1.5 shrink-0" />
      {children}
    </Badge>
  );
}

export function PhaseDot({
  phase,
  className,
}: {
  phase: Phase;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex h-2 w-2 rounded-full", phaseVisuals[phase].dotClassName, className)}
    />
  );
}
