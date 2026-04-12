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
  getVolumeTimeline,
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
        actualQty: 90,
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
        actualQty: 90,
        forecastSaving: 240,
        actualSaving: 180,
        isConfirmed: true,
      }),
    ]);
    expect(updatedForecast).toEqual({ id: "forecast-1" });
    expect(deletedActual).toEqual({ count: 1 });
  });
});
