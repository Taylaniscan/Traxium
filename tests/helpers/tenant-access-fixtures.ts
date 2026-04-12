import { DEFAULT_ORGANIZATION_ID, DEFAULT_USER_ID } from "./security-fixtures";

export const DEFAULT_TENANT_PERIOD = new Date(Date.UTC(2026, 0, 1));
export const DEFAULT_SIGNED_URL = "https://storage.example.com/signed-url";

export function createScopedSavingCard(
  overrides: Partial<{
    id: string;
    organizationId: string;
    materialId: string;
    supplierId: string | null;
    volumeUnit: string;
    baselinePrice: number;
    newPrice: number;
  }> = {}
) {
  return {
    id: "card-1",
    organizationId: DEFAULT_ORGANIZATION_ID,
    materialId: "material-1",
    supplierId: "supplier-1",
    volumeUnit: "kg",
    baselinePrice: 10,
    newPrice: 8,
    ...overrides,
  };
}

export function createEvidenceStorageRecord(
  overrides: Partial<{
    id: string;
    fileName: string;
    savingCardId: string;
    storageBucket: string;
    storagePath: string;
    uploadedById: string;
  }> = {}
) {
  return {
    id: "evidence-1",
    fileName: "evidence.pdf",
    savingCardId: "card-1",
    storageBucket: "evidence-private",
    storagePath: "organizations/org-1/saving-cards/card-1/evidence/evidence.pdf",
    uploadedById: DEFAULT_USER_ID,
    ...overrides,
  };
}

export function createSignedUrlResult(signedUrl = DEFAULT_SIGNED_URL) {
  return {
    data: { signedUrl },
    error: null,
  };
}
