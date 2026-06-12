import { ApprovalStatus, Frequency, Phase, Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  approval: {
    findMany: vi.fn(),
  },
  phaseChangeRequest: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
  savingCard: {
    count: vi.fn(),
    findMany: vi.fn(),
    groupBy: vi.fn(),
  },
  supplier: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import {
  getCommandCenterData,
  resolveCommandCenterForecastBucket,
} from "@/lib/data";

describe("command center data helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes invalid forecast dates into a safe fallback bucket", () => {
    expect(resolveCommandCenterForecastBucket("not-a-real-date")).toEqual({
      month: "Unknown timing",
      sortValue: Number.MAX_SAFE_INTEGER,
    });
  });

  it("builds a stable forecast bucket for valid dates", () => {
    expect(
      resolveCommandCenterForecastBucket(
        new Date("2026-04-01T00:00:00.000Z")
      )
    ).toEqual({
      month: "Apr 2026",
      sortValue: new Date(2026, 3, 1).getTime(),
    });
  });

  it("loads command-center analytics without an interactive transaction timeout risk", async () => {
    prismaMock.savingCard.groupBy
      .mockResolvedValueOnce([
        {
          phase: Phase.IDEA,
          _sum: { calculatedSavingsUSD: 100 },
        },
      ])
      .mockResolvedValueOnce([
        {
          supplierId: "supplier-1",
          _sum: { calculatedSavingsUSD: 100 },
        },
      ])
      .mockResolvedValueOnce([
        {
          qualificationStatus: "Approved",
          _sum: { calculatedSavingsUSD: 100 },
        },
      ]);
    prismaMock.savingCard.findMany
      .mockResolvedValueOnce([
        {
          impactStartDate: new Date("2026-04-01T00:00:00.000Z"),
          calculatedSavingsUSD: 100,
          frequency: Frequency.RECURRING,
          phase: Phase.IDEA,
        },
      ])
      .mockResolvedValueOnce([
        {
          calculatedSavingsUSD: 100,
          alternativeSuppliers: [{ riskLevel: "Low" }],
          alternativeMaterials: [],
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "card-overdue",
          title: "Overdue card",
          phase: Phase.IDEA,
          endDate: new Date("2025-01-01T00:00:00.000Z"),
          calculatedSavingsUSD: 50,
          financeLocked: false,
          buyer: { name: "Can Kaya" },
          category: { name: "Packaging Materials" },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "card-locked",
          title: "Locked card",
          phase: Phase.VALIDATED,
          updatedAt: new Date("2026-04-02T00:00:00.000Z"),
          calculatedSavingsUSD: 60,
          financeLocked: true,
          buyer: { name: "Aylin Demir" },
          category: { name: "Polymer Carriers" },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "card-recent",
          title: "Recent card",
          phase: Phase.REALISED,
          updatedAt: new Date("2026-04-03T00:00:00.000Z"),
          calculatedSavingsUSD: 70,
          financeLocked: false,
          buyer: { name: "Taylan Iscan" },
          category: { name: "TiO2 & White Pigments" },
        },
      ]);
    prismaMock.phaseChangeRequest.count.mockResolvedValueOnce(1);
    prismaMock.savingCard.count.mockResolvedValueOnce(3);
    prismaMock.phaseChangeRequest.findMany.mockResolvedValueOnce([
      {
        id: "request-1",
        currentPhase: Phase.IDEA,
        requestedPhase: Phase.VALIDATED,
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        requestedBy: {
          name: "Can Kaya",
          role: Role.TACTICAL_BUYER,
        },
        approvals: [{ role: Role.FINANCIAL_CONTROLLER }],
        savingCard: {
          id: "card-1",
          title: "PP Carrier dual-source negotiation",
          calculatedSavingsUSD: 100,
          financeLocked: false,
        },
      },
    ]);
    prismaMock.approval.findMany.mockResolvedValueOnce([
      {
        id: "approval-1",
        phase: Phase.VALIDATED,
        approved: true,
        status: ApprovalStatus.APPROVED,
        comment: "Approved for demo.",
        createdAt: new Date("2026-04-02T00:00:00.000Z"),
        approver: {
          name: "Mert Dulger",
          role: Role.FINANCIAL_CONTROLLER,
        },
        savingCard: {
          id: "card-1",
          title: "PP Carrier dual-source negotiation",
        },
      },
    ]);
    prismaMock.supplier.findMany.mockResolvedValueOnce([
      {
        id: "supplier-1",
        name: "Borealis Polymers",
      },
    ]);

    const data = await getCommandCenterData("org-1");

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(data.kpis.pendingApprovals).toBe(1);
    expect(data.kpis.activeProjects).toBe(3);
    expect(data.topSuppliers).toEqual([
      {
        supplier: "Borealis Polymers",
        savings: 100,
      },
    ]);
    expect(data.pendingApprovalQueue).toHaveLength(1);
    expect(data.recentDecisions).toHaveLength(1);
  });
});
