import { ForecastSource } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_ORGANIZATION_ID,
  DEFAULT_USER_ID,
  OTHER_ORGANIZATION_ID,
} from "../helpers/security-fixtures";
import {
  DEFAULT_TENANT_PERIOD,
  createScopedSavingCard,
} from "../helpers/tenant-access-fixtures";

const mockPrisma = vi.hoisted(() => ({
  savingCard: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  materialConsumptionForecast: {
    findMany: vi.fn(),
    upsert: vi.fn(),
    deleteMany: vi.fn(),
  },
  materialConsumptionActual: {
    findMany: vi.fn(),
    upsert: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import {
  deleteActual,
  getPortfolioVolumeTimelines,
  getVolumeTimeline,
  importFromCsv,
  normalizePeriod,
  upsertForecast,
} from "@/lib/volume";

describe("tenant isolation queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not read a record from another tenant", async () => {
    mockPrisma.savingCard.findFirst.mockResolvedValueOnce(null);

    await expect(getVolumeTimeline("card-foreign", OTHER_ORGANIZATION_ID)).rejects.toThrow(
      "Saving card not found."
    );

    expect(mockPrisma.savingCard.findFirst).toHaveBeenCalledWith({
      where: {
        id: "card-foreign",
        organizationId: OTHER_ORGANIZATION_ID,
      },
      select: {
        id: true,
        organizationId: true,
        materialId: true,
        supplierId: true,
        volumeUnit: true,
        baselinePrice: true,
        newPrice: true,
      },
    });
    expect(mockPrisma.materialConsumptionForecast.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.materialConsumptionActual.findMany).not.toHaveBeenCalled();
  });

  it("loads portfolio volume data with three tenant-scoped queries", async () => {
    const firstCard = createScopedSavingCard();
    const secondCard = createScopedSavingCard({
      id: "card-2",
      materialId: "material-2",
      supplierId: "supplier-2",
      baselinePrice: 6,
      newPrice: 5,
    });
    const period = DEFAULT_TENANT_PERIOD;

    mockPrisma.savingCard.findMany.mockResolvedValueOnce([firstCard, secondCard]);
    mockPrisma.materialConsumptionForecast.findMany.mockResolvedValueOnce([
      {
        savingCardId: "card-1",
        period,
        forecastQty: 120,
        unit: "kg",
        source: ForecastSource.MANUAL_ENTRY,
      },
      {
        savingCardId: "card-2",
        period,
        forecastQty: 80,
        unit: "kg",
        source: ForecastSource.MANUAL_ENTRY,
      },
    ]);
    mockPrisma.materialConsumptionActual.findMany.mockResolvedValueOnce([
      {
        savingCardId: "card-1",
        period,
        actualQty: 100,
        unit: "kg",
        source: ForecastSource.ERP_CSV_UPLOAD,
      },
    ]);

    const timelines = await getPortfolioVolumeTimelines(
      ["card-1", "card-2", "card-1"],
      DEFAULT_ORGANIZATION_ID
    );

    expect(timelines).toHaveLength(2);
    expect(timelines[0].timeline[0]).toMatchObject({
      forecastSaving: 240,
      actualSaving: 200,
      isConfirmed: true,
    });
    expect(timelines[1].timeline[0]).toMatchObject({
      forecastSaving: 80,
      actualSaving: 0,
      isConfirmed: false,
    });
    expect(mockPrisma.savingCard.findMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: ["card-1", "card-2"],
        },
        organizationId: DEFAULT_ORGANIZATION_ID,
      },
      select: {
        id: true,
        organizationId: true,
        materialId: true,
        supplierId: true,
        volumeUnit: true,
        baselinePrice: true,
        newPrice: true,
      },
    });
    expect(mockPrisma.materialConsumptionForecast.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.materialConsumptionActual.findMany).toHaveBeenCalledTimes(1);
  });

  it("does not update a record from another tenant", async () => {
    mockPrisma.savingCard.findFirst.mockResolvedValueOnce(null);

    await expect(
      upsertForecast({
        savingCardId: "card-foreign",
        period: DEFAULT_TENANT_PERIOD,
        forecastQty: 240,
        unit: "kg",
        createdById: DEFAULT_USER_ID,
        context: OTHER_ORGANIZATION_ID,
      })
    ).rejects.toThrow("Saving card not found.");

    expect(mockPrisma.materialConsumptionForecast.upsert).not.toHaveBeenCalled();
  });

  it("does not delete a record from another tenant", async () => {
    mockPrisma.savingCard.findFirst.mockResolvedValueOnce(null);

    await expect(
      deleteActual("card-foreign", new Date(Date.UTC(2026, 0, 1)), OTHER_ORGANIZATION_ID)
    ).rejects.toThrow("Saving card not found.");

    expect(mockPrisma.materialConsumptionActual.deleteMany).not.toHaveBeenCalled();
  });

  it("allows same-tenant reads, updates, and deletes", async () => {
    const card = createScopedSavingCard();
    const period = DEFAULT_TENANT_PERIOD;

    mockPrisma.savingCard.findFirst
      .mockResolvedValueOnce(card)
      .mockResolvedValueOnce(card)
      .mockResolvedValueOnce(card);
    mockPrisma.materialConsumptionForecast.findMany.mockResolvedValueOnce([
      {
        period,
        forecastQty: 120,
        unit: "kg",
        source: ForecastSource.MANUAL_ENTRY,
      },
    ]);
    mockPrisma.materialConsumptionActual.findMany.mockResolvedValueOnce([
      {
        period,
        actualQty: 0,
        unit: "kg",
        source: ForecastSource.ERP_CSV_UPLOAD,
      },
    ]);
    mockPrisma.materialConsumptionForecast.upsert.mockResolvedValueOnce({
      id: "forecast-1",
    });
    mockPrisma.materialConsumptionActual.deleteMany.mockResolvedValueOnce({
      count: 1,
    });

    const timeline = await getVolumeTimeline("card-1", DEFAULT_ORGANIZATION_ID);
    const updatedForecast = await upsertForecast({
      savingCardId: "card-1",
      period,
      forecastQty: 180,
      unit: "kg",
      createdById: DEFAULT_USER_ID,
      context: DEFAULT_ORGANIZATION_ID,
    });
    const deletedActual = await deleteActual(
      "card-1",
      period,
      DEFAULT_ORGANIZATION_ID
    );

    expect(mockPrisma.materialConsumptionForecast.findMany).toHaveBeenCalledWith({
      where: {
        savingCard: {
          is: {
            id: "card-1",
            organizationId: DEFAULT_ORGANIZATION_ID,
          },
        },
      },
      orderBy: { period: "asc" },
      select: {
        period: true,
        forecastQty: true,
        unit: true,
        source: true,
      },
    });
    expect(mockPrisma.materialConsumptionForecast.upsert).toHaveBeenCalledWith({
      where: {
        savingCardId_materialId_period: {
          savingCardId: "card-1",
          materialId: "material-1",
          period: normalizePeriod(period),
        },
      },
      update: {
        supplierId: "supplier-1",
        forecastQty: 180,
        unit: "kg",
        source: ForecastSource.MANUAL_ENTRY,
        notes: null,
        createdById: DEFAULT_USER_ID,
      },
      create: {
        savingCardId: "card-1",
        materialId: "material-1",
        supplierId: "supplier-1",
        period: normalizePeriod(period),
        forecastQty: 180,
        unit: "kg",
        source: ForecastSource.MANUAL_ENTRY,
        notes: null,
        createdById: DEFAULT_USER_ID,
      },
    });
    expect(mockPrisma.materialConsumptionActual.deleteMany).toHaveBeenCalledWith({
      where: {
        materialId: "material-1",
        period: normalizePeriod(period),
        savingCard: {
          is: {
            id: "card-1",
            organizationId: DEFAULT_ORGANIZATION_ID,
          },
        },
      },
    });
    expect(timeline.summary.hasData).toBe(true);
    expect(timeline.timeline).toEqual([
      expect.objectContaining({
        periodKey: "2026-01",
        forecastQty: 120,
        actualQty: 0,
        forecastSaving: 240,
        actualSaving: 0,
        isConfirmed: true,
      }),
    ]);
    expect(timeline.summary.confirmedMonths).toBe(1);
    expect(updatedForecast).toEqual({ id: "forecast-1" });
    expect(deletedActual).toEqual({ count: 1 });
  });

  it("rejects imported negative forecast and actual quantities before writing rows", async () => {
    mockPrisma.savingCard.findFirst.mockResolvedValueOnce(createScopedSavingCard());

    const result = await importFromCsv(
      "card-1",
      [
        "period,forecast,actual,unit",
        "2026-01,-5,,kg",
        "2026-01,,-2,kg",
      ].join("\n"),
      DEFAULT_USER_ID,
      DEFAULT_ORGANIZATION_ID
    );

    expect(result).toEqual({
      imported: 0,
      rejected: 2,
      errors: [
        "Row 2: forecast quantity must be zero or greater.",
        "Row 3: actual quantity must be zero or greater.",
      ],
    });
    expect(mockPrisma.materialConsumptionForecast.upsert).not.toHaveBeenCalled();
    expect(mockPrisma.materialConsumptionActual.upsert).not.toHaveBeenCalled();
  });

  it("rejects imported current or future actuals without partially importing the row", async () => {
    mockPrisma.savingCard.findFirst.mockResolvedValueOnce(createScopedSavingCard());

    const result = await importFromCsv(
      "card-1",
      "period,forecast,actual,unit\n2999-01,120,100,kg",
      DEFAULT_USER_ID,
      DEFAULT_ORGANIZATION_ID
    );

    expect(result).toEqual({
      imported: 0,
      rejected: 1,
      errors: ["Row 2: Actuals can only be entered for past months."],
    });
    expect(mockPrisma.materialConsumptionForecast.upsert).not.toHaveBeenCalled();
    expect(mockPrisma.materialConsumptionActual.upsert).not.toHaveBeenCalled();
  });
});
