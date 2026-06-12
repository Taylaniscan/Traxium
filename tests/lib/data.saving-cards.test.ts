import { Currency, Phase } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  user: {
    findMany: vi.fn(),
  },
  buyer: {
    findMany: vi.fn(),
  },
  supplier: {
    findMany: vi.fn(),
  },
  material: {
    findMany: vi.fn(),
  },
  category: {
    findMany: vi.fn(),
  },
  plant: {
    findMany: vi.fn(),
  },
  businessUnit: {
    findMany: vi.fn(),
  },
  fxRate: {
    findMany: vi.fn(),
  },
  savingCard: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
  organization: {
    findUnique: vi.fn(),
  },
}));
const invalidateScopedCacheMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/cache", async () => {
  const actual = await vi.importActual<typeof import("@/lib/cache")>("@/lib/cache");

  return {
    ...actual,
    invalidateScopedCache: invalidateScopedCacheMock,
  };
});

import {
  createAlternativeMaterial,
  createAlternativeSupplier,
  createSavingCard,
  getReferenceData,
  getSavingCard,
  getSavingCardDetailReferenceData,
  getSavingCards,
  importSavingCards,
  updateSavingCard,
  WorkflowError,
} from "@/lib/data";

function createSavingCardInput(overrides?: Partial<Record<string, unknown>>) {
  return {
    title: "Resin renegotiation",
    description: "Renegotiate the resin packaging contract for margin improvement.",
    savingType: "PRICE_REDUCTION",
    impactType: "HARD_SAVINGS",
    impactRecurrence: "RECURRING",
    budgetImpact: "BUDGET_IMPACT",
    phase: Phase.IDEA,
    supplier: { name: "Supplier A" },
    material: { name: "PET Resin" },
    alternativeSupplier: {},
    alternativeMaterial: {},
    category: { name: "Packaging" },
    plant: { name: "Amsterdam" },
    businessUnit: { name: "Beverages" },
    buyer: { name: "Strategic Buyer" },
    baselinePrice: 10,
    newPrice: 8,
    annualVolume: 100,
    currency: Currency.EUR,
    fxRate: 1.1,
    frequency: "RECURRING",
    savingDriver: "Negotiation",
    implementationComplexity: "Medium",
    qualificationStatus: "Not Started",
    startDate: new Date("2025-01-01T00:00:00.000Z"),
    endDate: new Date("2025-12-31T00:00:00.000Z"),
    impactStartDate: new Date("2025-02-01T00:00:00.000Z"),
    impactEndDate: new Date("2025-12-31T00:00:00.000Z"),
    cancellationReason: "",
    stakeholderIds: ["stakeholder-1", "stakeholder-2"],
    evidence: [],
    ...overrides,
  };
}

function createSavingCardTransactionMock() {
  return {
    supplier: {
      findUnique: vi.fn().mockResolvedValue({ id: "supplier-1", name: "Supplier A" }),
      create: vi.fn(),
    },
    material: {
      findUnique: vi.fn().mockResolvedValue({ id: "material-1", name: "PET Resin" }),
      create: vi.fn(),
    },
    category: {
      findUnique: vi.fn().mockResolvedValue({ id: "category-1", name: "Packaging" }),
      create: vi.fn(),
    },
    plant: {
      findUnique: vi.fn().mockResolvedValue({ id: "plant-1", name: "Amsterdam" }),
      create: vi.fn(),
    },
    businessUnit: {
      findUnique: vi.fn().mockResolvedValue({ id: "business-unit-1", name: "Beverages" }),
      create: vi.fn(),
    },
    buyer: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue({ id: "buyer-1", name: "Strategic Buyer" }),
      create: vi.fn(),
    },
    savingCard: {
      create: vi.fn().mockResolvedValue({ id: "card-1", title: "Resin renegotiation", phase: Phase.IDEA }),
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({ id: "card-1", title: "Updated card", phase: Phase.VALIDATED }),
    },
    savingCardStakeholder: {
      deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
      createMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
    phaseHistory: {
      create: vi.fn().mockResolvedValue({ id: "history-1" }),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "audit-1" }),
    },
    user: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    notification: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
}

describe("lib/data saving card flows", () => {
  let tx: ReturnType<typeof createSavingCardTransactionMock>;

  beforeEach(() => {
    invalidateScopedCacheMock.mockReset();
    mockPrisma.$transaction.mockClear();
    mockPrisma.organization.findUnique.mockReset();
    mockPrisma.organization.findUnique.mockResolvedValue({
      fiscalYearStartMonth: 1,
      defaultCurrency: Currency.USD,
      multiCurrencyEnabled: true,
    });
    tx = createSavingCardTransactionMock();
    mockPrisma.$transaction.mockImplementation(async (callback: unknown) => {
      if (Array.isArray(callback)) {
        return Promise.all(callback);
      }

      if (typeof callback !== "function") {
        throw new Error("Expected a transaction callback.");
      }

      const transactionCallback = callback as (client: typeof tx) => Promise<unknown>;
      return transactionCallback(tx);
    });
  });

  it("loads reference data through one batch transaction", async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: "user-1" }]);
    mockPrisma.buyer.findMany.mockResolvedValue([{ id: "buyer-1" }]);
    mockPrisma.supplier.findMany.mockResolvedValue([{ id: "supplier-1" }]);
    mockPrisma.material.findMany.mockResolvedValue([{ id: "material-1" }]);
    mockPrisma.category.findMany.mockResolvedValue([{ id: "category-1" }]);
    mockPrisma.plant.findMany.mockResolvedValue([{ id: "plant-1" }]);
    mockPrisma.businessUnit.findMany.mockResolvedValue([{ id: "business-unit-1" }]);
    mockPrisma.fxRate.findMany.mockResolvedValue([{ id: "fx-rate-1" }]);

    await expect(getReferenceData("org-1")).resolves.toEqual({
      users: [{ id: "user-1" }],
      buyers: [{ id: "buyer-1" }],
      suppliers: [{ id: "supplier-1" }],
      materials: [{ id: "material-1" }],
      categories: [{ id: "category-1" }],
      plants: [{ id: "plant-1" }],
      businessUnits: [{ id: "business-unit-1" }],
      fxRates: [{ id: "fx-rate-1" }],
    });

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.$transaction).toHaveBeenCalledWith([
      expect.any(Promise),
      expect.any(Promise),
      expect.any(Promise),
      expect.any(Promise),
      expect.any(Promise),
      expect.any(Promise),
      expect.any(Promise),
      expect.any(Promise),
    ]);
  });

  it("loads only supplier and material choices for the detail workspace", async () => {
    mockPrisma.supplier.findMany.mockResolvedValue([{ id: "supplier-1" }]);
    mockPrisma.material.findMany.mockResolvedValue([{ id: "material-1" }]);

    await expect(getSavingCardDetailReferenceData("org-1")).resolves.toEqual({
      suppliers: [{ id: "supplier-1" }],
      materials: [{ id: "material-1" }],
    });

    expect(mockPrisma.supplier.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.material.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.buyer.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.category.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.plant.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.businessUnit.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.fxRate.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("creates a saving card with Buyer master data and calculated savings", async () => {
    const payload = createSavingCardInput();

    const result = await createSavingCard(payload, "actor-1", "org-1");

    expect(tx.buyer.findUnique).toHaveBeenCalledWith({
      where: {
        organizationId_name: {
          organizationId: "org-1",
          name: "Strategic Buyer",
        },
      },
    });
    expect(tx.savingCard.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: "org-1",
          buyerId: "buyer-1",
          baselinePrice: 10,
          newPrice: 8,
          annualVolume: 100,
          calculatedSavings: 200,
          calculatedSavingsUSD: 220.00000000000003,
          stakeholders: {
            create: [{ userId: "stakeholder-1" }, { userId: "stakeholder-2" }],
          },
        }),
      })
    );
    expect(tx.user.findUnique).not.toHaveBeenCalled();
    expect(tx.user.create).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      {
        maxWait: 10_000,
        timeout: 30_000,
      }
    );
    expect(result).toEqual({ id: "card-1", title: "Resin renegotiation", phase: Phase.IDEA });
    expect(invalidateScopedCacheMock).toHaveBeenCalledWith({
      namespace: "dashboard-data",
      organizationId: "org-1",
    });
    expect(invalidateScopedCacheMock).toHaveBeenCalledWith({
      namespace: "workspace-readiness",
      organizationId: "org-1",
    });
  });

  it("forces USD and a unit fx rate when the workspace is single-currency, ignoring the client payload", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      fiscalYearStartMonth: 1,
      defaultCurrency: Currency.USD,
      multiCurrencyEnabled: false,
    });

    await createSavingCard(
      createSavingCardInput({ currency: Currency.EUR, fxRate: 1.1 }),
      "actor-1",
      "org-1"
    );

    expect(tx.savingCard.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currency: Currency.USD,
          fxRate: 1,
          // (10 - 8) * 100 in USD, no fx applied
          calculatedSavings: 200,
          calculatedSavingsUSD: 200,
        }),
      })
    );
  });

  it("rejects non-positive commercial assumptions before creating a saving card", async () => {
    await expect(
      createSavingCard(
        createSavingCardInput({
          annualVolume: 0,
        }),
        "actor-1",
        "org-1"
      )
    ).rejects.toThrow("Annual volume must be greater than zero.");

    expect(tx.savingCard.create).not.toHaveBeenCalled();
    expect(invalidateScopedCacheMock).not.toHaveBeenCalled();
  });

  it("rejects negative alternative scenario quoted prices", async () => {
    await expect(
      createAlternativeSupplier(
        "card-1",
        {
          supplier: { name: "Supplier B" },
          country: "DE",
          quotedPrice: -1,
          currency: Currency.EUR,
          leadTimeDays: 14,
          moq: 100,
          paymentTerms: "60 days",
          qualityRating: "AA",
          riskLevel: "Medium",
          notes: "",
          isSelected: false,
        },
        "actor-1",
        "org-1"
      )
    ).rejects.toThrow("Quoted price must be zero or greater.");

    await expect(
      createAlternativeMaterial(
        "card-1",
        {
          material: { name: "Recycled PET" },
          supplier: { name: "Supplier B" },
          specification: "Food grade",
          quotedPrice: -1,
          currency: Currency.EUR,
          performanceImpact: "Neutral",
          qualificationStatus: "Approved",
          riskLevel: "Low",
          notes: "",
          isSelected: false,
        },
        "actor-1",
        "org-1"
      )
    ).rejects.toThrow("Quoted price must be zero or greater.");

    expect(tx.savingCard.create).not.toHaveBeenCalled();
  });

  it("rejects creating a saving card outside the initial workflow phase", async () => {
    await expect(
      createSavingCard(
        createSavingCardInput({
          phase: Phase.VALIDATED,
        }),
        "actor-1",
        "org-1"
      )
    ).rejects.toMatchObject({
      name: "WorkflowError",
      status: 409,
      message: "New saving cards must start in IDEA phase.",
    } satisfies Partial<WorkflowError>);

    expect(tx.savingCard.create).not.toHaveBeenCalled();
  });

  it("updates only cards in the current organization and preserves finance-locked financial fields", async () => {
    const lockedImpactStart = new Date("2025-03-01T00:00:00.000Z");
    const lockedImpactEnd = new Date("2025-12-01T00:00:00.000Z");

    tx.savingCard.findFirst.mockResolvedValue({
      id: "card-1",
      organizationId: "org-1",
      phase: Phase.VALIDATED,
      financeLocked: true,
      savingType: "PRICE_REDUCTION",
      impactType: "HARD_SAVINGS",
      impactRecurrence: "RECURRING",
      budgetImpact: "BUDGET_IMPACT",
      baselinePrice: 15,
      newPrice: 12,
      annualVolume: 250,
      currency: Currency.USD,
      fxRate: 1.25,
      calculatedSavings: 750,
      calculatedSavingsUSD: 600,
      impactStartDate: lockedImpactStart,
      impactEndDate: lockedImpactEnd,
    });

    await updateSavingCard(
      "card-1",
      createSavingCardInput({
        phase: Phase.VALIDATED,
        baselinePrice: 20,
        newPrice: 16,
        annualVolume: 400,
        currency: Currency.EUR,
        fxRate: 0.9,
        impactStartDate: new Date("2026-01-01T00:00:00.000Z"),
        impactEndDate: new Date("2026-12-31T00:00:00.000Z"),
      }),
      "actor-1",
      "org-1"
    );

    expect(tx.savingCard.findFirst).toHaveBeenCalledWith({
      where: {
        id: "card-1",
        organizationId: "org-1",
      },
    });
    expect(tx.savingCard.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "card-1" },
        data: expect.objectContaining({
          buyerId: "buyer-1",
          baselinePrice: 15,
          newPrice: 12,
          annualVolume: 250,
          currency: Currency.USD,
          fxRate: 1.25,
          calculatedSavings: 750,
          calculatedSavingsUSD: 600,
          impactStartDate: lockedImpactStart,
          impactEndDate: lockedImpactEnd,
        }),
      })
    );
    expect(tx.savingCardStakeholder.deleteMany).toHaveBeenCalledWith({
      where: { savingCardId: "card-1" },
    });
    expect(tx.savingCardStakeholder.createMany).toHaveBeenCalledWith({
      data: [
        { savingCardId: "card-1", userId: "stakeholder-1" },
        { savingCardId: "card-1", userId: "stakeholder-2" },
      ],
    });
    expect(tx.phaseHistory.create).not.toHaveBeenCalled();
    expect(invalidateScopedCacheMock).toHaveBeenCalledWith({
      namespace: "dashboard-data",
      organizationId: "org-1",
    });
    expect(invalidateScopedCacheMock).toHaveBeenCalledWith({
      namespace: "workspace-readiness",
      organizationId: "org-1",
    });
  });

  it("rejects classification changes while finance lock is active", async () => {
    tx.savingCard.findFirst.mockResolvedValue({
      id: "card-1",
      organizationId: "org-1",
      phase: Phase.VALIDATED,
      financeLocked: true,
      savingType: "PRICE_REDUCTION",
      impactType: "HARD_SAVINGS",
      impactRecurrence: "RECURRING",
      budgetImpact: "BUDGET_IMPACT",
    });

    await expect(
      updateSavingCard(
        "card-1",
        createSavingCardInput({
          phase: Phase.VALIDATED,
          impactType: "COST_AVOIDANCE",
          referencePrice: 999,
        }),
        "actor-1",
        "org-1"
      )
    ).rejects.toMatchObject({
      name: "WorkflowError",
      status: 409,
      message:
        "Finance-locked savings cannot change savings classification. Remove the finance lock before changing savings type, impact type, recurrence, or budget impact.",
    });

    expect(tx.savingCard.update).not.toHaveBeenCalled();
  });

  it("rejects direct phase changes during saving card updates", async () => {
    tx.savingCard.findFirst.mockResolvedValue({
      id: "card-1",
      organizationId: "org-1",
      phase: Phase.VALIDATED,
      financeLocked: false,
      baselinePrice: 15,
      newPrice: 12,
      annualVolume: 250,
      currency: Currency.USD,
      impactStartDate: new Date("2025-03-01T00:00:00.000Z"),
      impactEndDate: new Date("2025-12-01T00:00:00.000Z"),
      cancellationReason: null,
    });

    await expect(
      updateSavingCard(
        "card-1",
        createSavingCardInput({
          phase: Phase.REALISED,
        }),
        "actor-1",
        "org-1"
      )
    ).rejects.toMatchObject({
      name: "WorkflowError",
      status: 409,
      message:
        "Direct phase updates are disabled. Use /api/phase-change-request to request workflow approval.",
    } satisfies Partial<WorkflowError>);

    expect(tx.savingCard.update).not.toHaveBeenCalled();
  });

  it("invalidates dashboard and readiness caches once after a bulk import", async () => {
    await importSavingCards(
      [createSavingCardInput(), createSavingCardInput({ title: "Second card" })],
      "actor-1",
      "org-1"
    );

    expect(tx.savingCard.create).toHaveBeenCalledTimes(2);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      {
        maxWait: 10_000,
        timeout: 120_000,
      }
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org-1",
        actorUserId: "actor-1",
        eventType: "saving_cards.imported",
        action: "saving_cards.imported",
        detail: "2 saving cards imported in one transaction.",
        payload: expect.objectContaining({
          importedCount: 2,
          phase: "IDEA",
          atomic: true,
        }),
      }),
    });
    expect(invalidateScopedCacheMock).toHaveBeenCalledTimes(2);
    expect(invalidateScopedCacheMock).toHaveBeenNthCalledWith(1, {
      namespace: "dashboard-data",
      organizationId: "org-1",
    });
    expect(invalidateScopedCacheMock).toHaveBeenNthCalledWith(2, {
      namespace: "workspace-readiness",
      organizationId: "org-1",
    });
  });

  it("does not invalidate portfolio caches when the atomic import transaction fails", async () => {
    tx.savingCard.create
      .mockResolvedValueOnce({
        id: "card-1",
        title: "First card",
        phase: Phase.IDEA,
      })
      .mockRejectedValueOnce(new Error("database write failed"));

    await expect(
      importSavingCards(
        [createSavingCardInput(), createSavingCardInput({ title: "Second card" })],
        "actor-1",
        "org-1"
      )
    ).rejects.toThrow("database write failed");

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.savingCard.create).toHaveBeenCalledTimes(2);
    expect(invalidateScopedCacheMock).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "saving_cards.imported",
      }),
    });
  });

  it("retrieves saving card lists with organization-scoped lean portfolio data", async () => {
    const cards = [{ id: "card-1", title: "Resin renegotiation" }];
    mockPrisma.savingCard.findMany.mockResolvedValue(cards);

    const result = await getSavingCards("org-1", {
      categoryId: "category-1",
      buyerId: "buyer-1",
      stakeholderUserId: "user-1",
      ids: ["card-1", "card-2"],
    });

    expect(mockPrisma.savingCard.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org-1",
        categoryId: "category-1",
        buyerId: "buyer-1",
        stakeholders: {
          some: {
            userId: "user-1",
          },
        },
        id: {
          in: ["card-1", "card-2"],
        },
      },
      select: expect.objectContaining({
        buyer: expect.any(Object),
        phaseChangeRequests: expect.any(Object),
      }),
      orderBy: { updatedAt: "desc" },
    });

    const [query] = mockPrisma.savingCard.findMany.mock.calls[0];
    expect(query.select.evidence).toEqual({
      select: {
        id: true,
        evidenceType: true,
        uploadedAt: true,
      },
      orderBy: {
        uploadedAt: "desc",
      },
    });
    expect(query.select.comments).toBeUndefined();
    expect(result).toEqual(cards);
  });

  it("short-circuits card retrieval when a scoped id list is empty", async () => {
    const result = await getSavingCards("org-1", {
      ids: [],
    });

    expect(mockPrisma.savingCard.findMany).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it("retrieves saving card detail with organization-scoped rich relations", async () => {
    const detailCard = { id: "card-1", title: "Resin renegotiation", evidence: [], comments: [] };
    mockPrisma.savingCard.findFirst.mockResolvedValue(detailCard);

    const result = await getSavingCard("card-1", "org-1");

    expect(mockPrisma.savingCard.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "card-1",
          organizationId: "org-1",
        },
        include: expect.objectContaining({
          evidence: {
            include: {
              uploadedBy: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
            orderBy: {
              uploadedAt: "desc",
            },
          },
          comments: expect.any(Object),
          approvals: expect.any(Object),
          phaseHistory: expect.any(Object),
          phaseChangeRequests: expect.any(Object),
        }),
      })
    );

    const [query] = mockPrisma.savingCard.findFirst.mock.calls[0];
    expect(query.select).toBeUndefined();
    expect(result).toEqual(detailCard);
  });
});
