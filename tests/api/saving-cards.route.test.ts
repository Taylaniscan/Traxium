import { Phase, Role } from "@prisma/client";
import { ZodError } from "zod";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MockAuthGuardError,
  createAuthGuardJsonResponse,
} from "../helpers/security-fixtures";

const requireUserMock = vi.hoisted(() => vi.fn());
const createAuthGuardErrorResponseMock = vi.hoisted(() => vi.fn());
const getSavingCardsMock = vi.hoisted(() => vi.fn());
const createSavingCardMock = vi.hoisted(() => vi.fn());
const getSavingCardMock = vi.hoisted(() => vi.fn());
const updateSavingCardMock = vi.hoisted(() => vi.fn());
const setFinanceLockMock = vi.hoisted(() => vi.fn());
const createAlternativeSupplierMock = vi.hoisted(() => vi.fn());
const updateAlternativeSupplierMock = vi.hoisted(() => vi.fn());
const deleteAlternativeSupplierMock = vi.hoisted(() => vi.fn());
const createAlternativeMaterialMock = vi.hoisted(() => vi.fn());
const updateAlternativeMaterialMock = vi.hoisted(() => vi.fn());
const deleteAlternativeMaterialMock = vi.hoisted(() => vi.fn());
const canLockFinanceMock = vi.hoisted(() => vi.fn());
const WorkflowErrorMock = vi.hoisted(
  () =>
    class WorkflowError extends Error {
      status: number;

      constructor(message: string, status = 400) {
        super(message);
        this.name = "WorkflowError";
        this.status = status;
      }
    }
);
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

vi.mock("@/lib/auth", () => ({
  requireUser: requireUserMock,
  createAuthGuardErrorResponse: createAuthGuardErrorResponseMock,
}));

vi.mock("@/lib/data", () => ({
  getSavingCards: getSavingCardsMock,
  createSavingCard: createSavingCardMock,
  getSavingCard: getSavingCardMock,
  updateSavingCard: updateSavingCardMock,
  setFinanceLock: setFinanceLockMock,
  createAlternativeSupplier: createAlternativeSupplierMock,
  updateAlternativeSupplier: updateAlternativeSupplierMock,
  deleteAlternativeSupplier: deleteAlternativeSupplierMock,
  createAlternativeMaterial: createAlternativeMaterialMock,
  updateAlternativeMaterial: updateAlternativeMaterialMock,
  deleteAlternativeMaterial: deleteAlternativeMaterialMock,
  WorkflowError: WorkflowErrorMock,
}));

vi.mock("@/lib/permissions", () => ({
  canLockFinance: canLockFinanceMock,
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

import { GET as getSavingCardsRoute, POST as postSavingCardsRoute } from "@/app/api/saving-cards/route";
import {
  PATCH as patchSavingCardRoute,
  POST as postSavingCardActionRoute,
  PUT as putSavingCardRoute,
} from "@/app/api/saving-cards/[id]/route";
import { POST as postAlternativeSupplierRoute } from "@/app/api/saving-cards/[id]/alternative-suppliers/route";
import {
  DELETE as deleteAlternativeSupplierRoute,
  PUT as putAlternativeSupplierRoute,
} from "@/app/api/saving-cards/[id]/alternative-suppliers/[alternativeId]/route";
import { POST as postAlternativeMaterialRoute } from "@/app/api/saving-cards/[id]/alternative-materials/route";
import {
  DELETE as deleteAlternativeMaterialRoute,
  PUT as putAlternativeMaterialRoute,
} from "@/app/api/saving-cards/[id]/alternative-materials/[alternativeId]/route";

function createValidSavingCardPayload(overrides?: Partial<Record<string, unknown>>) {
  return {
    title: "Resin renegotiation",
    description: "Renegotiate the resin packaging contract for margin improvement.",
    savingType: "Cost reduction",
    phase: Phase.IDEA,
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
    ...overrides,
  };
}

function createAlternativeSupplierPayload(overrides?: Partial<Record<string, unknown>>) {
  return {
    supplier: { name: "Supplier B" },
    country: "DE",
    quotedPrice: 7.5,
    currency: "EUR",
    leadTimeDays: 14,
    moq: 100,
    paymentTerms: "60 days",
    qualityRating: "AA",
    riskLevel: "Medium",
    notes: "Qualified backup supplier",
    isSelected: false,
    ...overrides,
  };
}

function createAlternativeMaterialPayload(overrides?: Partial<Record<string, unknown>>) {
  return {
    material: { name: "Recycled PET" },
    supplier: { name: "Supplier B" },
    specification: "Food grade",
    quotedPrice: 6.25,
    currency: "EUR",
    performanceImpact: "Neutral",
    qualificationStatus: "Approved",
    riskLevel: "Low",
    notes: "Validated material option",
    isSelected: false,
    ...overrides,
  };
}

function createJsonRequest(url: string, method: string, body: unknown) {
  return new Request(url, {
    method,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("saving card API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({
      id: "user-1",
      name: "Workflow User",
      email: "user@example.com",
      role: Role.GLOBAL_CATEGORY_LEADER,
      organizationId: "org-1",
    });
    createAuthGuardErrorResponseMock.mockImplementation(createAuthGuardJsonResponse);
    canLockFinanceMock.mockReturnValue(true);
    enforceRateLimitMock.mockResolvedValue(undefined);
    createRateLimitErrorResponseMock.mockImplementation((error: { message: string; status?: number }) =>
      Response.json(
        { error: error.message, code: "RATE_LIMITED" },
        { status: error.status ?? 429 }
      )
    );
    enforceUsageQuotaMock.mockResolvedValue(undefined);
    recordUsageEventMock.mockResolvedValue(undefined);
  });

  describe("app/api/saving-cards/route.ts", () => {
    it("returns 401 JSON for unauthenticated GET requests", async () => {
      requireUserMock.mockRejectedValueOnce(
        new MockAuthGuardError(
          "Authenticated session is required.",
          401,
          "UNAUTHENTICATED"
        )
      );

      const response = await getSavingCardsRoute();

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
      expect(getSavingCardsMock).not.toHaveBeenCalled();
    });

    it("returns 402 JSON for billing-blocked GET requests", async () => {
      requireUserMock.mockRejectedValueOnce(
        new MockAuthGuardError(
          "Your workspace subscription is past due. Update billing before product access can continue.",
          402,
          "BILLING_REQUIRED",
          {
            accessState: "blocked_past_due",
            reasonCode: "past_due_blocked",
          }
        )
      );

      const response = await getSavingCardsRoute();

      expect(response.status).toBe(402);
      await expect(response.json()).resolves.toEqual({
        error:
          "Your workspace subscription is past due. Update billing before product access can continue.",
        code: "BILLING_REQUIRED",
        accessState: "blocked_past_due",
        reasonCode: "past_due_blocked",
        billingRequiredPath: "/billing-required",
      });
      expect(getSavingCardsMock).not.toHaveBeenCalled();
    });

    it("returns 400 for POST requests with invalid JSON", async () => {
      const request = new Request("http://localhost/api/saving-cards", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: "{",
      });

      const response = await postSavingCardsRoute(request);

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "Request body must be valid JSON.",
      });
      expect(createSavingCardMock).not.toHaveBeenCalled();
    });

    it("returns 422 for invalid saving card payloads", async () => {
      const response = await postSavingCardsRoute(
        createJsonRequest("http://localhost/api/saving-cards", "POST", {})
      );

      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({
          error: expect.any(String),
        })
      );
      expect(createSavingCardMock).not.toHaveBeenCalled();
    });

    it.each([
      [
        "zero baseline price",
        { baselinePrice: 0 },
        "Baseline price must be greater than zero.",
      ],
      [
        "negative new price",
        { newPrice: -1 },
        "New price must be zero or greater.",
      ],
      [
        "zero annual volume",
        { annualVolume: 0 },
        "Annual volume must be greater than zero.",
      ],
      [
        "zero FX rate",
        { fxRate: 0 },
        "FX rate must be greater than zero.",
      ],
    ])("returns 422 for %s", async (_label, overrides, expectedError) => {
      const response = await postSavingCardsRoute(
        createJsonRequest(
          "http://localhost/api/saving-cards",
          "POST",
          createValidSavingCardPayload(overrides)
        )
      );

      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toEqual({
        error: expectedError,
      });
      expect(createSavingCardMock).not.toHaveBeenCalled();
    });

    it("returns 201 with the created card for valid POST requests", async () => {
      createSavingCardMock.mockResolvedValueOnce({
        id: "card-1",
        title: "Resin renegotiation",
        buyer: { id: "buyer-1", name: "Strategic Buyer" },
      });

      const payload = createValidSavingCardPayload();
      const response = await postSavingCardsRoute(
        createJsonRequest("http://localhost/api/saving-cards", "POST", payload)
      );

      expect(createSavingCardMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Resin renegotiation",
          buyer: { name: "Strategic Buyer" },
        }),
        "user-1",
        "org-1"
      );
      expect(response.status).toBe(201);
      await expect(response.json()).resolves.toEqual({
        id: "card-1",
        title: "Resin renegotiation",
        buyer: { id: "buyer-1", name: "Strategic Buyer" },
      });
    });

    it("returns workflow conflicts from the create flow", async () => {
      createSavingCardMock.mockRejectedValueOnce(
        new WorkflowErrorMock("New saving cards must start in IDEA phase.", 409)
      );

      const response = await postSavingCardsRoute(
        createJsonRequest(
          "http://localhost/api/saving-cards",
          "POST",
          createValidSavingCardPayload({ phase: Phase.VALIDATED })
        )
      );

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toEqual({
        error: "New saving cards must start in IDEA phase.",
      });
    });
  });

  describe("app/api/saving-cards/[id]/route.ts", () => {
    it("returns 422 for invalid PUT payloads", async () => {
      const response = await putSavingCardRoute(
        createJsonRequest("http://localhost/api/saving-cards/card-1", "PUT", {}),
        { params: Promise.resolve({ id: "card-1" }) }
      );

      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({
          error: expect.any(String),
        })
      );
      expect(updateSavingCardMock).not.toHaveBeenCalled();
    });

    it("returns 409 for direct phase update attempts on an existing card", async () => {
      getSavingCardMock.mockResolvedValueOnce({ id: "card-1", title: "Resin renegotiation" });

      const response = await patchSavingCardRoute(new Request("http://localhost/api/saving-cards/card-1"), {
        params: Promise.resolve({ id: "card-1" }),
      });

      expect(getSavingCardMock).toHaveBeenCalledWith("card-1", "org-1");
      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toEqual({
        error:
          "Direct phase updates are disabled. Use /api/phase-change-request to request workflow approval.",
      });
    });

    it("returns workflow conflicts when PUT payloads attempt to force a phase jump", async () => {
      getSavingCardMock.mockResolvedValueOnce({ id: "card-1", title: "Resin renegotiation" });
      updateSavingCardMock.mockRejectedValueOnce(
        new WorkflowErrorMock(
          "Direct phase updates are disabled. Use /api/phase-change-request to request workflow approval.",
          409
        )
      );

      const response = await putSavingCardRoute(
        createJsonRequest(
          "http://localhost/api/saving-cards/card-1",
          "PUT",
          createValidSavingCardPayload({ phase: Phase.REALISED })
        ),
        { params: Promise.resolve({ id: "card-1" }) }
      );

      expect(updateSavingCardMock).toHaveBeenCalledWith(
        "card-1",
        expect.objectContaining({ phase: Phase.REALISED }),
        "user-1",
        "org-1"
      );
      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toEqual({
        error:
          "Direct phase updates are disabled. Use /api/phase-change-request to request workflow approval.",
      });
    });

    it("returns 409 when direct approve actions are disabled", async () => {
      getSavingCardMock.mockResolvedValueOnce({ id: "card-1", title: "Resin renegotiation" });

      const response = await postSavingCardActionRoute(
        createJsonRequest("http://localhost/api/saving-cards/card-1", "POST", {
          action: "approve",
          phase: Phase.VALIDATED,
          comment: "Approve",
        }),
        { params: Promise.resolve({ id: "card-1" }) }
      );

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toEqual({
        error:
          "Direct approval actions are disabled. Use /api/approve-phase-change for assigned workflow requests.",
      });
    });

    it("returns 422 for invalid action payloads", async () => {
      const response = await postSavingCardActionRoute(
        createJsonRequest("http://localhost/api/saving-cards/card-1", "POST", {
          action: "approve",
          comment: "Missing phase",
        }),
        { params: Promise.resolve({ id: "card-1" }) }
      );

      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({
          error: expect.any(String),
        })
      );
    });

    it("returns workflow conflicts from finance lock mutations", async () => {
      getSavingCardMock.mockResolvedValueOnce({ id: "card-1", title: "Resin renegotiation" });
      setFinanceLockMock.mockRejectedValueOnce(
        new WorkflowErrorMock("Finance lock can only be enabled for validated savings.", 409)
      );

      const response = await postSavingCardActionRoute(
        createJsonRequest("http://localhost/api/saving-cards/card-1", "POST", {
          action: "finance-lock",
          locked: true,
        }),
        { params: Promise.resolve({ id: "card-1" }) }
      );

      expect(setFinanceLockMock).toHaveBeenCalledWith("card-1", "user-1", true, "org-1");
      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toEqual({
        error: "Finance lock can only be enabled for validated savings.",
      });
    });
  });

  describe("alternative scenario routes", () => {
    it("creates alternative supplier and material scenarios through the active tenant", async () => {
      createAlternativeSupplierMock.mockResolvedValueOnce({ id: "alt-supplier-1" });
      createAlternativeMaterialMock.mockResolvedValueOnce({ id: "alt-material-1" });

      const supplierPayload = createAlternativeSupplierPayload();
      const supplierResponse = await postAlternativeSupplierRoute(
        createJsonRequest(
          "http://localhost/api/saving-cards/card-1/alternative-suppliers",
          "POST",
          supplierPayload
        ),
        { params: Promise.resolve({ id: "card-1" }) }
      );

      const materialPayload = createAlternativeMaterialPayload();
      const materialResponse = await postAlternativeMaterialRoute(
        createJsonRequest(
          "http://localhost/api/saving-cards/card-1/alternative-materials",
          "POST",
          materialPayload
        ),
        { params: Promise.resolve({ id: "card-1" }) }
      );

      expect(createAlternativeSupplierMock).toHaveBeenCalledWith(
        "card-1",
        supplierPayload,
        "user-1",
        "org-1"
      );
      expect(createAlternativeMaterialMock).toHaveBeenCalledWith(
        "card-1",
        materialPayload,
        "user-1",
        "org-1"
      );
      expect(supplierResponse.status).toBe(201);
      expect(materialResponse.status).toBe(201);
    });

    it("binds alternative supplier mutations to the route saving-card id", async () => {
      updateAlternativeSupplierMock.mockResolvedValueOnce({ id: "alt-supplier-1" });
      deleteAlternativeSupplierMock.mockResolvedValueOnce({ id: "alt-supplier-1" });

      const payload = createAlternativeSupplierPayload({
        isSelected: true,
      });
      const updateResponse = await putAlternativeSupplierRoute(
        createJsonRequest(
          "http://localhost/api/saving-cards/card-1/alternative-suppliers/alt-supplier-1",
          "PUT",
          payload
        ),
        { params: Promise.resolve({ id: "card-1", alternativeId: "alt-supplier-1" }) }
      );
      const deleteResponse = await deleteAlternativeSupplierRoute(
        new Request("http://localhost/api/saving-cards/card-1/alternative-suppliers/alt-supplier-1"),
        { params: Promise.resolve({ id: "card-1", alternativeId: "alt-supplier-1" }) }
      );

      expect(updateAlternativeSupplierMock).toHaveBeenCalledWith(
        "alt-supplier-1",
        payload,
        "user-1",
        "org-1",
        "card-1"
      );
      expect(deleteAlternativeSupplierMock).toHaveBeenCalledWith(
        "alt-supplier-1",
        "org-1",
        "card-1"
      );
      expect(updateResponse.status).toBe(200);
      expect(deleteResponse.status).toBe(200);
    });

    it("binds alternative material mutations to the route saving-card id", async () => {
      updateAlternativeMaterialMock.mockResolvedValueOnce({ id: "alt-material-1" });
      deleteAlternativeMaterialMock.mockResolvedValueOnce({ id: "alt-material-1" });

      const payload = createAlternativeMaterialPayload({
        isSelected: true,
      });
      const updateResponse = await putAlternativeMaterialRoute(
        createJsonRequest(
          "http://localhost/api/saving-cards/card-1/alternative-materials/alt-material-1",
          "PUT",
          payload
        ),
        { params: Promise.resolve({ id: "card-1", alternativeId: "alt-material-1" }) }
      );
      const deleteResponse = await deleteAlternativeMaterialRoute(
        new Request("http://localhost/api/saving-cards/card-1/alternative-materials/alt-material-1"),
        { params: Promise.resolve({ id: "card-1", alternativeId: "alt-material-1" }) }
      );

      expect(updateAlternativeMaterialMock).toHaveBeenCalledWith(
        "alt-material-1",
        payload,
        "user-1",
        "org-1",
        "card-1"
      );
      expect(deleteAlternativeMaterialMock).toHaveBeenCalledWith(
        "alt-material-1",
        "org-1",
        "card-1"
      );
      expect(updateResponse.status).toBe(200);
      expect(deleteResponse.status).toBe(200);
    });

    it("returns validation and workflow errors from alternative scenario routes", async () => {
      createAlternativeSupplierMock.mockRejectedValueOnce(
        new ZodError([
          {
            code: "custom",
            message: "Quoted price must be zero or greater.",
            path: ["quotedPrice"],
          },
        ])
      );
      updateAlternativeMaterialMock.mockRejectedValueOnce(
        new WorkflowErrorMock(
          "Finance-locked savings cannot apply alternative material scenarios.",
          409
        )
      );

      const supplierResponse = await postAlternativeSupplierRoute(
        createJsonRequest(
          "http://localhost/api/saving-cards/card-1/alternative-suppliers",
          "POST",
          createAlternativeSupplierPayload({ quotedPrice: -1 })
        ),
        { params: Promise.resolve({ id: "card-1" }) }
      );
      const materialResponse = await putAlternativeMaterialRoute(
        createJsonRequest(
          "http://localhost/api/saving-cards/card-1/alternative-materials/alt-material-1",
          "PUT",
          createAlternativeMaterialPayload({ isSelected: true })
        ),
        { params: Promise.resolve({ id: "card-1", alternativeId: "alt-material-1" }) }
      );

      expect(supplierResponse.status).toBe(422);
      await expect(supplierResponse.json()).resolves.toEqual({
        error: "Quoted price must be zero or greater.",
      });
      expect(materialResponse.status).toBe(409);
      await expect(materialResponse.json()).resolves.toEqual({
        error: "Finance-locked savings cannot apply alternative material scenarios.",
      });
    });
  });
});
