import type { Phase } from "@prisma/client";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type PhaseVisual = {
  badgeClassName: string;
  dotClassName: string;
  headerClassName: string;
  countBadgeClassName: string;
  chartColor: string;
};

export const phaseVisuals: Record<Phase, PhaseVisual> = {
  IDEA: {
    badgeClassName: "border-[var(--border)] bg-[rgba(91,102,117,0.08)] text-[var(--text-secondary)]",
    dotClassName: "bg-[#667085]",
    headerClassName: "border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-secondary)]",
    countBadgeClassName: "border-[var(--border)] bg-[rgba(91,102,117,0.08)] text-[var(--text-secondary)]",
    chartColor: "#667085",
  },
  VALIDATED: {
    badgeClassName: "border-[rgba(53,93,122,0.18)] bg-[rgba(53,93,122,0.1)] text-[var(--info-forecast)]",
    dotClassName: "bg-[#355d7a]",
    headerClassName: "border-[rgba(53,93,122,0.18)] bg-[var(--info-forecast-surface)] text-[var(--info-forecast)]",
    countBadgeClassName: "border-[rgba(53,93,122,0.18)] bg-[rgba(53,93,122,0.1)] text-[var(--info-forecast)]",
    chartColor: "#355d7a",
  },
  REALISED: {
    badgeClassName: "border-[rgba(139,94,21,0.18)] bg-[rgba(139,94,21,0.1)] text-[var(--warning)]",
    dotClassName: "bg-[#8b5e15]",
    headerClassName: "border-[rgba(139,94,21,0.18)] bg-[var(--warning-surface)] text-[var(--warning)]",
    countBadgeClassName: "border-[rgba(139,94,21,0.18)] bg-[rgba(139,94,21,0.1)] text-[var(--warning)]",
    chartColor: "#8b5e15",
  },
  ACHIEVED: {
    badgeClassName: "border-[rgba(31,107,77,0.18)] bg-[rgba(31,107,77,0.1)] text-[var(--success)]",
    dotClassName: "bg-[#1f6b4d]",
    headerClassName: "border-[rgba(31,107,77,0.18)] bg-[var(--success-surface)] text-[var(--success)]",
    countBadgeClassName: "border-[rgba(31,107,77,0.18)] bg-[rgba(31,107,77,0.1)] text-[var(--success)]",
    chartColor: "#1f6b4d",
  },
  CANCELLED: {
    badgeClassName: "border-[rgba(161,59,45,0.18)] bg-[rgba(161,59,45,0.08)] text-[var(--risk)]",
    dotClassName: "bg-[#a13b2d]",
    headerClassName: "border-[rgba(161,59,45,0.18)] bg-[var(--risk-surface)] text-[var(--risk)]",
    countBadgeClassName: "border-[rgba(161,59,45,0.18)] bg-[rgba(161,59,45,0.08)] text-[var(--risk)]",
    chartColor: "#a13b2d",
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
        "rounded-full px-2.5 py-1 text-[11px] font-semibold",
        phaseVisuals[phase].badgeClassName,
        className
      )}
    >
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
