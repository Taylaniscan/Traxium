import { describe, expect, it } from "vitest";

import {
  formatPhaseReferencesForDisplay,
  phaseLabels,
  roleLabels,
} from "@/lib/constants";

describe("customer-facing terminology constants", () => {
  it("maps internal phase enums to US buyer-facing labels", () => {
    expect(phaseLabels.IDEA).toBe("Proposed");
    expect(phaseLabels.VALIDATED).toBe("Finance Validated");
    expect(phaseLabels.REALISED).toBe("Implemented");
    expect(phaseLabels.ACHIEVED).toBe("Captured");
    expect(phaseLabels.CANCELLED).toBe("Canceled");
  });

  it("maps internal role enums to SME-friendly labels", () => {
    expect(roleLabels.HEAD_OF_GLOBAL_PROCUREMENT).toBe("Procurement Lead");
    expect(roleLabels.GLOBAL_CATEGORY_LEADER).toBe("Category Owner");
    expect(roleLabels.FINANCIAL_CONTROLLER).toBe("Finance Reviewer");
  });

  it("normalizes technical and legacy phase references in buyer-facing detail", () => {
    expect(
      formatPhaseReferencesForDisplay(
        "Moved from VALIDATED to REALISED, then CANCELLED."
      )
    ).toBe("Moved from Finance Validated to Implemented, then Canceled.");
    expect(
      formatPhaseReferencesForDisplay("Approved realised phase; cancelled later.")
    ).toBe("Approved implemented phase; canceled later.");
  });
});
