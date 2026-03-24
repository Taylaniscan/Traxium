import { Currency } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_ORGANIZATION_ID,
  DEFAULT_USER_ID,
  OTHER_ORGANIZATION_ID,
} from "../helpers/security-fixtures";

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import {
  deleteAlternativeMaterial,
  deleteAlternativeSupplier,
  setFinanceLock,
  updateAlternativeMaterial,
  updateAlternativeSupplier,
} from "@/lib/data";

function createAlternativeSupplierInput(overrides?: Partial<Record<string, unknown>>) {
  return {
    supplier: { name: "Supplier B" },
    country: "DE",
    quotedPrice: 7.5,
    currency: Currency.EUR,
    leadTimeDays: 14,
    moq: 100,
    paymentTerms: "60 days",
    qualityRating: "AA",
    riskLevel: "Medium",
    notes: "Qualified backup supplier",
    isSelected: false,
    ...overrides,
  };
}

function createAlternativeMaterialInput(overrides?: Partial<Record<string, unknown>>) {
  return {
    material: { name: "Recycled PET" },
    supplier: { name: "Supplier B" },
    specification: "Food grade",
    quotedPrice: 6.25,
    currency: Currency.EUR,
    performanceImpact: "Neutral",
    qualificationStatus: "Approved",
    riskLevel: "Low",
    notes: "Validated material option",
    isSelected: false,
    ...overrides,
  };
}

function createTenantScopeTransactionMock() {
  return {
    supplier: {
      findUnique: vi.fn().mockResolvedValue({ id: "supplier-2", name: "Supplier B" }),
      create: vi.fn(),
    },
    material: {
      findUnique: vi.fn().mockResolvedValue({ id: "material-2", name: "Recycled PET" }),
      create: vi.fn(),
    },
    savingCard: {
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({
        id: "card-1",
        organizationId: DEFAULT_ORGANIZATION_ID,
        financeLocked: true,
      }),
    },
    savingCardAlternativeSupplier: {
      findFirst: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      update: vi.fn().mockResolvedValue({
        id: "alt-supplier-1",
        savingCardId: "card-1",
        supplierId: "supplier-2",
      }),
      delete: vi.fn().mockResolvedValue({ id: "alt-supplier-1" }),
    },
    savingCardAlternativeMaterial: {
      findFirst: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      update: vi.fn().mockResolvedValue({
        id: "alt-material-1",
        savingCardId: "card-1",
        materialId: "material-2",
        supplierId: "supplier-2",
      }),
      delete: vi.fn().mockResolvedValue({ id: "alt-material-1" }),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "audit-1" }),
    },
  };
}

describe("tenant-scoped mutations", () => {
  let tx: ReturnType<typeof createTenantScopeTransactionMock>;

  beforeEach(() => {
    tx = createTenantScopeTransactionMock();
    mockPrisma.$transaction.mockImplementation(async (callback: unknown) => {
      if (typeof callback !== "function") {
        throw new Error("Expected a transaction callback.");
      }

      const transactionCallback = callback as (client: typeof tx) => Promise<unknown>;
      return transactionCallback(tx);
    });
  });

  it("blocks cross-tenant alternative supplier updates", async () => {
    tx.savingCardAlternativeSupplier.findFirst.mockResolvedValueOnce(null);

    await expect(
      updateAlternativeSupplier(
        "alt-supplier-1",
        createAlternativeSupplierInput(),
        DEFAULT_USER_ID,
        OTHER_ORGANIZATION_ID
      )
    ).rejects.toThrow("Alternative supplier not found.");

    expect(tx.savingCardAlternativeSupplier.findFirst).toHaveBeenCalledWith({
      where: {
        id: "alt-supplier-1",
        savingCard: {
          is: {
            organizationId: OTHER_ORGANIZATION_ID,
          },
        },
      },
    });
    expect(tx.savingCardAlternativeSupplier.update).not.toHaveBeenCalled();
  });

  it("blocks cross-tenant alternative supplier deletes", async () => {
    tx.savingCardAlternativeSupplier.findFirst.mockResolvedValueOnce(null);

    await expect(deleteAlternativeSupplier("alt-supplier-1", OTHER_ORGANIZATION_ID)).rejects.toThrow(
      "Alternative supplier not found."
    );

    expect(tx.savingCardAlternativeSupplier.findFirst).toHaveBeenCalledWith({
      where: {
        id: "alt-supplier-1",
        savingCard: {
          is: {
            organizationId: OTHER_ORGANIZATION_ID,
          },
        },
      },
    });
    expect(tx.savingCardAlternativeSupplier.delete).not.toHaveBeenCalled();
  });

  it("allows same-tenant alternative supplier updates", async () => {
    tx.savingCardAlternativeSupplier.findFirst.mockResolvedValueOnce({
      id: "alt-supplier-1",
      savingCardId: "card-1",
      supplierId: "supplier-1",
    });

    const result = await updateAlternativeSupplier(
      "alt-supplier-1",
      createAlternativeSupplierInput(),
      DEFAULT_USER_ID,
      DEFAULT_ORGANIZATION_ID
    );

    expect(tx.supplier.findUnique).toHaveBeenCalledWith({
      where: {
        organizationId_name: {
          organizationId: DEFAULT_ORGANIZATION_ID,
          name: "Supplier B",
        },
      },
    });
    expect(tx.savingCardAlternativeSupplier.update).toHaveBeenCalledWith({
      where: { id: "alt-supplier-1" },
      data: {
        supplierId: "supplier-2",
        supplierNameManual: null,
        country: "DE",
        quotedPrice: 7.5,
        currency: Currency.EUR,
        leadTimeDays: 14,
        moq: 100,
        paymentTerms: "60 days",
        qualityRating: "AA",
        riskLevel: "Medium",
        notes: "Qualified backup supplier",
        isSelected: false,
      },
      include: { supplier: true },
    });
    expect(result).toEqual({
      id: "alt-supplier-1",
      savingCardId: "card-1",
      supplierId: "supplier-2",
    });
  });

  it("allows same-tenant alternative supplier deletes", async () => {
    tx.savingCardAlternativeSupplier.findFirst.mockResolvedValueOnce({
      id: "alt-supplier-1",
      savingCardId: "card-1",
    });

    const result = await deleteAlternativeSupplier("alt-supplier-1", DEFAULT_ORGANIZATION_ID);

    expect(tx.savingCardAlternativeSupplier.delete).toHaveBeenCalledWith({
      where: { id: "alt-supplier-1" },
    });
    expect(result).toEqual({ id: "alt-supplier-1" });
  });

  it("blocks cross-tenant alternative material updates", async () => {
    tx.savingCardAlternativeMaterial.findFirst.mockResolvedValueOnce(null);

    await expect(
      updateAlternativeMaterial(
        "alt-material-1",
        createAlternativeMaterialInput(),
        DEFAULT_USER_ID,
        OTHER_ORGANIZATION_ID
      )
    ).rejects.toThrow("Alternative material not found.");

    expect(tx.savingCardAlternativeMaterial.findFirst).toHaveBeenCalledWith({
      where: {
        id: "alt-material-1",
        savingCard: {
          is: {
            organizationId: OTHER_ORGANIZATION_ID,
          },
        },
      },
    });
    expect(tx.savingCardAlternativeMaterial.update).not.toHaveBeenCalled();
  });

  it("blocks cross-tenant alternative material deletes", async () => {
    tx.savingCardAlternativeMaterial.findFirst.mockResolvedValueOnce(null);

    await expect(deleteAlternativeMaterial("alt-material-1", OTHER_ORGANIZATION_ID)).rejects.toThrow(
      "Alternative material not found."
    );

    expect(tx.savingCardAlternativeMaterial.findFirst).toHaveBeenCalledWith({
      where: {
        id: "alt-material-1",
        savingCard: {
          is: {
            organizationId: OTHER_ORGANIZATION_ID,
          },
        },
      },
    });
    expect(tx.savingCardAlternativeMaterial.delete).not.toHaveBeenCalled();
  });

  it("allows same-tenant alternative material updates", async () => {
    tx.savingCardAlternativeMaterial.findFirst.mockResolvedValueOnce({
      id: "alt-material-1",
      savingCardId: "card-1",
      materialId: "material-1",
      supplierId: "supplier-1",
    });

    const result = await updateAlternativeMaterial(
      "alt-material-1",
      createAlternativeMaterialInput(),
      DEFAULT_USER_ID,
      DEFAULT_ORGANIZATION_ID
    );

    expect(tx.material.findUnique).toHaveBeenCalledWith({
      where: {
        organizationId_name: {
          organizationId: DEFAULT_ORGANIZATION_ID,
          name: "Recycled PET",
        },
      },
    });
    expect(tx.supplier.findUnique).toHaveBeenCalledWith({
      where: {
        organizationId_name: {
          organizationId: DEFAULT_ORGANIZATION_ID,
          name: "Supplier B",
        },
      },
    });
    expect(tx.savingCardAlternativeMaterial.update).toHaveBeenCalledWith({
      where: { id: "alt-material-1" },
      data: {
        materialId: "material-2",
        materialNameManual: null,
        supplierId: "supplier-2",
        supplierNameManual: null,
        specification: "Food grade",
        quotedPrice: 6.25,
        currency: Currency.EUR,
        performanceImpact: "Neutral",
        qualificationStatus: "Approved",
        riskLevel: "Low",
        notes: "Validated material option",
        isSelected: false,
      },
      include: { material: true, supplier: true },
    });
    expect(result).toEqual({
      id: "alt-material-1",
      savingCardId: "card-1",
      materialId: "material-2",
      supplierId: "supplier-2",
    });
  });

  it("allows same-tenant alternative material deletes", async () => {
    tx.savingCardAlternativeMaterial.findFirst.mockResolvedValueOnce({
      id: "alt-material-1",
      savingCardId: "card-1",
    });

    const result = await deleteAlternativeMaterial("alt-material-1", DEFAULT_ORGANIZATION_ID);

    expect(tx.savingCardAlternativeMaterial.delete).toHaveBeenCalledWith({
      where: { id: "alt-material-1" },
    });
    expect(result).toEqual({ id: "alt-material-1" });
  });

  it("blocks cross-tenant finance lock changes", async () => {
    tx.savingCard.findFirst.mockResolvedValueOnce(null);

    await expect(
      setFinanceLock("card-1", DEFAULT_USER_ID, true, OTHER_ORGANIZATION_ID)
    ).rejects.toThrow(
      "Saving card not found."
    );

    expect(tx.savingCard.findFirst).toHaveBeenCalledWith({
      where: {
        id: "card-1",
        organizationId: OTHER_ORGANIZATION_ID,
      },
    });
    expect(tx.savingCard.update).not.toHaveBeenCalled();
  });

  it("allows same-tenant finance lock changes", async () => {
    tx.savingCard.findFirst.mockResolvedValueOnce({
      id: "card-1",
      organizationId: DEFAULT_ORGANIZATION_ID,
    });

    const result = await setFinanceLock(
      "card-1",
      DEFAULT_USER_ID,
      true,
      DEFAULT_ORGANIZATION_ID
    );

    expect(tx.savingCard.update).toHaveBeenCalledWith({
      where: { id: "card-1" },
      data: { financeLocked: true },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: DEFAULT_USER_ID,
        savingCardId: "card-1",
        action: "finance.locked",
        detail: "Finance lock enabled",
      },
    });
    expect(result).toEqual({
      id: "card-1",
      organizationId: DEFAULT_ORGANIZATION_ID,
      financeLocked: true,
    });
  });
});
