import { EvidenceType, Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

function getEvidenceField(name: string) {
  const model = Prisma.dmmf.datamodel.models.find(
    (candidate) => candidate.name === "SavingCardEvidence"
  );
  const field = model?.fields.find((candidate) => candidate.name === name);

  if (!field) throw new Error(`SavingCardEvidence.${name} is missing.`);
  return field;
}

describe("evidence metadata schema", () => {
  it("adds optional metadata without breaking existing uploads", () => {
    expect(getEvidenceField("evidenceType")).toMatchObject({
      kind: "enum",
      type: "EvidenceType",
      isRequired: true,
      default: "OTHER",
    });
    expect(getEvidenceField("sourceDate")).toMatchObject({
      type: "DateTime",
      isRequired: false,
    });
    expect(getEvidenceField("notes")).toMatchObject({
      type: "String",
      isRequired: false,
    });
  });

  it("exposes the supported procurement evidence types", () => {
    expect(Object.values(EvidenceType)).toEqual([
      "SUPPLIER_QUOTE",
      "PRICE_CONFIRMATION",
      "CONTRACT_OR_PO",
      "INVOICE_OR_ACTUAL",
      "CALCULATION_WORKBOOK",
      "TECHNICAL_APPROVAL",
      "CUSTOMER_APPROVAL",
      "REBATE_AGREEMENT",
      "TOLLING_RATE_CARD",
      "NEGOTIATION_SUMMARY",
      "OTHER",
    ]);
  });
});
