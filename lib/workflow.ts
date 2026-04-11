import { Phase, Role } from "@prisma/client";

type WorkflowPhaseRule = {
  allowedPreviousPhases: readonly Phase[];
  requiredApproverRoles: readonly Role[];
  requiresCancellationReason: boolean;
  financeLockAllowed: boolean;
};

export const INITIAL_WORKFLOW_PHASE = Phase.IDEA;

export const WORKFLOW_PHASE_RULES: Record<Phase, WorkflowPhaseRule> = {
  [Phase.IDEA]: {
    allowedPreviousPhases: [],
    requiredApproverRoles: [Role.HEAD_OF_GLOBAL_PROCUREMENT],
    requiresCancellationReason: false,
    financeLockAllowed: false,
  },
  [Phase.VALIDATED]: {
    allowedPreviousPhases: [Phase.IDEA],
    requiredApproverRoles: [
      Role.HEAD_OF_GLOBAL_PROCUREMENT,
      Role.FINANCIAL_CONTROLLER,
    ],
    requiresCancellationReason: false,
    financeLockAllowed: true,
  },
  [Phase.REALISED]: {
    allowedPreviousPhases: [Phase.VALIDATED],
    requiredApproverRoles: [Role.FINANCIAL_CONTROLLER],
    requiresCancellationReason: false,
    financeLockAllowed: false,
  },
  [Phase.ACHIEVED]: {
    allowedPreviousPhases: [Phase.REALISED],
    requiredApproverRoles: [Role.FINANCIAL_CONTROLLER],
    requiresCancellationReason: false,
    financeLockAllowed: false,
  },
  [Phase.CANCELLED]: {
    allowedPreviousPhases: [
      Phase.IDEA,
      Phase.VALIDATED,
      Phase.REALISED,
      Phase.ACHIEVED,
    ],
    requiredApproverRoles: [
      Role.HEAD_OF_GLOBAL_PROCUREMENT,
      Role.FINANCIAL_CONTROLLER,
    ],
    requiresCancellationReason: true,
    financeLockAllowed: false,
  },
};

export function getAllowedPhaseTransitions(currentPhase: Phase): Phase[] {
  return (Object.entries(WORKFLOW_PHASE_RULES) as Array<[Phase, WorkflowPhaseRule]>)
    .filter(([, rule]) => rule.allowedPreviousPhases.includes(currentPhase))
    .map(([phase]) => phase);
}

export function isInitialWorkflowPhase(phase: Phase): boolean {
  return phase === INITIAL_WORKFLOW_PHASE;
}

export function isPhaseTransitionAllowed(
  currentPhase: Phase,
  requestedPhase: Phase
): boolean {
  return WORKFLOW_PHASE_RULES[requestedPhase].allowedPreviousPhases.includes(
    currentPhase
  );
}

export function requiredRolesForWorkflowPhase(phase: Phase): Role[] {
  return [...WORKFLOW_PHASE_RULES[phase].requiredApproverRoles];
}

export function phaseRequiresCancellationReason(phase: Phase): boolean {
  return WORKFLOW_PHASE_RULES[phase].requiresCancellationReason;
}

export function canFinanceLockWorkflowPhase(phase: Phase): boolean {
  return WORKFLOW_PHASE_RULES[phase].financeLockAllowed;
}
