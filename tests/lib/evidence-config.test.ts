import { EvidenceType } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  allowedEvidenceExtensions,
  allowedEvidenceMimeTypes,
  evidenceTrustCopy,
  evidenceTypeLabels,
  evidenceTypes,
  maxEvidenceFileSizeLabel,
} from "@/lib/evidence-config";

describe("evidence configuration", () => {
  it("centralizes the authoritative file policy and customer labels", () => {
    expect(allowedEvidenceExtensions).toContain(".pdf");
    expect(allowedEvidenceExtensions).toContain(".xlsx");
    expect(allowedEvidenceMimeTypes[".pdf"]).toContain("application/pdf");
    expect(maxEvidenceFileSizeLabel).toBe("25 MB per file");
    expect(evidenceTypes).toEqual(Object.values(EvidenceType));
    expect(evidenceTypeLabels.SUPPLIER_QUOTE).toBe("Supplier Quote");
    expect(evidenceTypeLabels.CONTRACT_OR_PO).toBe(
      "Contract / Purchase Order"
    );
  });

  it("uses private signed-download language without public URL claims", () => {
    const trustCopy = Object.values(evidenceTrustCopy).join(" ");

    expect(trustCopy).toContain("stored privately");
    expect(trustCopy).toContain("short-lived signed links");
    expect(trustCopy).toContain("does not guarantee audited savings");
    expect(trustCopy.toLowerCase()).not.toContain("public url");
  });
});
