import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MockAuthGuardError,
  createAuthGuardJsonResponse,
} from "../helpers/security-fixtures";

const requireUserMock = vi.hoisted(() => vi.fn());
const createAuthGuardErrorResponseMock = vi.hoisted(() => vi.fn());
const getSavingCardsMock = vi.hoisted(() => vi.fn());
const getWorkspaceReadinessMock = vi.hoisted(() => vi.fn());
const buildControllerWorkbookModelMock = vi.hoisted(() => vi.fn());
const enforceRateLimitMock = vi.hoisted(() => vi.fn());
const createRateLimitErrorResponseMock = vi.hoisted(() => vi.fn());
const writeAuditEventMock = vi.hoisted(() => vi.fn());
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
const prismaMock = vi.hoisted(() => ({
  auditLog: {
    create: vi.fn(),
  },
  materialConsumptionForecast: {
    findMany: vi.fn(() => Promise.resolve([])),
  },
  materialConsumptionActual: {
    findMany: vi.fn(() => Promise.resolve([])),
  },
}));

vi.mock("@/lib/auth", () => ({
  requireUser: requireUserMock,
  createAuthGuardErrorResponse: createAuthGuardErrorResponseMock,
}));

vi.mock("@/lib/data", () => ({
  getSavingCards: getSavingCardsMock,
  getWorkspaceReadiness: getWorkspaceReadinessMock,
}));

vi.mock("@/lib/export/controller-workbook", () => ({
  controllerSavingCardColumns: [
    "Saving Card Title",
    "Phase",
    "Savings EUR",
    "Finance Lock Status",
    "Evidence Count",
    "Evidence Status",
  ],
  evidenceSummaryColumns: [
    "Saving Card Title",
    "Phase",
    "Evidence Count",
    "Evidence Status",
    "Evidence Types",
    "Last Evidence Upload Date",
    "Finance Lock Status",
  ],
  controllerActualsReconciliationColumns: [
    "Saving Card Title",
    "Currency",
    "Period",
    "Forecast Qty",
    "Actual Qty",
    "Variance Qty",
    "Invoice Ref",
    "Unit Saving (Local)",
    "Forecast Value (Local)",
    "Actual Value (Local)",
    "Actual Value (USD)",
  ],
  importTemplateColumns: [
    "Title",
    "Phase",
    "Buyer",
    "Supplier",
    "Material",
    "Category",
    "Plant",
    "Business Unit",
    "Baseline Price",
    "New Price",
    "Annual Volume",
    "Currency",
    "Start Date",
    "End Date",
  ],
  buildControllerWorkbookModel: buildControllerWorkbookModelMock,
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: enforceRateLimitMock,
  createRateLimitErrorResponse: createRateLimitErrorResponseMock,
  RateLimitExceededError: RateLimitExceededErrorMock,
}));

vi.mock("@/lib/audit", () => ({
  auditEventTypes: {
    CONTROLLER_WORKBOOK_EXPORTED: "controller_workbook.exported",
  },
  writeAuditEvent: writeAuditEventMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("xlsx", () => ({
  utils: {
    json_to_sheet: jsonToSheetMock,
    aoa_to_sheet: aoaToSheetMock,
    sheet_add_aoa: vi.fn(),
    book_new: bookNewMock,
    book_append_sheet: appendSheetMock,
    encode_cell: ({ r, c }: { r: number; c: number }) =>
      `${String.fromCharCode(65 + c)}${r + 1}`,
    encode_range: () => "A1:Z1",
    decode_range: () => ({
      s: { r: 0, c: 0 },
      e: { r: 0, c: 0 },
    }),
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
    getSavingCardsMock.mockResolvedValue([{ id: "card-1" }]);
    getWorkspaceReadinessMock.mockResolvedValue({
      workspace: {
        name: "Atlas Procurement",
        slug: "atlas-procurement",
      },
    });
    buildControllerWorkbookModelMock.mockReturnValue({
      portfolioSummaryRows: [
        ["Traxium Controller Review Workbook", "", ""],
        ["Metric", "Value", "Review Note"],
        ["Active Cards", 1, "Excludes canceled cards"],
        ["Reconciliation Difference (EUR)", 0, "Expected to equal zero"],
      ],
      savingCardRows: [
        {
          "Saving Card Title": "Resin renegotiation",
          Phase: "Finance Validated",
          "Savings EUR": 100000,
          "Finance Lock Status": "Locked",
          "Evidence Count": 2,
          "Evidence Status": "Evidence attached",
        },
      ],
      dataDictionaryRows: [
        ["Column / Term", "Definition", "Accepted Values / Review Note"],
        [
          "Savings Formula",
          "(Effective Baseline - New Price) × Annual Volume",
          "",
        ],
      ],
      importTemplateRows: [
        {
          Title: "Example initiative",
          Phase: "Proposed",
        },
      ],
      evidenceSummaryRows: [
        {
          "Saving Card Title": "Resin renegotiation",
          Phase: "Finance Validated",
          "Evidence Count": 2,
          "Evidence Status": "Evidence attached",
          "Evidence Types": "Supplier Quote",
          "Last Evidence Upload Date": new Date("2026-03-20T10:00:00.000Z"),
          "Finance Lock Status": "Locked",
        },
      ],
      actualsReconciliationRows: [],
      reconciliation: {
        activeCardCount: 1,
        activeSavings: 100000,
        activeRowSavings: 100000,
        difference: 0,
        phaseCounts: {
          IDEA: 0,
          VALIDATED: 1,
          REALISED: 0,
          ACHIEVED: 0,
          CANCELLED: 0,
        },
        evidenceCoveragePercent: 100,
        financeLockedSavings: 100000,
        actualsForecastValueUSD: 0,
        actualsActualValueUSD: 0,
        actualsVarianceUSD: 0,
      },
    });
    jsonToSheetMock.mockImplementation(() => ({}));
    aoaToSheetMock.mockImplementation(() => ({}));
    bookNewMock.mockReturnValue({ Props: {} });
    writeMock.mockReturnValue(Buffer.from("xlsx-bytes"));
    writeAuditEventMock.mockResolvedValue(undefined);
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

  it("builds a tenant-scoped five-sheet controller workbook and audits the export", async () => {
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
    expect(getWorkspaceReadinessMock).toHaveBeenCalledWith({
      id: "user-1",
      organizationId: "org-1",
    });
    expect(buildControllerWorkbookModelMock).toHaveBeenCalledWith({
      cards: [{ id: "card-1" }],
      generatedAt: expect.any(Date),
      workspaceReadiness: {
        workspace: {
          name: "Atlas Procurement",
          slug: "atlas-procurement",
        },
      },
      actuals: expect.any(Map),
    });
    expect(appendSheetMock.mock.calls.map((call) => call[2])).toEqual([
      "Portfolio Summary",
      "Saving Cards",
      "Data Dictionary",
      "Import Template",
      "Evidence Summary",
      "Actuals Reconciliation",
    ]);
    expect(writeAuditEventMock).toHaveBeenCalledWith(prismaMock, {
      organizationId: "org-1",
      actorUserId: "user-1",
      eventType: "controller_workbook.exported",
      detail: "Controller-review workbook exported with 1 saving cards.",
      payload: expect.objectContaining({
        cardCount: 1,
        activeCardCount: 1,
        evidenceCoveragePercent: 100,
        reconciliationDifference: 0,
      }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(response.headers.get("content-disposition")).toContain(
      "traxium-atlas-procurement-controller-review-"
    );
  });
});
