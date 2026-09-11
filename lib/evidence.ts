import { Phase } from "@prisma/client";

export const financeEvidenceReviewPhases = [
  Phase.VALIDATED,
  Phase.REALISED,
  Phase.ACHIEVED,
] as const;

export function isFinanceEvidenceReviewPhase(phase: Phase) {
  return financeEvidenceReviewPhases.includes(
    phase as (typeof financeEvidenceReviewPhases)[number]
  );
}

export function getEvidenceStatus(phase: Phase, evidenceCount: number) {
  if (evidenceCount > 0) {
    return "Evidence attached";
  }

  if (phase === Phase.IDEA) {
    return "Evidence recommended";
  }

  if (isFinanceEvidenceReviewPhase(phase)) {
    return "Missing evidence";
  }

  return "No evidence attached";
}
