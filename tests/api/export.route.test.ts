import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MockAuthGuardError,
  createAuthGuardJsonResponse,
} from "../helpers/security-fixtures";

const requireUserMock = vi.hoisted(() => vi.fn());
const createAuthGuardErrorResponseMock = vi.hoisted(() => vi.fn());
const getSavingCardsMock = vi.hoisted(() => vi.fn());
const getWorkspaceReadinessMock = vi.hoisted(() => vi.fn());
const mapSavingCardsForExportMock = vi.hoisted(() => vi.fn());
const savingCardExportColumnsMock = vi.hoisted(() => [
  "Saving Card Title",
  "Phase",
  "Savings EUR",
  "Finance Locked",
]);
const enforceRateLimitMock = vi.hoisted(() => vi.fn());
const createRateLimitErrorResponseMock = vi.hoisted(() => vi.fn());
const RateLimitExceededErrorMock = vi.hoisted(
  () =>
    class RateLimitExceededError extends Error {
      constructor(message: string, readonly status = 429) {
        super(message);
        this.name = "RateLimitExceededError";
      }
    }
);
const jsonToSheetMock = vi.hoisted(() => vi.fn());
const aoaToSheetMock = vi.hoisted(() => vi.fn());
const bookNewMock = vi.hoisted(() => vi.fn());
const appendSheetMock = vi.hoisted(() => vi.fn());
const writeMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireUser: requireUserMock,
  createAuthGuardErrorResponse: createAuthGuardErrorResponseMock,
}));

vi.mock("@/lib/data", () => ({
  getSavingCards: getSavingCardsMock,
  getWorkspaceReadiness: getWorkspaceReadinessMock,
  mapSavingCardsForExport: mapSavingCardsForExportMock,
  savingCardExportColumns: savingCardExportColumnsMock,
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: enforceRateLimitMock,
  createRateLimitErrorResponse: createRateLimitErrorResponseMock,
  RateLimitExceededError: RateLimitExceededErrorMock,
}));

vi.mock("xlsx", () => ({
  utils: {
    json_to_sheet: jsonToSheetMock,
    aoa_to_sheet: aoaToSheetMock,
    book_new: bookNewMock,
    book_append_sheet: appendSheetMock,
  },
  write: writeMock,
}));

import { GET as getExportRoute } from "@/app/api/export/route";

describe("export route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({
      id: "user-1",
      organizationId: "org-1",
    });
    createAuthGuardErrorResponseMock.mockImplementation(createAuthGuardJsonResponse);
    enforceRateLimitMock.mockResolvedValue(undefined);
    createRateLimitErrorResponseMock.mockImplementation(
      (error: { message: string; status?: number }) =>
        Response.json(
          { error: error.message, code: "RATE_LIMITED" },
          { status: error.status ?? 429 }
        )
    );
    getSavingCardsMock.mockResolvedValue([
      {
        id: "card-1",
        phase: "VALIDATED",
        calculatedSavings: 100000,
        financeLocked: true,
      },
      {
        id: "card-2",
        phase: "ACHIEVED",
        calculatedSavings: 30000,
        financeLocked: false,
      },
      {
        id: "card-3",
        phase: "CANCELLED",
        calculatedSavings: 20000,
        financeLocked: false,
      },
    ]);
    getWorkspaceReadinessMock.mockResolvedValue({
      workspace: {
        name: "Atlas Procurement",
        slug: "atlas-procurement",
      },
      coverage: {
        overallPercent: 100,
        masterDataReadyCount: 5,
        masterDataTotal: 5,
        workflowReadyCount: 4,
        workflowTotal: 4,
      },
      activity: {
        lastPortfolioUpdateAt: new Date("2026-03-27T10:00:00.000Z"),
      },
    });
    mapSavingCardsForExportMock.mockReturnValue([
      {
        "Saving Card Title": "Resin renegotiation",
        Phase: "Validated",
        "Savings EUR": 100000,
        "Finance Locked": "Yes",
      },
    ]);
    jsonToSheetMock.mockReturnValue({});
    aoaToSheetMock.mockReturnValue({});
    bookNewMock.mockReturnValue({
      Props: {},
    });
    writeMock.mockReturnValue(Buffer.from("xlsx-bytes"));
  });

  it("returns 402 for billing-blocked export requests", async () => {
    requireUserMock.mockRejectedValueOnce(
      new MockAuthGuardError(
        "Your workspace subscription is unpaid. Resolve billing before product access can continue.",
        402,
        "BILLING_REQUIRED",
        {
          accessState: "blocked_unpaid",
          reasonCode: "unpaid",
        }
      )
    );

    const response = await getExportRoute(
      new Request("http://localhost/api/export")
    );

    expect(response.status).toBe(402);
    await expect(response.json()).resolves.toEqual({
      error:
        "Your workspace subscription is unpaid. Resolve billing before product access can continue.",
      code: "BILLING_REQUIRED",
      accessState: "blocked_unpaid",
      reasonCode: "unpaid",
      billingRequiredPath: "/billing-required",
    });
  });

  it("builds an organization-scoped export workbook and enforces the export rate limit", async () => {
    const response = await getExportRoute(
      new Request("http://localhost/api/export")
    );

    expect(enforceRateLimitMock).toHaveBeenCalledWith({
      policy: "dataExport",
      request: expect.any(Request),
      userId: "user-1",
      organizationId: "org-1",
      action: "saving-cards.export",
    });
    expect(getSavingCardsMock).toHaveBeenCalledWith({
      id: "user-1",
      organizationId: "org-1",
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(response.headers.get("content-disposition")).toContain(
      "traxium-atlas-procurement-savings-report-"
    );
    expect(jsonToSheetMock).toHaveBeenCalledWith(
      [
        {
          "Saving Card Title": "Resin renegotiation",
          Phase: "Validated",
          "Savings EUR": 100000,
          "Finance Locked": "Yes",
        },
      ],
      {
        header: savingCardExportColumnsMock,
      }
    );
    expect(aoaToSheetMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        ["Portfolio Scope", 3],
        ["Active Cards", 2],
        ["Active Savings (EUR)", 130000],
        ["Realized Savings (EUR)", 0],
        ["Achieved Savings (EUR)", 30000],
        ["Finance Locked Cards", 1],
        ["Finance Locked Savings (EUR)", 100000],
        ["Validated Cards", 1],
        ["Achieved Cards", 1],
        ["Canceled Cards", 1],
      ])
    );
    expect(appendSheetMock).toHaveBeenNthCalledWith(
      1,
      expect.any(Object),
      expect.any(Object),
      "Report Summary"
    );
    expect(appendSheetMock).toHaveBeenNthCalledWith(
      2,
      expect.any(Object),
      expect.any(Object),
      "Savings"
    );
  });

  it("maps saving-card exports with controller-friendly labels and fallback values", async () => {
    const { mapSavingCardsForExport } = await import(
      "@/lib/saving-cards/queries"
    );

    expect(
      mapSavingCardsForExport([
        {
          id: "card-1",
          title: "Resin renegotiation",
          savingType: "Commercial negotiation",
          phase: "REALISED",
          supplier: { name: "Atlas Chemicals" },
          material: { name: "PET Resin" },
          alternativeSupplier: null,
          alternativeSupplierManualName: "Backup Supplier",
          alternativeMaterial: null,
          alternativeMaterialManualName: null,
          savingDriver: null,
          implementationComplexity: "Medium",
          qualificationStatus: "Approved",
          category: { name: "Packaging" },
          buyer: { name: "Casey Buyer" },
          businessUnit: { name: "Beverages" },
          baselinePrice: 12,
          newPrice: 10,
          annualVolume: 1000,
          currency: "EUR",
          calculatedSavings: 2000,
          calculatedSavingsUSD: 2200,
          startDate: new Date("2026-01-01T00:00:00.000Z"),
          endDate: new Date("2026-02-01T00:00:00.000Z"),
          impactStartDate: new Date("2026-03-01T00:00:00.000Z"),
          impactEndDate: new Date("2026-12-31T00:00:00.000Z"),
          financeLocked: true,
        },
      ] as Parameters<typeof mapSavingCardsForExport>[0])
    ).toEqual([
      expect.objectContaining({
        "Card ID": "card-1",
        "Saving Card Title": "Resin renegotiation",
        Phase: "Realized",
        "Saving Type": "Commercial negotiation",
        Supplier: "Atlas Chemicals",
        Material: "PET Resin",
        "Alternative Supplier": "Backup Supplier",
        "Alternative Material": "",
        Category: "Packaging",
        Buyer: "Casey Buyer",
        "Business Unit": "Beverages",
        "Savings EUR": 2000,
        "Savings USD": 2200,
        "Finance Locked": "Yes",
      }),
    ]);
  });
});
