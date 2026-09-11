import { Phase, Role } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  canFinanceLockWorkflowPhase,
  getAllowedPhaseTransitions,
  INITIAL_WORKFLOW_PHASE,
  isPhaseTransitionAllowed,
  phaseRequiresCancellationReason,
  requiredRolesForWorkflowPhase,
} from "@/lib/workflow";
import { isLockedField } from "@/lib/permissions";

describe("workflow definition", () => {
  it("defines the canonical initial phase and sequential transitions", () => {
    expect(INITIAL_WORKFLOW_PHASE).toBe(Phase.IDEA);
    expect(getAllowedPhaseTransitions(Phase.IDEA)).toEqual([
      Phase.VALIDATED,
      Phase.CANCELLED,
    ]);
    expect(getAllowedPhaseTransitions(Phase.VALIDATED)).toEqual([
      Phase.REALISED,
      Phase.CANCELLED,
    ]);
    expect(getAllowedPhaseTransitions(Phase.REALISED)).toEqual([
      Phase.ACHIEVED,
      Phase.CANCELLED,
    ]);
    expect(getAllowedPhaseTransitions(Phase.ACHIEVED)).toEqual([
      Phase.CANCELLED,
    ]);
    expect(getAllowedPhaseTransitions(Phase.CANCELLED)).toEqual([]);
  });

  it("rejects skipped transitions", () => {
    expect(isPhaseTransitionAllowed(Phase.IDEA, Phase.REALISED)).toBe(false);
    expect(isPhaseTransitionAllowed(Phase.IDEA, Phase.ACHIEVED)).toBe(false);
    expect(isPhaseTransitionAllowed(Phase.VALIDATED, Phase.ACHIEVED)).toBe(false);
    expect(isPhaseTransitionAllowed(Phase.REALISED, Phase.VALIDATED)).toBe(false);
  });

  it("maps approver roles to the documented target phases", () => {
    expect(requiredRolesForWorkflowPhase(Phase.IDEA)).toEqual([
      Role.HEAD_OF_GLOBAL_PROCUREMENT,
    ]);
    expect(requiredRolesForWorkflowPhase(Phase.VALIDATED)).toEqual([
      Role.HEAD_OF_GLOBAL_PROCUREMENT,
      Role.FINANCIAL_CONTROLLER,
    ]);
    expect(requiredRolesForWorkflowPhase(Phase.REALISED)).toEqual([
      Role.FINANCIAL_CONTROLLER,
    ]);
    expect(requiredRolesForWorkflowPhase(Phase.ACHIEVED)).toEqual([
      Role.FINANCIAL_CONTROLLER,
    ]);
    expect(requiredRolesForWorkflowPhase(Phase.CANCELLED)).toEqual([
      Role.HEAD_OF_GLOBAL_PROCUREMENT,
      Role.FINANCIAL_CONTROLLER,
    ]);
  });

  it("marks cancellation and finance lock rules canonically", () => {
    expect(phaseRequiresCancellationReason(Phase.CANCELLED)).toBe(true);
    expect(phaseRequiresCancellationReason(Phase.VALIDATED)).toBe(false);
    expect(canFinanceLockWorkflowPhase(Phase.VALIDATED)).toBe(true);
    expect(canFinanceLockWorkflowPhase(Phase.IDEA)).toBe(false);
    expect(canFinanceLockWorkflowPhase(Phase.REALISED)).toBe(false);
    expect(canFinanceLockWorkflowPhase(Phase.ACHIEVED)).toBe(false);
    expect(canFinanceLockWorkflowPhase(Phase.CANCELLED)).toBe(false);
  });

  it("identifies the finance-controlled saving-card fields", () => {
    expect(isLockedField("baselinePrice")).toBe(true);
    expect(isLockedField("newPrice")).toBe(true);
    expect(isLockedField("annualVolume")).toBe(true);
    expect(isLockedField("currency")).toBe(true);
    expect(isLockedField("fxRate")).toBe(true);
    expect(isLockedField("calculatedSavings")).toBe(true);
    expect(isLockedField("calculatedSavingsUSD")).toBe(true);
    expect(isLockedField("impactStartDate")).toBe(true);
    expect(isLockedField("impactEndDate")).toBe(true);
    expect(isLockedField("title")).toBe(false);
  });
});
