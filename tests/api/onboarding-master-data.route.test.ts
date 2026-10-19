import { MembershipStatus, OrganizationRole, Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_ORGANIZATION_ID,
  DEFAULT_USER_ID,
  createSessionUser,
} from "../helpers/security-fixtures";

const requireOrganizationMock = vi.hoisted(() => vi.fn());
const createAuthGuardErrorResponseMock = vi.hoisted(() => vi.fn());
const enforceRateLimitMock = vi.hoisted(() => vi.fn());
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
  plant: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  businessUnit: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  requireOrganization: requireOrganizationMock,
  createAuthGuardErrorResponse: createAuthGuardErrorResponseMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: enforceRateLimitMock,
  RateLimitExceededError: class RateLimitExceededError extends Error {},
  createRateLimitErrorResponse: vi.fn(),
}));

import { POST } from "@/app/api/onboarding/master-data/route";

function createJsonRequest(body: unknown) {
  return new Request("http://localhost/api/onboarding/master-data", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("onboarding master data route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createAuthGuardErrorResponseMock.mockReturnValue(null);
    requireOrganizationMock.mockResolvedValue(
      createSessionUser({
        id: DEFAULT_USER_ID,
        organizationId: DEFAULT_ORGANIZATION_ID,
        activeOrganizationId: DEFAULT_ORGANIZATION_ID,
        activeOrganization: {
          membershipId: "membership-1",
          organizationId: DEFAULT_ORGANIZATION_ID,
          membershipRole: OrganizationRole.OWNER,
          membershipStatus: MembershipStatus.ACTIVE,
        },
      }),
    );
    enforceRateLimitMock.mockResolvedValue(undefined);

    for (const model of [
      prismaMock.buyer,
      prismaMock.supplier,
      prismaMock.material,
      prismaMock.category,
      prismaMock.plant,
      prismaMock.businessUnit,
    ]) {
      model.findMany.mockResolvedValue([]);
      model.create.mockResolvedValue({});
    }
  });

  it("creates starter buyers and skips duplicates without leaving onboarding", async () => {
    prismaMock.buyer.findMany.mockResolvedValueOnce([
      {
        name: "Existing Buyer",
      },
    ]);

    const response = await POST(
      createJsonRequest({
        entity: "buyers",
        rows: [
          {
            name: "Taylor Buyer",
            email: "taylor@example.com",
          },
          {
            name: "Existing Buyer",
          },
          {
            name: "Taylor Buyer",
          },
          {
            name: "",
          },
        ],
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      entity: "buyers",
      summary: {
        created: 1,
        skipped: 2,
        failed: 0,
      },
    });
    expect(requireOrganizationMock).toHaveBeenCalledWith({
      redirectTo: null,
    });
    expect(enforceRateLimitMock).toHaveBeenCalledWith({
      policy: "bulkImport",
      request: expect.any(Request),
      userId: DEFAULT_USER_ID,
      organizationId: DEFAULT_ORGANIZATION_ID,
      action: "onboarding.master_data.manual.buyers",
    });
    expect(prismaMock.buyer.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.buyer.create).toHaveBeenCalledWith({
      data: {
        organizationId: DEFAULT_ORGANIZATION_ID,
        name: "Taylor Buyer",
        email: "taylor@example.com",
      },
    });
  });

  it("creates plants from the manual starter table with region", async () => {
    const response = await POST(
      createJsonRequest({
        entity: "plants",
        rows: [
          {
            name: "Amsterdam Plant",
            region: "Benelux",
          },
        ],
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      entity: "plants",
      summary: {
        created: 1,
        skipped: 0,
        failed: 0,
      },
    });
    expect(prismaMock.plant.create).toHaveBeenCalledWith({
      data: {
        organizationId: DEFAULT_ORGANIZATION_ID,
        name: "Amsterdam Plant",
        region: "Benelux",
      },
    });
    expect(enforceRateLimitMock).toHaveBeenCalledWith({
      policy: "bulkImport",
      request: expect.any(Request),
      userId: DEFAULT_USER_ID,
      organizationId: DEFAULT_ORGANIZATION_ID,
      action: "onboarding.master_data.manual.plants",
    });
  });

  it("returns forbidden when a workspace member saves starter data", async () => {
    requireOrganizationMock.mockResolvedValueOnce(
      createSessionUser({
        id: DEFAULT_USER_ID,
        organizationId: DEFAULT_ORGANIZATION_ID,
        activeOrganizationId: DEFAULT_ORGANIZATION_ID,
        activeOrganization: {
          membershipId: "membership-1",
          organizationId: DEFAULT_ORGANIZATION_ID,
          membershipRole: OrganizationRole.MEMBER,
          membershipStatus: MembershipStatus.ACTIVE,
        },
      }),
    );

    const response = await POST(
      createJsonRequest({
        entity: "buyers",
        rows: [
          {
            name: "Taylor Buyer",
          },
        ],
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Forbidden." });
    expect(enforceRateLimitMock).not.toHaveBeenCalled();
    expect(prismaMock.buyer.create).not.toHaveBeenCalled();
  });

  it("allows legacy workspace managers to save starter data", async () => {
    requireOrganizationMock.mockResolvedValueOnce(
      createSessionUser({
        id: DEFAULT_USER_ID,
        role: Role.GLOBAL_CATEGORY_LEADER,
        organizationId: DEFAULT_ORGANIZATION_ID,
        activeOrganizationId: DEFAULT_ORGANIZATION_ID,
        activeOrganization: {
          membershipId: "membership-1",
          organizationId: DEFAULT_ORGANIZATION_ID,
          membershipRole: OrganizationRole.MEMBER,
          membershipStatus: MembershipStatus.ACTIVE,
        },
      }),
    );

    const response = await POST(
      createJsonRequest({
        entity: "buyers",
        rows: [
          {
            name: "Taylor Buyer",
          },
        ],
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      entity: "buyers",
      summary: {
        created: 1,
        skipped: 0,
        failed: 0,
      },
    });
    expect(prismaMock.buyer.create).toHaveBeenCalledWith({
      data: {
        organizationId: DEFAULT_ORGANIZATION_ID,
        name: "Taylor Buyer",
        email: null,
      },
    });
  });

  it("reports row-level validation failures for required starter data", async () => {
    const response = await POST(
      createJsonRequest({
        entity: "plants",
        rows: [
          {
            name: "Amsterdam Plant",
            region: "",
          },
        ],
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      entity: "plants",
      summary: {
        created: 0,
        skipped: 0,
        failed: 1,
      },
      results: [
        {
          row: 1,
          status: "failed",
          name: "Amsterdam Plant",
          message: "region is required.",
        },
      ],
    });
    expect(prismaMock.plant.create).not.toHaveBeenCalled();
  });
});

describe("onboarding file uploads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createAuthGuardErrorResponseMock.mockReturnValue(null);
    requireOrganizationMock.mockResolvedValue(
      createSessionUser({
        id: DEFAULT_USER_ID,
        organizationId: DEFAULT_ORGANIZATION_ID,
        activeOrganizationId: DEFAULT_ORGANIZATION_ID,
        activeOrganization: {
          membershipId: "membership-1",
          organizationId: DEFAULT_ORGANIZATION_ID,
          membershipRole: OrganizationRole.OWNER,
          membershipStatus: MembershipStatus.ACTIVE,
        },
      }),
    );
    enforceRateLimitMock.mockResolvedValue(undefined);
    for (const model of [
      prismaMock.buyer,
      prismaMock.supplier,
      prismaMock.material,
      prismaMock.category,
      prismaMock.plant,
      prismaMock.businessUnit,
    ]) {
      model.findMany.mockResolvedValue([]);
      model.create.mockResolvedValue({});
    }
  });

  function fileRequest(
    entity: string,
    filename: string,
    content: string | Uint8Array,
    separator = "comma",
  ) {
    const form = new FormData();
    form.set("entity", entity);
    form.set("separator", separator);
    form.set(
      "file",
      new File(
        [
          typeof content === "string"
            ? content
            : new Uint8Array(content).buffer,
        ],
        filename,
      ),
    );
    return new Request("http://localhost/api/onboarding/master-data", {
      method: "POST",
      body: form,
    });
  }

  it("uploads a buyer list with email and tenant-scoped writes", async () => {
    const response = await POST(
      fileRequest(
        "buyers",
        "team.csv",
        "Name,Email\nAlex Morgan,alex@example.com\nSam Lee,sam@example.com",
      ),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      summary: { created: 2, skipped: 0, failed: 0 },
    });
    expect(prismaMock.buyer.create).toHaveBeenCalledWith({
      data: {
        organizationId: DEFAULT_ORGANIZATION_ID,
        name: "Alex Morgan",
        email: "alex@example.com",
      },
    });
    expect(enforceRateLimitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "onboarding.master_data.file.buyers",
        organizationId: DEFAULT_ORGANIZATION_ID,
      }),
    );
  });

  it("accepts semicolon CSV sites and requires a region", async () => {
    const response = await POST(
      fileRequest(
        "plants",
        "sites.csv",
        "name;region\nAmsterdam Plant;Benelux\nHamburg Plant;",
        "semicolon",
      ),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      summary: { created: 1, failed: 1 },
      results: [
        expect.objectContaining({ row: 2, status: "created" }),
        expect.objectContaining({
          row: 3,
          status: "failed",
          message: "region is required.",
        }),
      ],
    });
    expect(prismaMock.plant.create).toHaveBeenCalledWith({
      data: {
        organizationId: DEFAULT_ORGANIZATION_ID,
        name: "Amsterdam Plant",
        region: "Benelux",
      },
    });
  });

  it("uploads business units from XLSX", async () => {
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([["name"], ["Beverages"]]),
      "Business units",
    );
    const bytes = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    }) as Uint8Array;
    const response = await POST(
      fileRequest("businessUnits", "units.xlsx", bytes),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      summary: { created: 1 },
    });
    expect(prismaMock.businessUnit.create).toHaveBeenCalledWith({
      data: { organizationId: DEFAULT_ORGANIZATION_ID, name: "Beverages" },
    });
  });

  it("rejects unsupported columns and nonpersistent values instead of silently dropping them", async () => {
    const unknown = await POST(
      fileRequest("suppliers", "suppliers.csv", "name,currency\nAcme,USD"),
    );
    expect(unknown.status).toBe(422);
    await expect(unknown.json()).resolves.toMatchObject({
      error: expect.stringContaining('Column "currency" is not supported'),
    });
    const ignored = await POST(
      fileRequest(
        "suppliers",
        "suppliers.csv",
        "name,country\nAcme,France\nBeta,",
      ),
    );
    expect(ignored.status).toBe(200);
    await expect(ignored.json()).resolves.toMatchObject({
      summary: { created: 1, failed: 1 },
      results: [
        expect.objectContaining({
          row: 2,
          status: "failed",
          message: expect.stringContaining("not stored"),
        }),
        expect.objectContaining({ row: 3, status: "created" }),
      ],
    });
    expect(prismaMock.supplier.create).toHaveBeenCalledTimes(1);
  });

  it("rejects populated columns without a heading before saving rows", async () => {
    const response = await POST(
      fileRequest("materials", "materials.csv", "name,\nPET resin,unlabeled"),
    );
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("no heading"),
    });
    expect(prismaMock.material.create).not.toHaveBeenCalled();
  });

  it("keeps file upload forbidden for a member without data permissions", async () => {
    requireOrganizationMock.mockResolvedValueOnce(
      createSessionUser({
        id: DEFAULT_USER_ID,
        organizationId: DEFAULT_ORGANIZATION_ID,
        activeOrganizationId: DEFAULT_ORGANIZATION_ID,
        activeOrganization: {
          membershipId: "membership-1",
          organizationId: DEFAULT_ORGANIZATION_ID,
          membershipRole: OrganizationRole.MEMBER,
          membershipStatus: MembershipStatus.ACTIVE,
        },
      }),
    );
    const response = await POST(
      fileRequest("materials", "materials.csv", "name\nPET resin"),
    );
    expect(response.status).toBe(403);
    expect(prismaMock.material.create).not.toHaveBeenCalled();
  });
});
