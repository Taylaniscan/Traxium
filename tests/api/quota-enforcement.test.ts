import {
  MembershipStatus,
  OrganizationRole,
  Role,
  UsageFeature,
  UsageWindow,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_ORGANIZATION_ID,
  DEFAULT_USER_ID,
  OTHER_ORGANIZATION_ID,
  createSessionUser,
} from "../helpers/security-fixtures";

const getCurrentUserMock = vi.hoisted(() => vi.fn());
const requirePermissionMock = vi.hoisted(() => vi.fn());
const requireOrganizationMock = vi.hoisted(() => vi.fn());
const createAuthGuardErrorResponseMock = vi.hoisted(() => vi.fn());
const createSavingCardMock = vi.hoisted(() => vi.fn());
const getReferenceDataMock = vi.hoisted(() => vi.fn());
const importSavingCardsMock = vi.hoisted(() => vi.fn());
const createOrganizationInvitationMock = vi.hoisted(() => vi.fn());
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
        readonly feature: UsageFeature,
        readonly remaining: number,
        readonly requestedQuantity: number,
        readonly status = 429
      ) {
        super(message);
        this.name = "UsageQuotaExceededError";
      }
    }
);
const prismaMock = vi.hoisted(() => ({
  savingCard: {
    findFirst: vi.fn(),
  },
  savingCardEvidence: {
    create: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
}));
const storeEvidenceFileMock = vi.hoisted(() => vi.fn());
const xlsxReadMock = vi.hoisted(() => vi.fn());
const sheetToJsonMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  getCurrentUser: getCurrentUserMock,
  requirePermission: requirePermissionMock,
  requireOrganization: requireOrganizationMock,
  createAuthGuardErrorResponse: createAuthGuardErrorResponseMock,
}));

vi.mock("@/lib/data", () => ({
  createSavingCard: createSavingCardMock,
  getReferenceData: getReferenceDataMock,
  importSavingCards: importSavingCardsMock,
}));

vi.mock("@/lib/invitations", () => ({
  createOrganizationInvitation: createOrganizationInvitationMock,
  InvitationError: class InvitationError extends Error {
    constructor(message: string, readonly status = 400) {
      super(message);
      this.name = "InvitationError";
    }
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

vi.mock("@/lib/observability", () => ({
  captureException: vi.fn(),
  createRouteObservabilityContext: vi.fn(() => ({})),
  trackServerEvent: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/uploads", () => ({
  storeEvidenceFile: storeEvidenceFileMock,
}));

vi.mock("xlsx", () => ({
  read: xlsxReadMock,
  utils: {
    sheet_to_json: sheetToJsonMock,
  },
}));

import { POST as postSavingCardsRoute } from "@/app/api/saving-cards/route";
import { POST as postImportRoute } from "@/app/api/import/route";
import { POST as postEvidenceUploadRoute } from "@/app/api/upload/evidence/route";
import { POST as postInvitationRoute } from "@/app/api/invitations/route";

function createJsonRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function createFormDataRequest(formData: FormData) {
  return {
    formData: vi.fn().mockResolvedValue(formData),
  } as unknown as Request;
}

function createWorkbookFile(
  content = "sheet-bytes",
  name = "cards.xlsx",
  type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
) {
  return new File([content], name, { type });
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

function createValidSavingCardPayload() {
  return {
    title: "Resin renegotiation",
    description: "Renegotiate the resin packaging contract for margin improvement.",
    savingType: "Cost reduction",
    phase: "IDEA",
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
    currency: "EUR",
    fxRate: 1.1,
    frequency: "RECURRING",
    savingDriver: "Negotiation",
    implementationComplexity: "Medium",
    qualificationStatus: "Not Started",
    startDate: "2025-01-01T00:00:00.000Z",
    endDate: "2025-12-31T00:00:00.000Z",
    impactStartDate: "2025-02-01T00:00:00.000Z",
    impactEndDate: "2025-12-31T00:00:00.000Z",
    cancellationReason: "",
    stakeholderIds: ["stakeholder-1"],
    evidence: [],
  };
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

function createInvitationResult(organizationId: string, invitationId: string) {
  return {
    invitation: {
      id: invitationId,
      organizationId,
      email: "new.member@example.com",
      role: OrganizationRole.MEMBER,
      token: `${invitationId}-token`,
      status: "PENDING",
      expiresAt: new Date("2026-04-03T12:00:00.000Z"),
      invitedByUserId: DEFAULT_USER_ID,
      createdAt: new Date("2026-03-27T12:00:00.000Z"),
      updatedAt: new Date("2026-03-27T12:00:00.000Z"),
      organization: {
        id: organizationId,
        name: organizationId === DEFAULT_ORGANIZATION_ID ? "Atlas Procurement" : "Other Workspace",
        slug: organizationId === DEFAULT_ORGANIZATION_ID ? "atlas-procurement" : "other-workspace",
      },
      invitedBy: {
        id: DEFAULT_USER_ID,
        name: "Admin User",
        email: "admin@example.com",
      },
    },
    delivery: {
      transport: "job-queued",
      state: "queued",
      jobId: `${invitationId}-job`,
    },
  };
}

function createOrganizationAdmin(organizationId: string) {
  return createSessionUser({
    id: DEFAULT_USER_ID,
    name: "Admin User",
    email: "admin@example.com",
    role: Role.HEAD_OF_GLOBAL_PROCUREMENT,
    organizationId,
    activeOrganizationId: organizationId,
    activeOrganization: {
      membershipId: `membership-${organizationId}`,
      organizationId,
      membershipRole: OrganizationRole.ADMIN,
      membershipStatus: MembershipStatus.ACTIVE,
    },
  });
}

describe("quota enforcement routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const currentUser = {
      id: DEFAULT_USER_ID,
      name: "Workflow User",
      email: "user@example.com",
      role: Role.GLOBAL_CATEGORY_LEADER,
      organizationId: DEFAULT_ORGANIZATION_ID,
    };

    getCurrentUserMock.mockResolvedValue(currentUser);
    requirePermissionMock.mockResolvedValue(currentUser);
    requireOrganizationMock.mockResolvedValue(
      createOrganizationAdmin(DEFAULT_ORGANIZATION_ID)
    );
    createAuthGuardErrorResponseMock.mockReturnValue(null);

    enforceRateLimitMock.mockResolvedValue(undefined);
    createRateLimitErrorResponseMock.mockImplementation((error: { message: string; status?: number }) =>
      Response.json(
        { error: error.message, code: "RATE_LIMITED" },
        { status: error.status ?? 429 }
      )
    );
    enforceUsageQuotaMock.mockResolvedValue(undefined);
    recordUsageEventMock.mockResolvedValue(undefined);

    createSavingCardMock.mockResolvedValue({
      id: "card-1",
      title: "Resin renegotiation",
    });
    getReferenceDataMock.mockResolvedValue(buildReferenceData());
    importSavingCardsMock.mockResolvedValue(undefined);
    createOrganizationInvitationMock.mockResolvedValue(
      createInvitationResult(DEFAULT_ORGANIZATION_ID, "invite-1")
    );

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
      {
        Title: "Label stock harmonization",
        Description: "Reduce packaging complexity.",
        Supplier: "Supplier A",
        Material: "PET Resin",
        Category: "Packaging",
        Plant: "Amsterdam",
        BusinessUnit: "Beverages",
        Buyer: "Strategic Buyer",
        BaselinePrice: 11,
        NewPrice: 9,
        AnnualVolume: 120,
        Currency: "EUR",
        FxRate: 1.1,
        Frequency: "RECURRING",
        StartDate: "2025-01-01",
        EndDate: "2025-12-31",
        ImpactStartDate: "2025-02-01",
        ImpactEndDate: "2025-12-31",
      },
    ]);

    prismaMock.savingCard.findFirst.mockResolvedValue({
      id: "card-1",
      organizationId: DEFAULT_ORGANIZATION_ID,
    });
    prismaMock.savingCardEvidence.create.mockResolvedValue({
      id: "evidence-1",
      fileName: "evidence.pdf",
      fileSize: 5,
      fileType: "application/pdf",
      uploadedAt: "2025-01-01T00:00:00.000Z",
    });
    prismaMock.auditLog.create.mockResolvedValue({});
    storeEvidenceFileMock.mockResolvedValue({
      fileName: "evidence.pdf",
      storageBucket: "evidence-private",
      storagePath:
        "organizations/org-1/saving-cards/card-1/evidence/evidence.pdf",
      fileSize: 5,
      fileType: "application/pdf",
    });
  });

  it("rejects saving card creation when the workspace quota is exhausted", async () => {
    enforceUsageQuotaMock.mockRejectedValueOnce(
      new UsageQuotaExceededErrorMock(
        "Saving card quota exceeded for the current period.",
        UsageFeature.SAVING_CARDS,
        0,
        1
      )
    );

    const response = await postSavingCardsRoute(
      createJsonRequest("http://localhost/api/saving-cards", createValidSavingCardPayload())
    );

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      error: "Saving card quota exceeded for the current period.",
    });
    expect(createSavingCardMock).not.toHaveBeenCalled();
    expect(recordUsageEventMock).not.toHaveBeenCalled();
  });

  it("allows imports while quota is available and records the imported usage quantity", async () => {
    const response = await postImportRoute(
      createFormDataRequest(createImportForm(createWorkbookFile()))
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ count: 2 });
    expect(enforceUsageQuotaMock).toHaveBeenCalledWith({
      organizationId: DEFAULT_ORGANIZATION_ID,
      feature: UsageFeature.SAVING_CARDS,
      window: UsageWindow.MONTH,
      requestedQuantity: 2,
      message: "This import would exceed the saving card quota for the current period.",
    });
    expect(importSavingCardsMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Resin renegotiation",
        }),
        expect.objectContaining({
          title: "Label stock harmonization",
        }),
      ]),
      DEFAULT_USER_ID,
      DEFAULT_ORGANIZATION_ID
    );
    expect(recordUsageEventMock).toHaveBeenCalledWith({
      organizationId: DEFAULT_ORGANIZATION_ID,
      feature: UsageFeature.SAVING_CARDS,
      quantity: 2,
      window: UsageWindow.MONTH,
      source: "api.saving_cards.import",
      reason: "xlsx_import",
      metadata: {
        importedCount: 2,
        actorUserId: DEFAULT_USER_ID,
      },
    });
  });

  it("rejects evidence uploads when the workspace quota is exhausted", async () => {
    enforceUsageQuotaMock.mockRejectedValueOnce(
      new UsageQuotaExceededErrorMock(
        "This upload would exceed the evidence upload quota for the current period.",
        UsageFeature.EVIDENCE_UPLOADS,
        0,
        1
      )
    );

    const response = await postEvidenceUploadRoute(
      createFormDataRequest(
        createUploadForm({
          savingCardId: "card-1",
          files: [createWorkbookFile("pdf", "evidence.pdf", "application/pdf")],
        })
      )
    );

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "This upload would exceed the evidence upload quota for the current period.",
    });
    expect(storeEvidenceFileMock).not.toHaveBeenCalled();
    expect(recordUsageEventMock).not.toHaveBeenCalled();
  });

  it("records evidence upload usage after a successful upload", async () => {
    const response = await postEvidenceUploadRoute(
      createFormDataRequest(
        createUploadForm({
          savingCardId: "card-1",
          files: [createWorkbookFile("pdf", "evidence.pdf", "application/pdf")],
        })
      )
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
    expect(enforceUsageQuotaMock).toHaveBeenCalledWith({
      organizationId: DEFAULT_ORGANIZATION_ID,
      feature: UsageFeature.EVIDENCE_UPLOADS,
      window: UsageWindow.MONTH,
      requestedQuantity: 1,
      message:
        "This upload would exceed the evidence upload quota for the current period.",
    });
    expect(recordUsageEventMock).toHaveBeenCalledWith({
      organizationId: DEFAULT_ORGANIZATION_ID,
      feature: UsageFeature.EVIDENCE_UPLOADS,
      quantity: 1,
      window: UsageWindow.MONTH,
      source: "api.evidence.upload",
      reason: "attachment_upload",
      metadata: {
        savingCardId: "card-1",
        uploadedByUserId: DEFAULT_USER_ID,
        fileCount: 1,
      },
    });
  });

  it("keeps invitation quotas isolated per organization", async () => {
    requireOrganizationMock
      .mockResolvedValueOnce(createOrganizationAdmin(DEFAULT_ORGANIZATION_ID))
      .mockResolvedValueOnce(createOrganizationAdmin(OTHER_ORGANIZATION_ID));
    createOrganizationInvitationMock
      .mockResolvedValueOnce(
        createInvitationResult(DEFAULT_ORGANIZATION_ID, "invite-1")
      )
      .mockResolvedValueOnce(
        createInvitationResult(OTHER_ORGANIZATION_ID, "invite-2")
      );

    const firstResponse = await postInvitationRoute(
      createJsonRequest("http://localhost/api/invitations", {
        email: "new.member@example.com",
        role: "MEMBER",
      })
    );
    const secondResponse = await postInvitationRoute(
      createJsonRequest("http://localhost/api/invitations", {
        email: "other.member@example.com",
        role: "MEMBER",
      })
    );

    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(201);
    expect(enforceUsageQuotaMock).toHaveBeenNthCalledWith(1, {
      organizationId: DEFAULT_ORGANIZATION_ID,
      feature: UsageFeature.INVITATIONS_SENT,
      window: UsageWindow.MONTH,
      requestedQuantity: 1,
      message: "Invitation quota exceeded for the current period.",
    });
    expect(enforceUsageQuotaMock).toHaveBeenNthCalledWith(2, {
      organizationId: OTHER_ORGANIZATION_ID,
      feature: UsageFeature.INVITATIONS_SENT,
      window: UsageWindow.MONTH,
      requestedQuantity: 1,
      message: "Invitation quota exceeded for the current period.",
    });
    expect(recordUsageEventMock).toHaveBeenNthCalledWith(1, {
      organizationId: DEFAULT_ORGANIZATION_ID,
      feature: UsageFeature.INVITATIONS_SENT,
      quantity: 1,
      window: UsageWindow.MONTH,
      source: "api.invitations.create",
      reason: "member_invitation",
      metadata: {
        invitationId: "invite-1",
        invitedByUserId: DEFAULT_USER_ID,
        role: OrganizationRole.MEMBER,
      },
    });
    expect(recordUsageEventMock).toHaveBeenNthCalledWith(2, {
      organizationId: OTHER_ORGANIZATION_ID,
      feature: UsageFeature.INVITATIONS_SENT,
      quantity: 1,
      window: UsageWindow.MONTH,
      source: "api.invitations.create",
      reason: "member_invitation",
      metadata: {
        invitationId: "invite-2",
        invitedByUserId: DEFAULT_USER_ID,
        role: OrganizationRole.MEMBER,
      },
    });
  });
});
