import { Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthGuardJsonResponse } from "../helpers/security-fixtures";

const requireUserMock = vi.hoisted(() => vi.fn());
const requirePermissionMock = vi.hoisted(() => vi.fn());
const createAuthGuardErrorResponseMock = vi.hoisted(() => vi.fn());
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
const enforceUsageQuotaMock = vi.hoisted(() => vi.fn());
const recordUsageEventMock = vi.hoisted(() => vi.fn());
const UsageQuotaExceededErrorMock = vi.hoisted(
  () =>
    class UsageQuotaExceededError extends Error {
      constructor(
        message: string,
        readonly feature = "SAVING_CARDS",
        readonly remaining = 0,
        readonly requestedQuantity = 1,
        readonly status = 429
      ) {
        super(message);
        this.name = "UsageQuotaExceededError";
      }
    }
);
const getReferenceDataMock = vi.hoisted(() => vi.fn());
const importSavingCardsMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  savingCard: {
    findFirst: vi.fn(),
  },
  savingCardEvidence: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
}));
const storeEvidenceFileMock = vi.hoisted(() => vi.fn());
const createEvidenceSignedUrlMock = vi.hoisted(() => vi.fn());
const isManagedEvidenceStorageLocationMock = vi.hoisted(() => vi.fn());
const xlsxReadMock = vi.hoisted(() => vi.fn());
const sheetToJsonMock = vi.hoisted(() => vi.fn());
const EvidenceStorageNotFoundErrorMock = vi.hoisted(
  () =>
    class EvidenceStorageNotFoundError extends Error {
      constructor(message: string) {
        super(message);
        this.name = "EvidenceStorageNotFoundError";
      }
    }
);

vi.mock("@/lib/auth", () => ({
  requireUser: requireUserMock,
  requirePermission: requirePermissionMock,
  createAuthGuardErrorResponse: createAuthGuardErrorResponseMock,
}));

vi.mock("@/lib/data", () => ({
  getReferenceData: getReferenceDataMock,
  importSavingCards: importSavingCardsMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/uploads", () => ({
  storeEvidenceFile: storeEvidenceFileMock,
  createEvidenceSignedUrl: createEvidenceSignedUrlMock,
  isManagedEvidenceStorageLocation: isManagedEvidenceStorageLocationMock,
  EvidenceStorageNotFoundError: EvidenceStorageNotFoundErrorMock,
}));

vi.mock("xlsx", () => ({
  read: xlsxReadMock,
  utils: {
    sheet_to_json: sheetToJsonMock,
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: enforceRateLimitMock,
  createRateLimitErrorResponse: createRateLimitErrorResponseMock,
  RateLimitExceededError: RateLimitExceededErrorMock,
}));

vi.mock("@/lib/usage", () => ({
  enforceUsageQuota: enforceUsageQuotaMock,
  recordUsageEvent: recordUsageEventMock,
  UsageQuotaExceededError: UsageQuotaExceededErrorMock,
}));

import { POST as postImportRoute } from "@/app/api/import/route";
import { GET as getEvidenceDownloadRoute } from "@/app/api/evidence/[id]/download/route";
import { POST as postEvidenceUploadRoute } from "@/app/api/upload/evidence/route";

function createFormDataRequest(formData: FormData | Error) {
  if (formData instanceof Error) {
    return {
      formData: vi.fn().mockRejectedValue(formData),
    } as unknown as Request;
  }

  return {
    formData: vi.fn().mockResolvedValue(formData),
  } as unknown as Request;
}

function createImportForm(file?: File) {
  const formData = new FormData();
  if (file) {
    formData.set("file", file);
  }
  return formData;
}

function createUploadForm(fields?: { savingCardId?: string; files?: File[] }) {
  const formData = new FormData();

  if (fields?.savingCardId !== undefined) {
    formData.append("savingCardId", fields.savingCardId);
  }

  for (const file of fields?.files ?? []) {
    formData.append("files", file);
  }

  return formData;
}

function createWorkbookFile(content = "sheet-bytes", name = "cards.xlsx", type =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
  return new File([content], name, { type });
}

function buildReferenceData() {
  return {
    users: [],
    buyers: [{ id: "buyer-1", name: "Strategic Buyer" }],
    suppliers: [{ id: "supplier-1", name: "Supplier A" }],
    materials: [{ id: "material-1", name: "PET Resin" }],
    categories: [{ id: "category-1", name: "Packaging" }],
    plants: [{ id: "plant-1", name: "Amsterdam" }],
    businessUnits: [{ id: "business-unit-1", name: "Beverages" }],
    fxRates: [],
  };
}

describe("import and evidence API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({
      id: "user-1",
      name: "Test User",
      email: "user@example.com",
      role: Role.GLOBAL_CATEGORY_LEADER,
      organizationId: "org-1",
    });
    createAuthGuardErrorResponseMock.mockImplementation(createAuthGuardJsonResponse);
    requirePermissionMock.mockResolvedValue({
      id: "user-1",
      name: "Test User",
      email: "user@example.com",
      role: Role.GLOBAL_CATEGORY_LEADER,
      organizationId: "org-1",
    });
    enforceRateLimitMock.mockResolvedValue(undefined);
    createRateLimitErrorResponseMock.mockImplementation((error: { message: string; status?: number }) =>
      Response.json(
        { error: error.message, code: "RATE_LIMITED" },
        { status: error.status ?? 429 }
      )
    );
    enforceUsageQuotaMock.mockResolvedValue(undefined);
    recordUsageEventMock.mockResolvedValue(undefined);
    getReferenceDataMock.mockResolvedValue(buildReferenceData());
    importSavingCardsMock.mockResolvedValue(undefined);
    xlsxReadMock.mockReset();
    sheetToJsonMock.mockReset();
    prismaMock.savingCard.findFirst.mockReset();
    prismaMock.savingCardEvidence.findFirst.mockReset();
    prismaMock.savingCardEvidence.create.mockReset();
    prismaMock.auditLog.create.mockReset();
    storeEvidenceFileMock.mockReset();
    createEvidenceSignedUrlMock.mockReset();
    isManagedEvidenceStorageLocationMock.mockReset();
  });

  describe("app/api/import/route.ts", () => {
    it("returns 401 JSON for unauthenticated import requests", async () => {
      requirePermissionMock.mockRejectedValueOnce({
        name: "AuthGuardError",
        status: 401,
        code: "UNAUTHENTICATED",
      });

      const response = await postImportRoute(createFormDataRequest(createImportForm(createWorkbookFile())));

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
      expect(importSavingCardsMock).not.toHaveBeenCalled();
    });

    it("returns 422 when no import file is provided", async () => {
      const response = await postImportRoute(createFormDataRequest(createImportForm()));

      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toEqual({ error: "An import file is required." });
    });

    it("returns 400 for invalid workbook uploads", async () => {
      xlsxReadMock.mockImplementationOnce(() => {
        throw new Error("bad workbook");
      });

      const response = await postImportRoute(
        createFormDataRequest(createImportForm(createWorkbookFile("not-a-workbook")))
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "Uploaded file must be a valid Excel workbook.",
      });
    });

    it("returns 422 when the workbook does not contain any import rows", async () => {
      xlsxReadMock.mockReturnValueOnce({
        SheetNames: ["Sheet1"],
        Sheets: {
          Sheet1: {},
        },
      });
      sheetToJsonMock.mockReturnValueOnce([]);

      const response = await postImportRoute(
        createFormDataRequest(createImportForm(createWorkbookFile()))
      );

      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toEqual({
        error: "The workbook does not contain any import rows.",
      });
    });

    it("returns 422 when a normalized import row is invalid", async () => {
      xlsxReadMock.mockReturnValueOnce({
        SheetNames: ["Sheet1"],
        Sheets: {
          Sheet1: {},
        },
      });
      sheetToJsonMock.mockReturnValueOnce([
        {
          Supplier: "Supplier A",
          Material: "PET Resin",
          Category: "Packaging",
          Plant: "Amsterdam",
          BusinessUnit: "Beverages",
          Buyer: "Strategic Buyer",
          BaselinePrice: 10,
          NewPrice: 8,
          AnnualVolume: 100,
          StartDate: "2025-01-01",
          EndDate: "2025-12-31",
        },
      ]);

      const response = await postImportRoute(
        createFormDataRequest(createImportForm(createWorkbookFile()))
      );

      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({
          error: expect.stringContaining("Row 2:"),
        })
      );
      expect(importSavingCardsMock).not.toHaveBeenCalled();
    });

    it("returns the imported count on success", async () => {
      xlsxReadMock.mockReturnValueOnce({
        SheetNames: ["Sheet1"],
        Sheets: {
          Sheet1: {},
        },
      });
      sheetToJsonMock.mockReturnValueOnce([
        {
          Title: "Resin renegotiation",
          Description: "Renegotiate the resin packaging contract for margin improvement.",
          Supplier: "Supplier A",
          Material: "PET Resin",
          Category: "Packaging",
          Plant: "Amsterdam",
          BusinessUnit: "Beverages",
          Buyer: "Strategic Buyer",
          BaselinePrice: 10,
          NewPrice: 8,
          AnnualVolume: 100,
          Currency: "EUR",
          FxRate: 1.1,
          Frequency: "RECURRING",
          StartDate: "2025-01-01",
          EndDate: "2025-12-31",
          ImpactStartDate: "2025-02-01",
          ImpactEndDate: "2025-12-31",
        },
      ]);

      const response = await postImportRoute(
        createFormDataRequest(createImportForm(createWorkbookFile()))
      );

      expect(importSavingCardsMock).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            title: "Resin renegotiation",
            buyer: { id: "buyer-1", name: "Strategic Buyer" },
          }),
        ]),
        "user-1",
        "org-1"
      );
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ count: 1 });
    });
  });

  describe("app/api/upload/evidence/route.ts", () => {
    it("returns 401 JSON for unauthenticated uploads", async () => {
      createAuthGuardErrorResponseMock.mockReturnValueOnce(
        Response.json({ error: "Unauthorized." }, { status: 401 })
      );
      requireUserMock.mockRejectedValueOnce(
        new Error("Authenticated session is required.")
      );

      const response = await postEvidenceUploadRoute(
        createFormDataRequest(createUploadForm({ savingCardId: "card-1", files: [createWorkbookFile("pdf", "evidence.pdf", "application/pdf")] }))
      );

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({
        success: false,
        error: "Unauthorized.",
      });
    });

    it("returns 400 when savingCardId is missing", async () => {
      const response = await postEvidenceUploadRoute(
        createFormDataRequest(
          createUploadForm({
            files: [createWorkbookFile("pdf", "evidence.pdf", "application/pdf")],
          })
        )
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        success: false,
        error: "Exactly one savingCardId field is required.",
      });
    });

    it("returns 422 when no files are uploaded", async () => {
      const response = await postEvidenceUploadRoute(
        createFormDataRequest(createUploadForm({ savingCardId: "card-1" }))
      );

      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toEqual({
        success: false,
        error: "At least one file is required.",
      });
    });

    it("returns 422 for unsupported file types", async () => {
      const response = await postEvidenceUploadRoute(
        createFormDataRequest(
          createUploadForm({
            savingCardId: "card-1",
            files: [createWorkbookFile("binary", "malware.exe", "application/x-msdownload")],
          })
        )
      );

      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toEqual({
        success: false,
        error: "Unsupported file type. Upload PDF, Office, or image files only.",
      });
    });

    it("returns 404 when the saving card is inaccessible", async () => {
      prismaMock.savingCard.findFirst.mockResolvedValueOnce(null);

      const response = await postEvidenceUploadRoute(
        createFormDataRequest(
          createUploadForm({
            savingCardId: "card-1",
            files: [createWorkbookFile("pdf", "evidence.pdf", "application/pdf")],
          })
        )
      );

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({
        success: false,
        error: "Saving card not found.",
      });
    });

    it("returns the uploaded file payload on success", async () => {
      prismaMock.savingCard.findFirst.mockResolvedValueOnce({
        id: "card-1",
        organizationId: "org-1",
      });
      storeEvidenceFileMock.mockResolvedValueOnce({
        fileName: "evidence.pdf",
        storageBucket: "evidence-private",
        storagePath: "organizations/org-1/saving-cards/card-1/evidence/evidence.pdf",
        fileSize: 5,
        fileType: "application/pdf",
      });
      prismaMock.savingCardEvidence.create.mockResolvedValueOnce({
        id: "evidence-1",
        fileName: "evidence.pdf",
        fileSize: 5,
        fileType: "application/pdf",
        uploadedAt: "2025-01-01T00:00:00.000Z",
      });

      const response = await postEvidenceUploadRoute(
        createFormDataRequest(
          createUploadForm({
            savingCardId: "card-1",
            files: [createWorkbookFile("pdf", "evidence.pdf", "application/pdf")],
          })
        )
      );

      expect(storeEvidenceFileMock).toHaveBeenCalledWith(
        expect.any(File),
        {
          organizationId: "org-1",
          savingCardId: "card-1",
        }
      );
      expect(response.status).toBe(201);
      await expect(response.json()).resolves.toEqual({
        success: true,
        files: [
          {
            id: "evidence-1",
            fileName: "evidence.pdf",
            fileSize: 5,
            fileType: "application/pdf",
            uploadedAt: "2025-01-01T00:00:00.000Z",
            downloadUrl: "/api/evidence/evidence-1/download",
          },
        ],
      });
    });
  });

  describe("app/api/evidence/[id]/download/route.ts", () => {
    it("returns 401 JSON for unauthenticated download requests", async () => {
      createAuthGuardErrorResponseMock.mockReturnValueOnce(
        Response.json({ error: "Unauthorized." }, { status: 401 })
      );
      requireUserMock.mockRejectedValueOnce(
        new Error("Authenticated session is required.")
      );

      const response = await getEvidenceDownloadRoute(new Request("http://localhost"), {
        params: Promise.resolve({ id: "evidence-1" }),
      });

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({
        success: false,
        error: "Unauthorized.",
      });
    });

    it("returns 422 for malformed evidence ids", async () => {
      const response = await getEvidenceDownloadRoute(new Request("http://localhost"), {
        params: Promise.resolve({ id: "bad/id" }),
      });

      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toEqual({
        success: false,
        error: "Evidence id is invalid.",
      });
    });

    it("returns 404 when evidence is missing or inaccessible", async () => {
      prismaMock.savingCardEvidence.findFirst.mockResolvedValueOnce(null);

      const response = await getEvidenceDownloadRoute(new Request("http://localhost"), {
        params: Promise.resolve({ id: "evidence-1" }),
      });

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({
        success: false,
        error: "Evidence not found or access denied.",
      });
    });

    it("redirects to a signed download URL on success", async () => {
      prismaMock.savingCardEvidence.findFirst.mockResolvedValueOnce({
        id: "evidence-1",
        fileName: "evidence.pdf",
        savingCardId: "card-1",
        storageBucket: "evidence-private",
        storagePath: "organizations/org-1/saving-cards/card-1/evidence/evidence.pdf",
        uploadedById: "user-1",
      });
      isManagedEvidenceStorageLocationMock.mockReturnValueOnce(true);
      createEvidenceSignedUrlMock.mockResolvedValueOnce("https://storage.example.com/signed-url");

      const response = await getEvidenceDownloadRoute(new Request("http://localhost"), {
        params: Promise.resolve({ id: "evidence-1" }),
      });

      expect(createEvidenceSignedUrlMock).toHaveBeenCalledWith(
        "evidence-private",
        "organizations/org-1/saving-cards/card-1/evidence/evidence.pdf",
        60
      );
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          savingCardId: "card-1",
          action: "evidence.downloaded",
          detail: "Evidence downloaded: evidence.pdf",
        },
      });
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("https://storage.example.com/signed-url");
    });
  });
});
