import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_ORGANIZATION_ID,
  DEFAULT_USER_ID,
  MockAuthGuardError,
  createAdminUser,
  createAuthGuardJsonResponse,
} from "../helpers/security-fixtures";

const redirectMock = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  })
);

const requirePermissionMock = vi.hoisted(() => vi.fn());
const getWorkspaceReadinessMock = vi.hoisted(() => vi.fn());
const getReferenceDataMock = vi.hoisted(() => vi.fn());
const importSavingCardsMock = vi.hoisted(() => vi.fn());
const xlsxReadMock = vi.hoisted(() => vi.fn());
const sheetToJsonMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/auth", () => ({
  requirePermission: requirePermissionMock,
  isAuthGuardError: (error: unknown) => error instanceof MockAuthGuardError,
  createAuthGuardErrorResponse: createAuthGuardJsonResponse,
}));

vi.mock("@/lib/data", () => ({
  getWorkspaceReadiness: getWorkspaceReadinessMock,
  getReferenceData: getReferenceDataMock,
  importSavingCards: importSavingCardsMock,
}));

vi.mock("xlsx", () => ({
  read: xlsxReadMock,
  utils: {
    sheet_to_json: sheetToJsonMock,
  },
}));

import AdminPage from "@/app/(app)/admin/page";
import { POST as postImportRoute } from "@/app/api/import/route";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

function createWorkspaceReadiness() {
  return {
    workspace: {
      id: "workspace-1",
      name: "Acme Workspace",
      slug: "acme",
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
      updatedAt: new Date("2025-01-02T00:00:00.000Z"),
    },
    counts: {
      users: 3,
      buyers: 2,
      suppliers: 2,
      materials: 2,
      categories: 2,
      plants: 1,
      businessUnits: 1,
      savingCards: 4,
    },
    masterData: [
      {
        key: "buyers",
        label: "Buyers",
        count: 2,
        ready: true,
        description: "Commercial ownership for saving cards.",
      },
      {
        key: "suppliers",
        label: "Suppliers",
        count: 2,
        ready: true,
        description: "Baseline and alternative sourcing counterparties.",
      },
      {
        key: "materials",
        label: "Materials",
        count: 2,
        ready: true,
        description: "Material or part master records for sourcing cases.",
      },
      {
        key: "categories",
        label: "Categories",
        count: 2,
        ready: true,
        description: "Category ownership and savings target structure.",
      },
      {
        key: "plants",
        label: "Plants",
        count: 1,
        ready: true,
        description: "Operational scope for plant-level initiatives.",
      },
      {
        key: "businessUnits",
        label: "Business Units",
        count: 1,
        ready: true,
        description: "Reporting and accountability structure.",
      },
    ],
    workflowCoverage: [
      {
        key: "HEAD_OF_GLOBAL_PROCUREMENT",
        label: "Head of Global Procurement",
        count: 1,
        ready: true,
      },
      {
        key: "GLOBAL_CATEGORY_LEADER",
        label: "Global Category Leader",
        count: 1,
        ready: true,
      },
      {
        key: "FINANCIAL_CONTROLLER",
        label: "Financial Controller",
        count: 1,
        ready: true,
      },
    ],
    coverage: {
      masterDataReadyCount: 6,
      masterDataTotal: 6,
      workflowReadyCount: 3,
      workflowTotal: 3,
      overallPercent: 100,
    },
    activity: {
      firstSavingCardCreatedAt: new Date("2025-01-03T00:00:00.000Z"),
      lastPortfolioUpdateAt: new Date("2025-01-04T00:00:00.000Z"),
    },
    isMasterDataReady: true,
    isWorkflowReady: true,
    isWorkspaceReady: true,
    missingCoreSetup: [],
    missingWorkflowCoverage: [],
  };
}

function createReferenceData() {
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

function createWorkbookFile(content = "sheet-bytes", name = "cards.xlsx", type =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
  return new File([content], name, { type });
}

function createImportForm(file?: File) {
  const formData = new FormData();

  if (file) {
    formData.set("file", file);
  }

  return formData;
}

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

describe("admin RBAC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermissionMock.mockResolvedValue(createAdminUser());
    getWorkspaceReadinessMock.mockResolvedValue(createWorkspaceReadiness());
    getReferenceDataMock.mockResolvedValue(createReferenceData());
    importSavingCardsMock.mockResolvedValue(undefined);
    xlsxReadMock.mockReturnValue({
      SheetNames: ["Sheet1"],
      Sheets: {
        Sheet1: {},
      },
    });
    sheetToJsonMock.mockReturnValue([
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
  });

  it("blocks normal users from the admin page", async () => {
    requirePermissionMock.mockRejectedValueOnce(
      new MockAuthGuardError("Forbidden", 403, "FORBIDDEN")
    );

    await expect(AdminPage()).rejects.toThrow("NEXT_REDIRECT:/dashboard");

    expect(requirePermissionMock).toHaveBeenCalledWith("manageWorkspace");
    expect(getWorkspaceReadinessMock).not.toHaveBeenCalled();
  });

  it("blocks normal users from admin-only APIs with a 403 response", async () => {
    requirePermissionMock.mockRejectedValueOnce(
      new MockAuthGuardError("Forbidden", 403, "FORBIDDEN")
    );

    const response = await postImportRoute(
      createFormDataRequest(createImportForm(createWorkbookFile()))
    );

    expect(requirePermissionMock).toHaveBeenCalledWith("manageWorkspace", {
      redirectTo: null,
    });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Forbidden." });
    expect(importSavingCardsMock).not.toHaveBeenCalled();
  });

  it("allows an admin role to open the admin page", async () => {
    const page = await AdminPage();

    expect(page).toBeTruthy();
    expect(requirePermissionMock).toHaveBeenCalledWith("manageWorkspace");
    expect(getWorkspaceReadinessMock).toHaveBeenCalledWith(DEFAULT_ORGANIZATION_ID);
  });

  it("allows an admin role to call admin-only APIs", async () => {
    const response = await postImportRoute(
      createFormDataRequest(createImportForm(createWorkbookFile()))
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ count: 1 });
    expect(importSavingCardsMock).toHaveBeenCalledWith(
      expect.arrayContaining([
      expect.objectContaining({
          title: "Resin renegotiation",
        }),
      ]),
      DEFAULT_USER_ID,
      DEFAULT_ORGANIZATION_ID
    );
  });
});
