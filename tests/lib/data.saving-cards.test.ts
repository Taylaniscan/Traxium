import { Currency, Phase } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  savingCard: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
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
  createSavingCard,
  getSavingCard,
  getSavingCards,
  importSavingCards,
  updateSavingCard,
  WorkflowError,
} from "@/lib/data";

function createSavingCardInput(overrides?: Partial<Record<string, unknown>>) {
  return {
    title: "Resin renegotiation",
    description: "Renegotiate the resin packaging contract for margin improvement.",
    savingType: "Cost reduction",
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
    tx = createSavingCardTransactionMock();
    mockPrisma.$transaction.mockImplementation(async (callback: unknown) => {
      if (typeof callback !== "function") {
        throw new Error("Expected a transaction callback.");
      }

      const transactionCallback = callback as (client: typeof tx) => Promise<unknown>;
      return transactionCallback(tx);
    });
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
      baselinePrice: 15,
      newPrice: 12,
      annualVolume: 250,
      currency: Currency.USD,
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
    expect(query.select.evidence).toBeUndefined();
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
          evidence: true,
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
