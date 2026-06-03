import { MembershipStatus, OrganizationRole, Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSessionUser,
  createAuthGuardJsonResponse,
  MockAuthGuardError,
} from "../helpers/security-fixtures";

const requireUserMock = vi.hoisted(() => vi.fn());
const requireOrganizationMock = vi.hoisted(() => vi.fn());
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
  buyer: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  supplier: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  material: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  category: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
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
  requireOrganization: requireOrganizationMock,
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

function createImportForm(file?: File, importType?: string) {
  const formData = new FormData();
  if (file) {
    formData.set("file", file);
  }
  if (importType) {
    formData.set("importType", importType);
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
    requireOrganizationMock.mockResolvedValue(
      createSessionUser({
        id: "user-1",
        organizationId: "org-1",
        activeOrganizationId: "org-1",
        activeOrganization: {
          membershipId: "membership-1",
          organizationId: "org-1",
          membershipRole: OrganizationRole.OWNER,
          membershipStatus: MembershipStatus.ACTIVE,
        },
      })
    );
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
    prismaMock.buyer.findMany.mockReset();
    prismaMock.buyer.create.mockReset();
    prismaMock.supplier.findMany.mockReset();
    prismaMock.supplier.create.mockReset();
    prismaMock.material.findMany.mockReset();
    prismaMock.material.create.mockReset();
    prismaMock.category.findMany.mockReset();
    prismaMock.category.create.mockReset();
    prismaMock.savingCard.findFirst.mockReset();
    prismaMock.savingCardEvidence.findFirst.mockReset();
    prismaMock.savingCardEvidence.create.mockReset();
    prismaMock.auditLog.create.mockReset();
    storeEvidenceFileMock.mockReset();
    createEvidenceSignedUrlMock.mockReset();
    isManagedEvidenceStorageLocationMock.mockReset();
    prismaMock.buyer.findMany.mockResolvedValue([]);
    prismaMock.buyer.create.mockResolvedValue({ id: "buyer-1", name: "Buyer" });
    prismaMock.supplier.findMany.mockResolvedValue([]);
    prismaMock.supplier.create.mockResolvedValue({ id: "supplier-1", name: "Supplier" });
    prismaMock.material.findMany.mockResolvedValue([]);
    prismaMock.material.create.mockResolvedValue({ id: "material-1", name: "Material" });
    prismaMock.category.findMany.mockResolvedValue([]);
    prismaMock.category.create.mockResolvedValue({ id: "category-1", name: "Category" });
  });

  describe("app/api/import/route.ts", () => {
    it("returns 401 JSON for unauthenticated import requests", async () => {
      requireOrganizationMock.mockRejectedValueOnce(
        new MockAuthGuardError(
          "Authenticated session is required.",
          401,
          "UNAUTHENTICATED"
        )
      );

      const response = await postImportRoute(createFormDataRequest(createImportForm(createWorkbookFile())));

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
      expect(importSavingCardsMock).not.toHaveBeenCalled();
    });

    it("returns 403 JSON when a workspace member imports master data", async () => {
      requireOrganizationMock.mockResolvedValueOnce(
        createSessionUser({
          id: "user-1",
          organizationId: "org-1",
          activeOrganizationId: "org-1",
          activeOrganization: {
            membershipId: "membership-1",
            organizationId: "org-1",
            membershipRole: OrganizationRole.MEMBER,
            membershipStatus: MembershipStatus.ACTIVE,
          },
        })
      );

      const response = await postImportRoute(
        createFormDataRequest(createImportForm(createWorkbookFile(), "buyers"))
      );

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({ error: "Forbidden." });
      expect(enforceRateLimitMock).not.toHaveBeenCalled();
      expect(prismaMock.buyer.create).not.toHaveBeenCalled();
    });

    it("allows legacy workspace managers to import even when their tenant membership is member", async () => {
      requireOrganizationMock.mockResolvedValueOnce(
        createSessionUser({
          id: "user-1",
          role: Role.GLOBAL_CATEGORY_LEADER,
          organizationId: "org-1",
          activeOrganizationId: "org-1",
          activeOrganization: {
            membershipId: "membership-1",
            organizationId: "org-1",
            membershipRole: OrganizationRole.MEMBER,
            membershipStatus: MembershipStatus.ACTIVE,
          },
        })
      );
      xlsxReadMock.mockReturnValueOnce({
        SheetNames: ["Sayfa1"],
        Sheets: {
          Sayfa1: {},
        },
      });
      sheetToJsonMock.mockReturnValueOnce([
        {
          Name: "Taylan Iscan",
          Email: "mayaworldsocial+2@gmail.com",
        },
      ]);

      const response = await postImportRoute(
        createFormDataRequest(
          createImportForm(
            createWorkbookFile("xlsx-bytes", "BuyersMayaLLC.xlsx"),
            "buyers"
          )
        )
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        importType: "buyers",
        summary: {
          created: 1,
          skipped: 0,
          failed: 0,
        },
      });
      expect(prismaMock.buyer.create).toHaveBeenCalledWith({
        data: {
          organizationId: "org-1",
          name: "Taylan Iscan",
          email: "mayaworldsocial+2@gmail.com",
        },
      });
    });

    it("returns 422 when no import file is provided", async () => {
      const response = await postImportRoute(createFormDataRequest(createImportForm()));

      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toEqual({ error: "An import file is required." });
    });

    it("uses separate rate-limit buckets for the guided master-data upload sequence", async () => {
      xlsxReadMock.mockReturnValue({
        SheetNames: ["Sheet1"],
        Sheets: {
          Sheet1: {},
        },
      });
      sheetToJsonMock.mockReturnValue([{ Name: "Imported Row" }]);

      for (const importType of ["buyers", "suppliers", "materials", "categories"]) {
        const response = await postImportRoute(
          createFormDataRequest(
            createImportForm(
              createWorkbookFile("xlsx-bytes", `${importType}.xlsx`),
              importType
            )
          )
        );

        expect(response.status).toBe(200);
      }

      expect(enforceRateLimitMock.mock.calls.map((call) => call[0].action)).toEqual([
        "master-data.import.buyers",
        "master-data.import.suppliers",
        "master-data.import.materials",
        "master-data.import.categories",
      ]);
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

    it("returns 422 when a master-data upload is not CSV or XLSX", async () => {
      const response = await postImportRoute(
        createFormDataRequest(
          createImportForm(
            createWorkbookFile(
              "legacy-binary",
              "buyers.xls",
              "application/vnd.ms-excel"
            ),
            "buyers"
          )
        )
      );

      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toEqual({
        error: "Master-data imports accept CSV or XLSX files only.",
      });
      expect(xlsxReadMock).not.toHaveBeenCalled();
    });

    it("returns row-level saving-card validation errors without partially importing", async () => {
      xlsxReadMock.mockReturnValueOnce({
        SheetNames: ["Sheet1"],
        Sheets: {
          Sheet1: {},
        },
      });
      sheetToJsonMock.mockReturnValueOnce([
        {
          Title: "Valid resin renegotiation",
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
        {
          Title: "Bad prices",
          Description: "This row has a new price above baseline and must be rejected.",
          Supplier: "Supplier A",
          Material: "PET Resin",
          Category: "Packaging",
          Plant: "Amsterdam",
          BusinessUnit: "Beverages",
          Buyer: "Strategic Buyer",
          BaselinePrice: 10,
          NewPrice: 12,
          AnnualVolume: 100,
          Currency: "EUR",
          FxRate: 1,
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

      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toEqual({
        importType: "saving_cards",
        error:
          "Saving-card import has 2 row errors. No saving cards were imported. Fix the listed rows and retry.",
        summary: {
          total: 3,
          valid: 1,
          failed: 2,
        },
        results: [
          {
            row: 3,
            status: "failed",
            title: "",
            message: expect.stringContaining("Title:"),
          },
          {
            row: 4,
            status: "failed",
            title: "Bad prices",
            message:
              "New Price: New price must not exceed the baseline price.",
          },
        ],
      });
      expect(importSavingCardsMock).not.toHaveBeenCalled();
      expect(enforceUsageQuotaMock).not.toHaveBeenCalled();
      expect(recordUsageEventMock).not.toHaveBeenCalled();
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

    it("accepts controller-friendly saving-card headers and US phase labels", async () => {
      xlsxReadMock.mockReturnValueOnce({
        SheetNames: ["Savings"],
        Sheets: {
          Savings: {},
        },
      });
      sheetToJsonMock.mockReturnValueOnce([
        {
          "Saving Card Title": "Freight lane consolidation",
          Description: "Consolidate freight lanes after supplier contract reset.",
          "Saving Type": "Commercial negotiation",
          Phase: "Realized",
          Supplier: "Supplier A",
          Material: "PET Resin",
          Category: "Packaging",
          Plant: "Amsterdam",
          "Business Unit": "Beverages",
          Buyer: "Strategic Buyer",
          "Baseline Price": 10,
          "New Price": 8,
          "Annual Volume": 100,
          Currency: "EUR",
          "FX Rate": 1,
          Frequency: "RECURRING",
          "Start Date": "2025-01-01",
          "End Date": "2025-12-31",
          "Impact Start Date": "2025-02-01",
          "Impact End Date": "2025-12-31",
        },
      ]);

      const response = await postImportRoute(
        createFormDataRequest(createImportForm(createWorkbookFile()))
      );

      expect(importSavingCardsMock).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            title: "Freight lane consolidation",
            savingType: "Commercial negotiation",
            phase: "REALISED",
            businessUnit: { id: "business-unit-1", name: "Beverages" },
            baselinePrice: 10,
            newPrice: 8,
          }),
        ],
        "user-1",
        "org-1"
      );
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ count: 1 });
    });

    it("imports buyer master data from CSV and returns created, skipped, and failed row outcomes", async () => {
      xlsxReadMock.mockReturnValueOnce({
        SheetNames: ["Sheet1"],
        Sheets: {
          Sheet1: {},
        },
      });
      prismaMock.buyer.findMany.mockResolvedValueOnce([{ name: "Existing Buyer" }]);
      sheetToJsonMock.mockReturnValueOnce([
        {
          Name: "Casey Buyer",
          Email: "casey@example.com",
          Code: "BUY-100",
          Department: "Procurement",
        },
        {
          Name: "Existing Buyer",
          Email: "existing@example.com",
        },
        {
          Name: "Casey Buyer",
          Email: "duplicate@example.com",
        },
        {
          Name: "Broken Buyer",
          Email: "not-an-email",
        },
      ]);

      const response = await postImportRoute(
        createFormDataRequest(
          createImportForm(
            createWorkbookFile("name,email,code,department", "buyers.csv", "text/csv"),
            "buyers"
          )
        )
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        importType: "buyers",
        summary: {
          created: 1,
          skipped: 2,
          failed: 1,
        },
        results: [
          {
            row: 2,
            status: "created",
            name: "Casey Buyer",
            message: "Created buyer record.",
          },
          {
            row: 3,
            status: "skipped",
            name: "Existing Buyer",
            message: "Already exists in this workspace.",
          },
          {
            row: 4,
            status: "skipped",
            name: "Casey Buyer",
            message: "Duplicate name already appears earlier in this workbook.",
          },
          {
            row: 5,
            status: "failed",
            name: "Broken Buyer",
            message: "Email must be a valid email address.",
          },
        ],
      });
      expect(prismaMock.buyer.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.buyer.create).toHaveBeenCalledWith({
        data: {
          organizationId: "org-1",
          name: "Casey Buyer",
          email: "casey@example.com",
        },
      });
      expect(xlsxReadMock).toHaveBeenCalledWith("name,email,code,department", {
        type: "string",
      });
      expect(getReferenceDataMock).not.toHaveBeenCalled();
      expect(importSavingCardsMock).not.toHaveBeenCalled();
      expect(enforceUsageQuotaMock).not.toHaveBeenCalled();
      expect(recordUsageEventMock).not.toHaveBeenCalled();
    });

    it("imports buyer master data from XLSX files with Name, Email, Code, and Department headers", async () => {
      xlsxReadMock.mockReturnValueOnce({
        SheetNames: ["Sayfa1"],
        Sheets: {
          Sayfa1: {},
        },
      });
      sheetToJsonMock.mockReturnValueOnce([
        {
          Name: "Taylan Iscan",
          Email: "mayaworldsocial+2@gmail.com",
          Code: "B001",
          Department: "Sourcing",
        },
        {
          Name: "Mustafa Pekcan",
          Email: "mayaworldsocial+3@gmail.com",
          Code: "B002",
          Department: "Sourcing",
        },
      ]);

      const response = await postImportRoute(
        createFormDataRequest(
          createImportForm(
            createWorkbookFile("xlsx-bytes", "BuyersMayaLLC.xlsx"),
            "buyers"
          )
        )
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        importType: "buyers",
        summary: {
          created: 2,
          skipped: 0,
          failed: 0,
        },
        results: [
          {
            row: 2,
            status: "created",
            name: "Taylan Iscan",
            message: "Created buyer record.",
          },
          {
            row: 3,
            status: "created",
            name: "Mustafa Pekcan",
            message: "Created buyer record.",
          },
        ],
      });
      expect(prismaMock.buyer.create).toHaveBeenCalledTimes(2);
      expect(prismaMock.buyer.create).toHaveBeenNthCalledWith(1, {
        data: {
          organizationId: "org-1",
          name: "Taylan Iscan",
          email: "mayaworldsocial+2@gmail.com",
        },
      });
      expect(prismaMock.buyer.create).toHaveBeenNthCalledWith(2, {
        data: {
          organizationId: "org-1",
          name: "Mustafa Pekcan",
          email: "mayaworldsocial+3@gmail.com",
        },
      });
      expect(xlsxReadMock).toHaveBeenCalledWith(expect.any(ArrayBuffer), {
        type: "array",
      });
      expect(sheetToJsonMock).toHaveBeenCalledWith(
        {},
        {
          defval: "",
        }
      );
    });

    it("imports supplier master data with row-level validation for optional contact email", async () => {
      xlsxReadMock.mockReturnValueOnce({
        SheetNames: ["Sheet1"],
        Sheets: {
          Sheet1: {},
        },
      });
      prismaMock.supplier.findMany.mockResolvedValueOnce([{ name: "Existing Supplier" }]);
      sheetToJsonMock.mockReturnValueOnce([
        {
          Name: "Atlas Chemicals",
          Code: "SUP-100",
          Country: "Netherlands",
          ContactEmail: "sales@atlaschemicals.com",
        },
        {
          Name: "Existing Supplier",
          Code: "SUP-200",
        },
        {
          Name: "Broken Supplier",
          ContactEmail: "not-an-email",
        },
      ]);

      const response = await postImportRoute(
        createFormDataRequest(
          createImportForm(
            createWorkbookFile("xlsx-bytes", "suppliers.xlsx"),
            "suppliers"
          )
        )
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        importType: "suppliers",
        summary: {
          created: 1,
          skipped: 1,
          failed: 1,
        },
        results: [
          {
            row: 2,
            status: "created",
            name: "Atlas Chemicals",
            message: "Created supplier record.",
          },
          {
            row: 3,
            status: "skipped",
            name: "Existing Supplier",
            message: "Already exists in this workspace.",
          },
          {
            row: 4,
            status: "failed",
            name: "Broken Supplier",
            message: "Contact email must be a valid email address.",
          },
        ],
      });
      expect(prismaMock.supplier.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.supplier.create).toHaveBeenCalledWith({
        data: {
          organizationId: "org-1",
          name: "Atlas Chemicals",
        },
      });
      expect(getReferenceDataMock).not.toHaveBeenCalled();
      expect(importSavingCardsMock).not.toHaveBeenCalled();
    });

    it("returns 422 when a master-data workbook omits the Name header", async () => {
      xlsxReadMock.mockReturnValueOnce({
        SheetNames: ["Sheet1"],
        Sheets: {
          Sheet1: {},
        },
      });
      sheetToJsonMock.mockReturnValueOnce([
        {
          SupplierName: "Atlas Chemicals",
        },
      ]);

      const response = await postImportRoute(
        createFormDataRequest(createImportForm(createWorkbookFile(), "suppliers"))
      );

      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toEqual({
        error: "Supplier imports must include a Name column.",
      });
      expect(prismaMock.supplier.create).not.toHaveBeenCalled();
    });

    it("marks rows as failed when required master-data fields are blank", async () => {
      xlsxReadMock.mockReturnValueOnce({
        SheetNames: ["Sheet1"],
        Sheets: {
          Sheet1: {},
        },
      });
      sheetToJsonMock.mockReturnValueOnce([
        {
          Name: "",
        },
        {
          Name: "  ",
        },
        {
          Name: "PET Resin",
        },
      ]);

      const response = await postImportRoute(
        createFormDataRequest(createImportForm(createWorkbookFile(), "materials"))
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        importType: "materials",
        summary: {
          created: 1,
          skipped: 0,
          failed: 2,
        },
        results: [
          {
            row: 2,
            status: "failed",
            name: "",
            message: "Name is required.",
          },
          {
            row: 3,
            status: "failed",
            name: "",
            message: "Name is required.",
          },
          {
            row: 4,
            status: "created",
            name: "PET Resin",
            message: "Created material record.",
          },
        ],
      });
      expect(prismaMock.material.create).toHaveBeenCalledTimes(1);
    });

    it("imports category master data and keeps annual target defaults tenant-scoped", async () => {
      xlsxReadMock.mockReturnValueOnce({
        SheetNames: ["Sheet1"],
        Sheets: {
          Sheet1: {},
        },
      });
      prismaMock.category.findMany.mockResolvedValueOnce([{ name: "Existing Category" }]);
      sheetToJsonMock.mockReturnValueOnce([
        {
          Name: "Packaging",
          Code: "CAT-100",
          Owner: "Direct Procurement",
        },
        {
          Name: "Existing Category",
        },
        {
          Name: "Packaging",
        },
      ]);

      const response = await postImportRoute(
        createFormDataRequest(
          createImportForm(
            createWorkbookFile("name,code,owner", "categories.csv", "text/csv"),
            "categories"
          )
        )
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        importType: "categories",
        summary: {
          created: 1,
          skipped: 2,
          failed: 0,
        },
        results: [
          {
            row: 2,
            status: "created",
            name: "Packaging",
            message: "Created category record.",
          },
          {
            row: 3,
            status: "skipped",
            name: "Existing Category",
            message: "Already exists in this workspace.",
          },
          {
            row: 4,
            status: "skipped",
            name: "Packaging",
            message: "Duplicate name already appears earlier in this workbook.",
          },
        ],
      });
      expect(prismaMock.category.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.category.create).toHaveBeenCalledWith({
        data: {
          organizationId: "org-1",
          name: "Packaging",
          annualTarget: 0,
        },
      });
    });
  });

  describe("app/api/upload/evidence/route.ts", () => {
    it("returns 401 JSON for unauthenticated uploads", async () => {
      requireUserMock.mockRejectedValueOnce(
        new MockAuthGuardError(
          "Authenticated session is required.",
          401,
          "UNAUTHENTICATED"
        )
      );

      const response = await postEvidenceUploadRoute(
        createFormDataRequest(createUploadForm({ savingCardId: "card-1", files: [createWorkbookFile("pdf", "evidence.pdf", "application/pdf")] }))
      );

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({
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

      expect(enforceRateLimitMock).toHaveBeenCalledWith({
        policy: "evidenceUpload",
        request: expect.any(Object),
        userId: "user-1",
        organizationId: "org-1",
        action: "evidence.upload",
      });
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

    it("allows participant uploads only through stakeholder or approver access", async () => {
      requireUserMock.mockResolvedValueOnce({
        id: "user-1",
        name: "Test User",
        email: "user@example.com",
        role: Role.TACTICAL_BUYER,
        organizationId: "org-1",
      });
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

      expect(prismaMock.savingCard.findFirst).toHaveBeenCalledWith({
        where: {
          id: "card-1",
          organizationId: "org-1",
          OR: [
            { stakeholders: { some: { userId: "user-1" } } },
            { approvals: { some: { approverId: "user-1" } } },
          ],
        },
        select: {
          id: true,
          organizationId: true,
        },
      });
      expect(response.status).toBe(201);
    });
  });

  describe("app/api/evidence/[id]/download/route.ts", () => {
    it("returns 401 JSON for unauthenticated download requests", async () => {
      requireUserMock.mockRejectedValueOnce(
        new MockAuthGuardError(
          "Authenticated session is required.",
          401,
          "UNAUTHENTICATED"
        )
      );

      const response = await getEvidenceDownloadRoute(new Request("http://localhost"), {
        params: Promise.resolve({ id: "evidence-1" }),
      });

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({
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

    it("requires participant access before creating a signed download URL", async () => {
      requireUserMock.mockResolvedValueOnce({
        id: "user-1",
        name: "Test User",
        email: "user@example.com",
        role: Role.TACTICAL_BUYER,
        organizationId: "org-1",
      });
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

      expect(prismaMock.savingCardEvidence.findFirst).toHaveBeenCalledWith({
        where: {
          id: "evidence-1",
          savingCard: {
            organizationId: "org-1",
            OR: [
              { stakeholders: { some: { userId: "user-1" } } },
              { approvals: { some: { approverId: "user-1" } } },
            ],
          },
        },
        select: {
          id: true,
          fileName: true,
          savingCardId: true,
          storageBucket: true,
          storagePath: true,
          uploadedById: true,
        },
      });
      expect(response.status).toBe(307);
    });
  });
});
