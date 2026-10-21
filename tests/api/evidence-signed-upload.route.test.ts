import { Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createAuthGuardJsonResponse,
  createSessionUser,
  MockAuthGuardError,
} from "../helpers/security-fixtures";

const requireUserMock = vi.hoisted(() => vi.fn());
const createAuthGuardErrorResponseMock = vi.hoisted(() => vi.fn());
const enforceRateLimitMock = vi.hoisted(() => vi.fn());
const createRateLimitErrorResponseMock = vi.hoisted(() => vi.fn());
const RateLimitExceededErrorMock = vi.hoisted(
  () =>
    class RateLimitExceededError extends Error {
      constructor(message: string) {
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
      readonly status = 429;
      constructor(message: string) {
        super(message);
        this.name = "UsageQuotaExceededError";
      }
    }
);
const writeAuditEventMock = vi.hoisted(() => vi.fn());
const createEvidenceUploadTargetMock = vi.hoisted(() => vi.fn());
const getEvidenceObjectInfoMock = vi.hoisted(() => vi.fn());
const isManagedEvidenceStorageLocationMock = vi.hoisted(() => vi.fn());
const removeEvidenceObjectMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  savingCard: {
    findFirst: vi.fn(),
  },
  savingCardEvidence: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  requireUser: requireUserMock,
  createAuthGuardErrorResponse: createAuthGuardErrorResponseMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
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

vi.mock("@/lib/audit", () => ({
  auditEventTypes: { EVIDENCE_UPLOADED: "evidence.uploaded" },
  writeAuditEvent: writeAuditEventMock,
}));

vi.mock("@/lib/uploads", () => ({
  createEvidenceUploadTarget: createEvidenceUploadTargetMock,
  getEvidenceObjectInfo: getEvidenceObjectInfoMock,
  isManagedEvidenceStorageLocation: isManagedEvidenceStorageLocationMock,
  removeEvidenceObject: removeEvidenceObjectMock,
}));

import { POST as postSign } from "@/app/api/upload/evidence/sign/route";
import { POST as postComplete } from "@/app/api/upload/evidence/complete/route";

const STORAGE_PATH =
  "organizations/org-1/saving-cards/card-1/evidence/quote-abc.pdf";
const MB = 1024 * 1024;

function jsonRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function signRequest(overrides: Record<string, unknown> = {}) {
  return jsonRequest("http://localhost/api/upload/evidence/sign", {
    savingCardId: "card-1",
    fileName: "quote.pdf",
    fileSize: 12 * MB,
    fileType: "application/pdf",
    ...overrides,
  });
}

function completeRequest(overrides: Record<string, unknown> = {}) {
  return jsonRequest("http://localhost/api/upload/evidence/complete", {
    savingCardId: "card-1",
    evidenceType: "SUPPLIER_QUOTE",
    storageBucket: "evidence-private",
    storagePath: STORAGE_PATH,
    fileName: "quote.pdf",
    ...overrides,
  });
}

describe("signed evidence upload routes", () => {
  beforeEach(() => {
    requireUserMock.mockResolvedValue(
      createSessionUser({ role: Role.HEAD_OF_GLOBAL_PROCUREMENT })
    );
    createAuthGuardErrorResponseMock.mockImplementation(createAuthGuardJsonResponse);
    enforceRateLimitMock.mockResolvedValue({ limit: 20, remaining: 19 });
    enforceUsageQuotaMock.mockResolvedValue(undefined);
    recordUsageEventMock.mockResolvedValue(undefined);
    writeAuditEventMock.mockResolvedValue(undefined);
    prismaMock.savingCard.findFirst.mockResolvedValue({
      id: "card-1",
      organizationId: "org-1",
    });
    prismaMock.savingCardEvidence.findFirst.mockResolvedValue(null);
    prismaMock.savingCardEvidence.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: "evidence-1",
        fileName: data.fileName,
        fileSize: data.fileSize,
        fileType: data.fileType,
        evidenceType: data.evidenceType,
        uploadedAt: new Date("2026-10-21T00:00:00.000Z"),
      })
    );
    createEvidenceUploadTargetMock.mockResolvedValue({
      storageBucket: "evidence-private",
      storagePath: STORAGE_PATH,
      signedUrl: "https://project.supabase.co/storage/v1/object/upload/sign/x?token=t",
    });
    isManagedEvidenceStorageLocationMock.mockReturnValue(true);
    getEvidenceObjectInfoMock.mockResolvedValue({
      size: 12 * MB,
      contentType: "application/pdf",
    });
    removeEvidenceObjectMock.mockResolvedValue(undefined);
  });

  describe("POST /api/upload/evidence/sign", () => {
    it("issues a signed upload target for files larger than the 4.5 MB function body limit", async () => {
      const response = await postSign(signRequest());

      expect(response.status).toBe(201);
      await expect(response.json()).resolves.toMatchObject({
        success: true,
        upload: {
          storageBucket: "evidence-private",
          storagePath: STORAGE_PATH,
        },
      });
      expect(enforceRateLimitMock).toHaveBeenCalledWith(
        expect.objectContaining({ policy: "evidenceUpload" })
      );
      expect(enforceUsageQuotaMock).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: "org-1", requestedQuantity: 1 })
      );
      expect(createEvidenceUploadTargetMock).toHaveBeenCalledWith(
        { name: "quote.pdf", size: 12 * MB },
        { organizationId: "org-1", savingCardId: "card-1" }
      );
    });

    it("returns 401 for unauthenticated requests", async () => {
      requireUserMock.mockRejectedValueOnce(
        new MockAuthGuardError("Authenticated session is required.", 401, "UNAUTHENTICATED")
      );

      const response = await postSign(signRequest());

      expect(response.status).toBe(401);
      expect(createEvidenceUploadTargetMock).not.toHaveBeenCalled();
    });

    it("rejects files over 25 MB and unsupported types before signing", async () => {
      const tooLarge = await postSign(signRequest({ fileSize: 26 * MB }));
      const wrongType = await postSign(
        signRequest({ fileName: "payload.exe", fileType: "application/octet-stream" })
      );

      expect(tooLarge.status).toBe(422);
      expect(wrongType.status).toBe(422);
      expect(createEvidenceUploadTargetMock).not.toHaveBeenCalled();
    });

    it("returns 404 when the card is outside the user's tenant or access", async () => {
      prismaMock.savingCard.findFirst.mockResolvedValueOnce(null);

      const response = await postSign(signRequest());

      expect(response.status).toBe(404);
      expect(createEvidenceUploadTargetMock).not.toHaveBeenCalled();
    });

    it("rejects unexpected fields", async () => {
      const response = await postSign(signRequest({ storagePath: "../../other-org" }));

      expect(response.status).toBe(422);
      expect(createEvidenceUploadTargetMock).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/upload/evidence/complete", () => {
    it("records evidence using the stored object's verified size and type", async () => {
      getEvidenceObjectInfoMock.mockResolvedValueOnce({
        size: 9 * MB,
        contentType: "application/pdf",
      });

      const response = await postComplete(completeRequest());

      expect(response.status).toBe(201);
      await expect(response.json()).resolves.toMatchObject({
        success: true,
        files: [
          {
            id: "evidence-1",
            fileSize: 9 * MB,
            downloadUrl: "/api/evidence/evidence-1/download",
          },
        ],
      });
      expect(prismaMock.savingCardEvidence.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            storagePath: STORAGE_PATH,
            fileSize: 9 * MB,
            fileType: "application/pdf",
            uploadedById: "user-1",
          }),
        })
      );
      expect(writeAuditEventMock).toHaveBeenCalled();
      expect(recordUsageEventMock).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 1 })
      );
    });

    it("rejects storage paths that do not belong to the card's tenant prefix", async () => {
      isManagedEvidenceStorageLocationMock.mockReturnValueOnce(false);

      const response = await postComplete(
        completeRequest({
          storagePath: "organizations/org-2/saving-cards/card-9/evidence/x.pdf",
        })
      );

      expect(response.status).toBe(422);
      expect(getEvidenceObjectInfoMock).not.toHaveBeenCalled();
      expect(prismaMock.savingCardEvidence.create).not.toHaveBeenCalled();
    });

    it("rejects a file name whose extension differs from the signed path", async () => {
      const response = await postComplete(completeRequest({ fileName: "quote.xlsx" }));

      expect(response.status).toBe(422);
      expect(prismaMock.savingCardEvidence.create).not.toHaveBeenCalled();
    });

    it("returns 422 when nothing was uploaded to the signed path", async () => {
      getEvidenceObjectInfoMock.mockResolvedValueOnce(null);

      const response = await postComplete(completeRequest());

      expect(response.status).toBe(422);
      expect(prismaMock.savingCardEvidence.create).not.toHaveBeenCalled();
    });

    it("deletes and rejects a stored object that exceeds 25 MB", async () => {
      getEvidenceObjectInfoMock.mockResolvedValueOnce({
        size: 40 * MB,
        contentType: "application/pdf",
      });

      const response = await postComplete(completeRequest());

      expect(response.status).toBe(422);
      expect(removeEvidenceObjectMock).toHaveBeenCalledWith(
        "evidence-private",
        STORAGE_PATH
      );
      expect(prismaMock.savingCardEvidence.create).not.toHaveBeenCalled();
    });

    it("deletes and rejects a stored object whose content type does not match", async () => {
      getEvidenceObjectInfoMock.mockResolvedValueOnce({
        size: 1 * MB,
        contentType: "text/html",
      });

      const response = await postComplete(completeRequest());

      expect(response.status).toBe(422);
      expect(removeEvidenceObjectMock).toHaveBeenCalled();
      expect(prismaMock.savingCardEvidence.create).not.toHaveBeenCalled();
    });

    it("does not record the same stored object twice", async () => {
      prismaMock.savingCardEvidence.findFirst.mockResolvedValueOnce({ id: "evidence-1" });

      const response = await postComplete(completeRequest());

      expect(response.status).toBe(409);
      expect(prismaMock.savingCardEvidence.create).not.toHaveBeenCalled();
    });
  });
});
