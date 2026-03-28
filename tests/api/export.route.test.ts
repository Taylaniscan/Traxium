import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserMock = vi.hoisted(() => vi.fn());
const getSavingCardsMock = vi.hoisted(() => vi.fn());
const getWorkspaceReadinessMock = vi.hoisted(() => vi.fn());
const mapSavingCardsForExportMock = vi.hoisted(() => vi.fn());
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
  getCurrentUser: getCurrentUserMock,
}));

vi.mock("@/lib/data", () => ({
  getSavingCards: getSavingCardsMock,
  getWorkspaceReadiness: getWorkspaceReadinessMock,
  mapSavingCardsForExport: mapSavingCardsForExportMock,
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
    getCurrentUserMock.mockResolvedValue({
      id: "user-1",
      organizationId: "org-1",
    });
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
        phase: "IDEA",
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
        title: "Resin renegotiation",
      },
    ]);
    jsonToSheetMock.mockReturnValue({});
    aoaToSheetMock.mockReturnValue({});
    bookNewMock.mockReturnValue({
      Props: {},
    });
    writeMock.mockReturnValue(Buffer.from("xlsx-bytes"));
  });

  it("returns 401 for unauthenticated export requests", async () => {
    getCurrentUserMock.mockResolvedValueOnce(null);

    const response = await getExportRoute(
      new Request("http://localhost/api/export")
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized.",
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
  });
});
