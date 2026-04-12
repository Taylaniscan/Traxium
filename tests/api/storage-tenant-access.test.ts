import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_ORGANIZATION_ID,
  createAdminUser,
} from "../helpers/security-fixtures";
import {
  DEFAULT_SIGNED_URL,
  createEvidenceStorageRecord,
  createSignedUrlResult,
} from "../helpers/tenant-access-fixtures";

const requireUserMock = vi.hoisted(() => vi.fn());
const createSupabaseAdminClientMock = vi.hoisted(() => vi.fn());
const createSignedUrlMock = vi.hoisted(() => vi.fn());
const uploadMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  savingCardEvidence: {
    findFirst: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  requireUser: requireUserMock,
  createAuthGuardErrorResponse: vi.fn(() => null),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: createSupabaseAdminClientMock,
}));

import { GET as getEvidenceDownloadRoute } from "@/app/api/evidence/[id]/download/route";
import { storeEvidenceFile } from "@/lib/uploads";

describe("storage tenant access", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireUserMock.mockResolvedValue(createAdminUser());
    createSignedUrlMock.mockResolvedValue(createSignedUrlResult());
    uploadMock.mockResolvedValue({
      data: { path: "uploaded" },
      error: null,
    });
    fromMock.mockImplementation(() => ({
      createSignedUrl: createSignedUrlMock,
      upload: uploadMock,
    }));
    createSupabaseAdminClientMock.mockReturnValue({
      storage: {
        from: fromMock,
      },
    });
  });

  it("stores uploads under the organization-scoped evidence namespace", async () => {
    const file = new File(["evidence"], "Quarterly Report.pdf", {
      type: "application/pdf",
    });

    const stored = await storeEvidenceFile(file, {
      organizationId: DEFAULT_ORGANIZATION_ID,
      savingCardId: "card-1",
    });

    expect(stored.storageBucket).toBe("evidence-private");
    expect(stored.storagePath).toMatch(
      /^organizations\/org-1\/saving-cards\/card-1\/evidence\/Quarterly-Report-[0-9a-f-]+\.pdf$/
    );
    expect(uploadMock).toHaveBeenCalledWith(
      stored.storagePath,
      expect.any(Buffer),
      {
        contentType: "application/pdf",
        upsert: false,
        cacheControl: "3600",
      }
    );
  });

  it("allows signed URL access for evidence that belongs to the active tenant", async () => {
    prismaMock.savingCardEvidence.findFirst.mockResolvedValueOnce(createEvidenceStorageRecord());

    const response = await getEvidenceDownloadRoute(new Request("http://localhost"), {
      params: Promise.resolve({ id: "evidence-1" }),
    });

    expect(createSignedUrlMock).toHaveBeenCalledWith(
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
    expect(response.headers.get("location")).toBe(DEFAULT_SIGNED_URL);
  });

  it("does not issue a signed URL for a file outside the tenant namespace", async () => {
    prismaMock.savingCardEvidence.findFirst.mockResolvedValueOnce(
      createEvidenceStorageRecord({
        storagePath: "organizations/org-2/saving-cards/card-1/evidence/evidence.pdf",
      })
    );

    const response = await getEvidenceDownloadRoute(new Request("http://localhost"), {
      params: Promise.resolve({ id: "evidence-1" }),
    });

    expect(createSignedUrlMock).not.toHaveBeenCalled();
    expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Evidence not found or access denied.",
    });
  });

  it("blocks storage path manipulation before signed URL creation", async () => {
    prismaMock.savingCardEvidence.findFirst.mockResolvedValueOnce(
      createEvidenceStorageRecord({
        storagePath:
          "organizations/org-1/saving-cards/card-1/evidence/../../org-2/secret.pdf",
      })
    );

    const response = await getEvidenceDownloadRoute(new Request("http://localhost"), {
      params: Promise.resolve({ id: "evidence-1" }),
    });

    expect(createSignedUrlMock).not.toHaveBeenCalled();
    expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Evidence not found or access denied.",
    });
  });
});
