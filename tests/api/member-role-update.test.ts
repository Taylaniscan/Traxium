import {
  MembershipStatus,
  OrganizationRole,
  Role,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_ORGANIZATION_ID,
  DEFAULT_USER_ID,
  MockAuthGuardError,
  OTHER_ORGANIZATION_ID,
  createAuthGuardJsonResponse,
  createSessionUser,
} from "../helpers/security-fixtures";

const requireOrganizationMock = vi.hoisted(() => vi.fn());
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

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireOrganization: requireOrganizationMock,
  createAuthGuardErrorResponse: createAuthGuardJsonResponse,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: enforceRateLimitMock,
  createRateLimitErrorResponse: createRateLimitErrorResponseMock,
  RateLimitExceededError: RateLimitExceededErrorMock,
}));

import { PATCH } from "@/app/api/admin/members/[membershipId]/role/route";

function createMembershipRecord(
  overrides: Partial<{
    id: string;
    userId: string;
    organizationId: string;
    role: OrganizationRole;
    status: MembershipStatus;
    createdAt: Date;
    updatedAt: Date;
    user: {
      id: string;
      name: string;
      email: string;
      createdAt: Date;
      updatedAt: Date;
    };
  }> = {}
) {
  return {
    id: "membership-2",
    userId: "user-2",
    organizationId: DEFAULT_ORGANIZATION_ID,
    role: OrganizationRole.MEMBER,
    status: MembershipStatus.ACTIVE,
    createdAt: new Date("2026-03-20T09:00:00.000Z"),
    updatedAt: new Date("2026-03-21T09:00:00.000Z"),
    user: {
      id: "user-2",
      name: "Jamie Buyer",
      email: "jamie@example.com",
      createdAt: new Date("2026-03-18T09:00:00.000Z"),
      updatedAt: new Date("2026-03-21T09:00:00.000Z"),
    },
    ...overrides,
  };
}

function createTransactionMock() {
  return {
    organizationMembership: {
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };
}

describe("member role update route", () => {
  let tx: ReturnType<typeof createTransactionMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    tx = createTransactionMock();
    enforceRateLimitMock.mockResolvedValue(undefined);
    createRateLimitErrorResponseMock.mockImplementation(
      (error: { message: string; status?: number }) =>
        Response.json(
          { error: error.message, code: "RATE_LIMITED" },
          { status: error.status ?? 429 }
        )
    );

    requireOrganizationMock.mockResolvedValue(
      createSessionUser({
        role: Role.HEAD_OF_GLOBAL_PROCUREMENT,
        activeOrganization: {
          membershipId: "membership-admin",
          organizationId: DEFAULT_ORGANIZATION_ID,
          membershipRole: OrganizationRole.ADMIN,
          membershipStatus: MembershipStatus.ACTIVE,
        },
      })
    );
    mockPrisma.$transaction.mockImplementation(async (callback: unknown) => {
      if (typeof callback !== "function") {
        throw new Error("Expected transaction callback.");
      }

      const transactionCallback = callback as (client: typeof tx) => Promise<unknown>;
      return transactionCallback(tx);
    });
  });

  it("allows an organization admin to update a member role inside the active organization", async () => {
    tx.organizationMembership.findUnique.mockResolvedValueOnce(
      createMembershipRecord()
    );
    tx.organizationMembership.update.mockResolvedValueOnce(
      createMembershipRecord({
        role: OrganizationRole.ADMIN,
        updatedAt: new Date("2026-03-26T10:30:00.000Z"),
      })
    );

    const response = await PATCH(
      new Request("http://localhost/api/admin/members/membership-2/role", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          role: "ADMIN",
        }),
      }),
      {
        params: Promise.resolve({ membershipId: "membership-2" }),
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      message: "Role updated to Admin.",
      membership: {
        id: "membership-2",
        userId: "user-2",
        name: "Jamie Buyer",
        email: "jamie@example.com",
        role: OrganizationRole.ADMIN,
        membershipStatus: MembershipStatus.ACTIVE,
        joinedAt: "2026-03-20T09:00:00.000Z",
        createdAt: "2026-03-18T09:00:00.000Z",
        updatedAt: "2026-03-26T10:30:00.000Z",
      },
    });
    expect(tx.organizationMembership.update).toHaveBeenCalledWith({
      where: {
        id: "membership-2",
      },
      data: {
        role: OrganizationRole.ADMIN,
      },
      select: expect.any(Object),
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        organizationId: DEFAULT_ORGANIZATION_ID,
        userId: DEFAULT_USER_ID,
        actorUserId: DEFAULT_USER_ID,
        targetUserId: "user-2",
        targetEntityId: "membership-2",
        eventType: "member.role_changed",
        action: "member.role_changed",
        detail: "Changed Jamie Buyer from Member to Admin.",
        payload: {
          membershipId: "membership-2",
          previousRole: OrganizationRole.MEMBER,
          nextRole: OrganizationRole.ADMIN,
        },
      },
    });
  });

  it("rejects a normal member", async () => {
    requireOrganizationMock.mockResolvedValueOnce(createSessionUser());

    const response = await PATCH(
      new Request("http://localhost/api/admin/members/membership-2/role", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          role: "ADMIN",
        }),
      }),
      {
        params: Promise.resolve({ membershipId: "membership-2" }),
      }
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Forbidden.",
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("blocks cross-tenant membership updates", async () => {
    tx.organizationMembership.findUnique.mockResolvedValueOnce(
      createMembershipRecord({
        id: "membership-3",
        organizationId: OTHER_ORGANIZATION_ID,
      })
    );

    const response = await PATCH(
      new Request("http://localhost/api/admin/members/membership-3/role", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          role: "ADMIN",
        }),
      }),
      {
        params: Promise.resolve({ membershipId: "membership-3" }),
      }
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Member not found in the active organization.",
    });
    expect(tx.organizationMembership.update).not.toHaveBeenCalled();
  });

  it("prevents downgrading the last active owner", async () => {
    requireOrganizationMock.mockResolvedValueOnce(
      createSessionUser({
        id: DEFAULT_USER_ID,
        role: Role.HEAD_OF_GLOBAL_PROCUREMENT,
        activeOrganization: {
          membershipId: "membership-owner-actor",
          organizationId: DEFAULT_ORGANIZATION_ID,
          membershipRole: OrganizationRole.OWNER,
          membershipStatus: MembershipStatus.ACTIVE,
        },
      })
    );
    tx.organizationMembership.findUnique.mockResolvedValueOnce(
      createMembershipRecord({
        id: "membership-owner-target",
        userId: "user-owner",
        role: OrganizationRole.OWNER,
        user: {
          id: "user-owner",
          name: "Owner User",
          email: "owner@example.com",
          createdAt: new Date("2026-03-18T09:00:00.000Z"),
          updatedAt: new Date("2026-03-21T09:00:00.000Z"),
        },
      })
    );
    tx.organizationMembership.count.mockResolvedValueOnce(1);

    const response = await PATCH(
      new Request("http://localhost/api/admin/members/membership-owner-target/role", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          role: "ADMIN",
        }),
      }),
      {
        params: Promise.resolve({ membershipId: "membership-owner-target" }),
      }
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "The last active owner cannot be reassigned. Add another owner first.",
    });
    expect(tx.organizationMembership.update).not.toHaveBeenCalled();
  });

  it("uses auth guard responses when no authenticated organization context exists", async () => {
    requireOrganizationMock.mockRejectedValueOnce(
      new MockAuthGuardError("Authenticated session is required.", 401, "UNAUTHENTICATED")
    );

    const response = await PATCH(
      new Request("http://localhost/api/admin/members/membership-2/role", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          role: "ADMIN",
        }),
      }),
      {
        params: Promise.resolve({ membershipId: "membership-2" }),
      }
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized.",
    });
  });
});
