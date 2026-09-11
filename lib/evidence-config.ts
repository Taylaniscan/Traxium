import type { EvidenceType } from "@prisma/client";

export const MAX_EVIDENCE_FILE_SIZE = 25 * 1024 * 1024;
export const allowedEvidenceExtensions = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".xls",
  ".xlsx",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx"
] as const;
export const ALLOWED_EVIDENCE_EXTENSIONS = allowedEvidenceExtensions;

export const allowedEvidenceMimeTypes = {
  ".pdf": ["application/pdf"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".png": ["image/png"],
  ".xls": ["application/vnd.ms-excel", "application/excel", "application/x-excel", "application/x-msexcel"],
  ".xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/zip"],
  ".doc": ["application/msword", "application/doc", "application/vnd.ms-word"],
  ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip"],
  ".ppt": ["application/vnd.ms-powerpoint", "application/mspowerpoint", "application/powerpoint"],
  ".pptx": ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/zip"],
} as const;

export const evidenceTypes = [
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
] as const satisfies readonly EvidenceType[];

export const evidenceTypeLabels: Record<EvidenceType, string> = {
  SUPPLIER_QUOTE: "Supplier Quote",
  PRICE_CONFIRMATION: "Price Confirmation",
  CONTRACT_OR_PO: "Contract / Purchase Order",
  INVOICE_OR_ACTUAL: "Invoice / Actual Proof",
  CALCULATION_WORKBOOK: "Calculation Workbook",
  TECHNICAL_APPROVAL: "Technical Approval",
  CUSTOMER_APPROVAL: "Customer Approval",
  REBATE_AGREEMENT: "Rebate Agreement",
  TOLLING_RATE_CARD: "Tolling Rate Card",
  NEGOTIATION_SUMMARY: "Negotiation Summary",
  OTHER: "Other",
};

export const evidenceTypeDescriptions: Record<EvidenceType, string> = {
  SUPPLIER_QUOTE: "Supplier bid or RFQ response supporting the proposed price.",
  PRICE_CONFIRMATION: "Written supplier confirmation of the agreed commercial price.",
  CONTRACT_OR_PO: "Contract or purchase order supporting baseline or implemented terms.",
  INVOICE_OR_ACTUAL: "Invoice or actual purchase proof supporting captured value.",
  CALCULATION_WORKBOOK: "Calculation bridge showing assumptions, volume, and savings logic.",
  TECHNICAL_APPROVAL: "Qualification or engineering approval supporting implementation.",
  CUSTOMER_APPROVAL: "Customer approval supporting a specification or commercial change.",
  REBATE_AGREEMENT: "Agreement defining rebate or credit terms.",
  TOLLING_RATE_CARD: "Approved tolling or subcontract processing rate schedule.",
  NEGOTIATION_SUMMARY: "Procurement record of the negotiation and final commercial outcome.",
  OTHER: "Other relevant support for finance or procurement review.",
};

export const maxEvidenceFileSizeLabel = "25 MB per file";

export const evidenceTrustCopy = {
  privateStorage:
    "Files are stored privately and downloaded through Traxium using short-lived signed links.",
  financePurpose:
    "Evidence supports finance validation of assumptions and delivery; it does not guarantee audited savings or accounting recognition.",
  addAfterSave:
    "Create the saving card first, then add evidence before finance validation.",
} as const;

export function isAllowedEvidenceFileName(fileName: string) {
  const extension = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  return allowedEvidenceExtensions.includes(extension as (typeof allowedEvidenceExtensions)[number]);
}

export function formatEvidenceFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
