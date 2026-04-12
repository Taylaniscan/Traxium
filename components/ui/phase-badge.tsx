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
    badgeClassName: "border-[#ddd6fe] bg-[#ede9fe] text-[#5b21b6]",
    dotClassName: "bg-[#7c3aed]",
    headerClassName: "border-[#ddd6fe] bg-[#f5f3ff] text-[#5b21b6]",
    countBadgeClassName: "border-[#d8b4fe] bg-[#ede9fe] text-[#5b21b6]",
    chartColor: "#7c3aed",
  },
  VALIDATED: {
    badgeClassName: "border-[#bfdbfe] bg-[#dbeafe] text-[#1e40af]",
    dotClassName: "bg-[#2563eb]",
    headerClassName: "border-[#bfdbfe] bg-[#eff6ff] text-[#1e40af]",
    countBadgeClassName: "border-[#93c5fd] bg-[#dbeafe] text-[#1e40af]",
    chartColor: "#2563eb",
  },
  REALISED: {
    badgeClassName: "border-[#fde68a] bg-[#fef3c7] text-[#92400e]",
    dotClassName: "bg-[#d97706]",
    headerClassName: "border-[#fde68a] bg-[#fffbeb] text-[#92400e]",
    countBadgeClassName: "border-[#fcd34d] bg-[#fef3c7] text-[#92400e]",
    chartColor: "#d97706",
  },
  ACHIEVED: {
    badgeClassName: "border-[#a7f3d0] bg-[#d1fae5] text-[#064e3b]",
    dotClassName: "bg-[#059669]",
    headerClassName: "border-[#a7f3d0] bg-[#ecfdf5] text-[#064e3b]",
    countBadgeClassName: "border-[#6ee7b7] bg-[#d1fae5] text-[#064e3b]",
    chartColor: "#059669",
  },
  CANCELLED: {
    badgeClassName: "border-[#e5e7eb] bg-[#f3f4f6] text-[#6b7280]",
    dotClassName: "bg-[#9ca3af]",
    headerClassName: "border-[#e5e7eb] bg-[#f9fafb] text-[#6b7280]",
    countBadgeClassName: "border-[#d1d5db] bg-[#f3f4f6] text-[#6b7280]",
    chartColor: "#9ca3af",
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
        "border px-2.5 py-1 text-[11px] font-semibold",
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
